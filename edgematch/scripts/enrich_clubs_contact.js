/**
 * scripts/enrich_clubs_contact.js
 *
 * PART 1 : clubs with a website but missing contact_email or phone:
 *   Navigate to the club site, find contact/about/info pages,
 *   extract email + phone, write back to DB.
 *
 * PART 2 : clubs with no website:
 *   DuckDuckGo search for "<name> <city> figure skating contact",
 *   take first non-search-engine result, extract email + phone + website.
 *
 * Requires: puppeteer (npm install puppeteer)
 * Usage:    node scripts/enrich_clubs_contact.js [--dry-run]
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
try {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* rely on environment */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN      = process.argv.includes('--dry-run');
const NAV_TIMEOUT  = 10_000;
const SEARCH_DELAY = 2_000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /[\w.\-+]+@[\w.\-]+\.\w{2,}/g;
const PHONE_RE = /[\+\(]?[\d][\d\s\-\(\)]{6,}/g;

const BAD_EMAIL_RX = /\.(png|jpg|gif|svg|css|js|ts|json|woff|ttf|map|zip)$|^(noreply|no-reply|donotreply|do-not-reply|example|test)@|@example\.|@domain\.|user@|admin@example|\d{4,}@/i;

function extractEmails(text) {
  return [...new Set(text.match(EMAIL_RE) ?? [])]
    .filter(e => !BAD_EMAIL_RX.test(e) && e.length <= 80 && e.includes('.'));
}

function extractPhones(text) {
  return [...new Set(text.match(PHONE_RE) ?? [])]
    .map(p => p.trim())
    .filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });
}

async function extractMailtos(page) {
  try {
    return await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="mailto:"]')]
        .map(a => a.href.replace('mailto:', '').split('?')[0].trim())
        .filter(e => e.includes('@'))
    );
  } catch { return []; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Browser factory : re-launch on crash
// ---------------------------------------------------------------------------

let puppeteer;

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return page;
}

async function safeFetch(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    return true;
  } catch (err) {
    console.warn(`    Nav failed: ${url.slice(0, 80)} : ${err.message.split('\n')[0]}`);
    return false;
  }
}

async function getContactLinks(page) {
  try {
    return await page.evaluate(() => {
      const kw = ['contact', 'about', 'info', 'reach', 'connect', 'get-in-touch'];
      return [...document.querySelectorAll('a[href]')]
        .filter(a => kw.some(k => (a.href + a.textContent).toLowerCase().includes(k)))
        .map(a => a.href)
        .filter((v, i, arr) => arr.indexOf(v) === i && !v.startsWith('mailto:'))
        .slice(0, 3);
    });
  } catch { return []; }
}

async function scrapeFromPage(page) {
  const mailtos = await extractMailtos(page);
  let bodyText = '';
  try { bodyText = await page.evaluate(() => document.body.innerText ?? ''); } catch {}
  const emails = [...new Set([...mailtos, ...extractEmails(bodyText)])];
  const phones = extractPhones(bodyText);
  return { email: emails[0] ?? null, phone: phones[0] ?? null };
}

async function scrapeWithSubs(browser, url) {
  const page = await newPage(browser);
  try {
    const ok = await safeFetch(page, url);
    if (!ok) return { email: null, phone: null };

    let { email, phone } = await scrapeFromPage(page);

    if (!email || !phone) {
      const subs = await getContactLinks(page);
      for (const sub of subs) {
        if (email && phone) break;
        const subOk = await safeFetch(page, sub);
        if (!subOk) continue;
        const res = await scrapeFromPage(page);
        if (!email && res.email) email = res.email;
        if (!phone && res.phone) phone = res.phone;
      }
    }
    return { email, phone };
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Part 1: clubs with website, missing contact info
// ---------------------------------------------------------------------------

async function enrichWithWebsite(browser, clubs) {
  let emailsFound = 0, phonesFound = 0;

  for (const club of clubs) {
    console.log(`\n[Part 1] ${club.name} : ${club.website}`);
    try {
      const { email, phone } = await scrapeWithSubs(browser, club.website);
      console.log(`  email: ${email ?? '(none)'}  phone: ${phone ?? '(none)'}`);

      const update = {};
      if (email && !club.contact_email) { update.contact_email = email; emailsFound++; }
      if (phone && !club.phone) { update.phone = phone; phonesFound++; }

      if (Object.keys(update).length > 0 && !DRY_RUN) {
        const { error } = await supabase.from('clubs').update(update).eq('id', club.id);
        if (error) console.error(`  DB error: ${error.message}`);
        else console.log(`  Saved: ${Object.keys(update).join(', ')}`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  return { emailsFound, phonesFound };
}

// ---------------------------------------------------------------------------
// Part 2: clubs with no website : DuckDuckGo search
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// URL probing : tries candidate domains for a club, no search engine needed
// ---------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase()
    .replace(/\bfsc\b/g, 'figureskatingclub')
    .replace(/\bsc\b/g, 'skatingclub')
    .replace(/\bfigure skating club\b/g, 'figureskatingclub')
    .replace(/\bskating club\b/g, 'skatingclub')
    .replace(/[^a-z0-9]/g, '')
    .replace(/figureskatingclubfigureskatingclub/, 'figureskatingclub');
}

function candidateUrls(name) {
  const s = slugify(name);
  // Also try a short version (first word only) and acronym
  const words = name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const short = words.slice(0, 2).join('');
  const acronym = words.map(w => w[0]).join('');

  const tlds = ['.org', '.com', '.net'];
  const candidates = [];

  for (const base of [s, short, `${short}sc`, `${short}fsc`]) {
    for (const tld of tlds) {
      candidates.push(`https://www.${base}${tld}`);
      candidates.push(`https://${base}${tld}`);
    }
  }

  return [...new Set(candidates)];
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdgeMatchBot/1.0)' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    return res.ok || res.status === 405; // 405 = method not allowed but site exists
  } catch { return false; }
}

async function findClubWebsite(name) {
  const candidates = candidateUrls(name);
  for (const url of candidates) {
    if (await probeUrl(url)) return url;
  }
  return null;
}

async function enrichViaSearch(browser, clubs) {
  let emailsFound = 0, phonesFound = 0, websitesFound = 0;

  for (const club of clubs) {
    const location = [club.city, club.state, club.country].filter(Boolean).join(' ');
    console.log(`\n[Part 2] ${club.name} (${location || 'no location'})`);

    let resultUrl = null;
    try {
      resultUrl = await findClubWebsite(club.name);
    } catch (err) {
      console.warn(`  URL probe error: ${err.message}`);
    }

    if (!resultUrl) {
      console.log('  No website found');
      continue;
    }

    console.log(`  Found: ${resultUrl.slice(0, 80)}`);

    let email = null, phone = null;
    try {
      const res = await scrapeWithSubs(browser, resultUrl);
      email = res.email;
      phone = res.phone;
    } catch (err) {
      console.warn(`  Scrape error: ${err.message}`);
    }

    console.log(`  email: ${email ?? '(none)'}  phone: ${phone ?? '(none)'}`);

    const update = { website: resultUrl };
    websitesFound++;
    if (email) { update.contact_email = email; emailsFound++; }
    if (phone) { update.phone = phone; phonesFound++; }

    if (!DRY_RUN) {
      const { error } = await supabase.from('clubs').update(update).eq('id', club.id);
      if (error) console.error(`  DB error: ${error.message}`);
      else console.log(`  Saved: website${email ? ', contact_email' : ''}${phone ? ', phone' : ''}`);
    }

    await sleep(300); // brief pause between clubs
  }

  return { emailsFound, phonesFound, websitesFound };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Pre-flight: confirm website + phone columns exist (need 011 migration)
  const { error: colCheck } = await supabase.from('clubs').select('website, phone').limit(1);
  if (colCheck?.message?.includes('does not exist')) {
    console.error('Column website/phone missing. Paste supabase/migrations/011_clubs_enrich.sql in Supabase SQL editor first.');
    process.exit(1);
  }

  // Load puppeteer
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.error('Puppeteer not installed. Run: npm install puppeteer');
    process.exit(1);
  }

  // Part 1: clubs with website but missing contact info
  const { data: clubsWithSite, error: e1 } = await supabase
    .from('clubs')
    .select('id, name, city, state, country, website, contact_email, phone')
    .not('website', 'is', null)
    .or('contact_email.is.null,phone.is.null');
  if (e1) { console.error('Failed to load clubs:', e1.message); process.exit(1); }
  console.log(`Part 1: ${clubsWithSite.length} clubs with website but missing email/phone`);

  // Part 2: clubs with no website
  const { data: clubsNoSite, error: e2 } = await supabase
    .from('clubs')
    .select('id, name, city, state, country, website, contact_email, phone')
    .is('website', null);
  if (e2) { console.error('Failed to load clubs:', e2.message); process.exit(1); }
  console.log(`Part 2: ${clubsNoSite.length} clubs with no website`);

  let browser = await launchBrowser();

  let totalEmails = 0, totalPhones = 0, totalWebsites = 0;

  try {
    if (clubsWithSite.length > 0) {
      const p1 = await enrichWithWebsite(browser, clubsWithSite);
      totalEmails += p1.emailsFound;
      totalPhones += p1.phonesFound;
    }

    if (clubsNoSite.length > 0) {
      const p2 = await enrichViaSearch(browser, clubsNoSite);
      totalEmails   += p2.emailsFound;
      totalPhones   += p2.phonesFound;
      totalWebsites += p2.websitesFound;
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log(`\n--- Summary ---`);
  console.log(`Clubs processed:      ${clubsWithSite.length + clubsNoSite.length}`);
  console.log(`contact_email added:  ${totalEmails}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`phone added:          ${totalPhones}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`website found:        ${totalWebsites}${DRY_RUN ? ' (dry-run)' : ''}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
