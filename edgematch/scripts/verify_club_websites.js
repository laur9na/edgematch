/**
 * scripts/verify_club_websites.js
 *
 * STEP 1: Verify existing websites — check each club's URL actually belongs to that club.
 * STEP 2: Find correct website for clubs that failed verification.
 * STEP 3: Enrich newly-found websites with contact info.
 *
 * Usage: node scripts/verify_club_websites.js [--dry-run]
 * Requires: puppeteer (npm install puppeteer)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const NAV_TIMEOUT    = 10_000;
const BATCH_SIZE     = 5;
const BATCH_DELAY    = 1_000;
const SEARCH_DELAY   = 2_000;

const SKATING_WORDS  = ['skating', 'skate', 'ice', 'figure'];
const SKIP_DOMAINS   = ['google.com', 'wikipedia.org', 'facebook.com', 'instagram.com',
                        'youtube.com', 'yelp.com', 'twitter.com', 'linkedin.com'];

const EMAIL_RE = /[\w.\-+]+@[\w.\-]+\.\w{2,}/g;
const PHONE_RE = /[\+\(]?[\d][\d\s\-\(\)]{6,}/g;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
let puppeteer;

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
  } catch {
    return false;
  }
}

async function getPageText(page) {
  try {
    const title = await page.title().catch(() => '');
    const body  = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    return (title + ' ' + body).toLowerCase();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Verification check
// ---------------------------------------------------------------------------

function clubNameWords(club) {
  return club.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'of', 'at', 'ice', 'skating', 'figure', 'club', 'skate'].includes(w));
}

function isClubPage(text, club) {
  const words = clubNameWords(club);
  const nameMatch  = words.length > 0 && words.some(w => text.includes(w));
  const skateMatch = SKATING_WORDS.some(w => text.includes(w));
  return nameMatch || skateMatch;
}

// ---------------------------------------------------------------------------
// Step 1: Verify a single club
// ---------------------------------------------------------------------------

async function verifyClub(browser, club) {
  const page = await newPage(browser);
  try {
    const ok = await safeFetch(page, club.website);
    if (!ok) return 'UNVERIFIABLE';

    const text = await getPageText(page);
    if (!text || text.length < 50) return 'UNVERIFIABLE';

    return isClubPage(text, club) ? 'OK' : 'NEEDS_CORRECT';
  } catch {
    return 'UNVERIFIABLE';
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Step 2: Google search for correct website
// ---------------------------------------------------------------------------

async function searchForClub(browser, club) {
  const q = encodeURIComponent(
    `${club.name} ${club.city || ''} ${club.country || ''} figure skating official site`.trim()
  );
  const searchUrl = `https://www.google.com/search?q=${q}`;

  const page = await newPage(browser);
  try {
    const ok = await safeFetch(page, searchUrl);
    if (!ok) return [];

    const hrefs = await page.evaluate(() => {
      return [...document.querySelectorAll('#search a[href]')]
        .map(a => a.href)
        .filter(h => h.startsWith('http'));
    }).catch(() => []);

    return hrefs
      .filter(h => !SKIP_DOMAINS.some(d => h.includes(d)))
      .slice(0, 10);
  } catch {
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function findAndVerifyUrl(browser, club, candidates) {
  for (const url of candidates.slice(0, 3)) {
    const page = await newPage(browser);
    try {
      const ok = await safeFetch(page, url);
      if (!ok) continue;

      const text = await getPageText(page);
      if (text && text.length >= 50 && isClubPage(text, club)) {
        return url;
      }
    } catch {
      // continue
    } finally {
      await page.close().catch(() => {});
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 3: Extract contact info from a verified website
// ---------------------------------------------------------------------------

async function extractContact(browser, url) {
  const page = await newPage(browser);
  try {
    const ok = await safeFetch(page, url);
    if (!ok) return { email: null, phone: null };

    // Try contact sub-pages first
    const contactLinks = await page.evaluate(() => {
      const kw = ['contact', 'about', 'info', 'reach'];
      return [...document.querySelectorAll('a[href]')]
        .filter(a => kw.some(k => (a.href + a.textContent).toLowerCase().includes(k)))
        .map(a => a.href)
        .filter(h => h.startsWith('http') && !h.includes('mailto:'))
        .slice(0, 2);
    }).catch(() => []);

    async function scrapeMailtos(pg) {
      const m = await pg.evaluate(() =>
        [...document.querySelectorAll('a[href^="mailto:"]')]
          .map(a => a.href.replace('mailto:', '').split('?')[0].trim())
          .filter(e => e.includes('@'))
      ).catch(() => []);
      const body = await pg.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      const emails = [...new Set([...m, ...(body.match(EMAIL_RE) ?? [])])]
        .filter(e => e.length <= 80 && e.includes('.'));
      const phones = (body.match(PHONE_RE) ?? [])
        .map(p => p.trim())
        .filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });
      return { email: emails[0] ?? null, phone: phones[0] ?? null };
    }

    let { email, phone } = await scrapeMailtos(page);

    for (const sub of contactLinks) {
      if (email && phone) break;
      const subOk = await safeFetch(page, sub);
      if (!subOk) continue;
      const res = await scrapeMailtos(page);
      if (!email && res.email) email = res.email;
      if (!phone && res.phone) phone = res.phone;
    }

    return { email, phone };
  } catch {
    return { email: null, phone: null };
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBatches(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Load puppeteer
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.error('Puppeteer not installed. Run: npm install puppeteer');
    process.exit(1);
  }

  // Load all clubs with a website
  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, name, city, state, country, website, contact_email, phone')
    .not('website', 'is', null);

  if (error) { console.error('Failed to load clubs:', error.message); process.exit(1); }
  console.log(`Loaded ${clubs.length} clubs with websites.\n`);

  const stats = {
    ok: 0,
    needsCorrect: [],
    unverifiable: 0,
    corrected: 0,
    cleared: 0,
    contactAdded: 0,
  };

  // ------------------------------------------------------------------
  // STEP 1: Verify existing websites
  // ------------------------------------------------------------------

  console.log('=== STEP 1: Verifying existing websites ===');
  const browser = await launchBrowser();

  const verifyResults = await runBatches(clubs, async (club) => {
    const status = await verifyClub(browser, club);
    const loc = [club.city, club.country].filter(Boolean).join(', ');
    console.log(`  [${status.padEnd(12)}] ${club.name}${loc ? ' (' + loc + ')' : ''}`);
    return { club, status };
  });

  for (const { club, status } of verifyResults) {
    if (status === 'OK')            stats.ok++;
    else if (status === 'NEEDS_CORRECT') stats.needsCorrect.push(club);
    else                            stats.unverifiable++;
  }

  console.log(`\nStep 1 results: ${stats.ok} OK, ${stats.needsCorrect.length} NEEDS_CORRECT, ${stats.unverifiable} unverifiable\n`);

  // ------------------------------------------------------------------
  // STEP 2: Find correct website for flagged clubs
  // ------------------------------------------------------------------

  const correctedClubs = [];

  if (stats.needsCorrect.length > 0) {
    console.log('=== STEP 2: Finding correct websites for flagged clubs ===');

    for (const club of stats.needsCorrect) {
      const loc = [club.city, club.country].filter(Boolean).join(', ');
      console.log(`\n  Searching: ${club.name}${loc ? ' (' + loc + ')' : ''}`);
      console.log(`    Current URL: ${club.website}`);

      const candidates = await searchForClub(browser, club);
      console.log(`    Found ${candidates.length} candidates`);

      const verified = await findAndVerifyUrl(browser, club, candidates);

      if (verified) {
        console.log(`    Corrected to: ${verified}`);
        if (!DRY_RUN) {
          const { error: upErr } = await supabase
            .from('clubs')
            .update({ website: verified })
            .eq('id', club.id);
          if (upErr) console.error(`    DB error: ${upErr.message}`);
        }
        stats.corrected++;
        correctedClubs.push({ ...club, website: verified });
      } else {
        console.log(`    No verified URL found. Clearing website.`);
        if (!DRY_RUN) {
          const { error: clrErr } = await supabase
            .from('clubs')
            .update({ website: null })
            .eq('id', club.id);
          if (clrErr) console.error(`    DB error: ${clrErr.message}`);
        }
        stats.cleared++;
      }

      await sleep(SEARCH_DELAY);
    }
  }

  // ------------------------------------------------------------------
  // STEP 3: Enrich newly corrected websites
  // ------------------------------------------------------------------

  if (correctedClubs.length > 0) {
    console.log('\n=== STEP 3: Enriching newly corrected websites ===');

    await runBatches(correctedClubs, async (club) => {
      if (club.contact_email && club.phone) return;
      const { email, phone } = await extractContact(browser, club.website);
      const update = {};
      if (email && !club.contact_email) update.contact_email = email;
      if (phone && !club.phone) update.phone = phone;

      if (Object.keys(update).length > 0) {
        console.log(`  ${club.name}: ${Object.keys(update).join(', ')}`);
        if (!DRY_RUN) {
          const { error: upErr } = await supabase.from('clubs').update(update).eq('id', club.id);
          if (upErr) console.error(`  DB error: ${upErr.message}`);
          else stats.contactAdded++;
        } else {
          stats.contactAdded++;
        }
      }
    });
  }

  await browser.close().catch(() => {});

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------

  console.log('\n=== Summary ===');
  console.log(`Total clubs checked:   ${clubs.length}`);
  console.log(`Already correct:       ${stats.ok}`);
  console.log(`Unverifiable (kept):   ${stats.unverifiable}`);
  console.log(`Corrected:             ${stats.corrected}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Cleared:               ${stats.cleared}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Contact info added:    ${stats.contactAdded}${DRY_RUN ? ' (dry-run)' : ''}`);

  return stats;
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
