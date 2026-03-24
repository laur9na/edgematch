/**
 * scripts/recheck_clubs.js
 *
 * Re-checks all clubs with websites using fetch() first (bypasses headless browser
 * detection), falling back to Puppeteer for JS-heavy sites.
 *
 * For clubs that fail verification:
 *   1. DuckDuckGo HTML search (plain fetch : avoids Google bot block)
 *   2. URL slug probing (HEAD requests) as final fallback
 *
 * Usage: node scripts/recheck_clubs.js [--dry-run]
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const NAV_TIMEOUT   = 15_000;
const FETCH_TIMEOUT =  8_000;
const BATCH_SIZE    = 5;
const BATCH_DELAY   = 800;
const SEARCH_DELAY  = 1_500;

const SKATING_WORDS = ['skating', 'skate', 'ice', 'figure'];
const SKIP_DOMAINS  = ['google.', 'duckduckgo.', 'wikipedia.org', 'facebook.com',
                       'instagram.com', 'youtube.com', 'yelp.com', 'twitter.com',
                       'linkedin.com', 'amazon.', 'ebay.'];

const EMAIL_RE = /[\w.\-+]+@[\w.\-]+\.\w{2,}/g;
const PHONE_RE = /[\+\(]?[\d][\d\s\-\(\)]{6,}/g;
const BAD_EMAIL_RX = /\.(png|jpg|gif|svg|css|js)$|^(noreply|no-reply|example|test)@/i;

let puppeteer;

// ---------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------

function clubNameWords(club) {
  const STOPWORDS = new Set(['the', 'and', 'for', 'of', 'at', 'ice', 'skating',
                             'figure', 'club', 'skate', 'fsc', 'isc', 'sc']);
  return club.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function isClubPage(text, club) {
  const t = text.toLowerCase();
  const words = clubNameWords(club);
  const nameMatch  = words.length > 0 && words.some(w => t.includes(w));
  const skateMatch = SKATING_WORDS.some(w => t.includes(w));
  return nameMatch || skateMatch;
}

// ---------------------------------------------------------------------------
// Plain fetch verification (primary : bypasses headless detection)
// ---------------------------------------------------------------------------

async function fetchVerify(url, club) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });

    if (!res.ok && res.status !== 403) return null; // null = try puppeteer

    const html = await res.text().catch(() => '');
    if (!html || html.length < 200) return null;

    // Strip tags for text matching
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[\s\S]*?<\/style>/gi, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ');

    return { verified: isClubPage(text, club), text };
  } catch (err) {
    // timeout or network error : try puppeteer
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Puppeteer verification (fallback for JS-rendered sites)
// ---------------------------------------------------------------------------

async function puppeteerVerify(browser, url, club) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    // Wait a moment for light JS to render
    await new Promise(r => setTimeout(r, 1000));
    const title = await page.title().catch(() => '');
    const body  = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    const text  = (title + ' ' + body);
    if (!text || text.trim().length < 50) return { verified: false, text: '' };
    return { verified: isClubPage(text, club), text };
  } catch {
    return null; // unverifiable
  } finally {
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Verify a club (fetch first, puppeteer fallback)
// ---------------------------------------------------------------------------

async function verifyClub(browser, club) {
  const fetchResult = await fetchVerify(club.website, club);

  if (fetchResult !== null) {
    return { method: 'fetch', verified: fetchResult.verified };
  }

  // fetch returned null : site needs JS or blocked plain fetch
  if (!browser) return { method: 'skip', verified: null }; // no puppeteer

  const puppResult = await puppeteerVerify(browser, club.website, club);
  if (puppResult === null) return { method: 'puppeteer', verified: null }; // timeout
  return { method: 'puppeteer', verified: puppResult.verified };
}

// ---------------------------------------------------------------------------
// Search: DuckDuckGo HTML (plain fetch : bypasses bot detection)
// ---------------------------------------------------------------------------

async function ddgSearch(query) {
  try {
    const q   = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${q}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
      redirect: 'follow',
    });

    if (!res.ok) return [];

    const html = await res.text();

    // DDG HTML results: <a class="result__a" href="...">
    const hrefs = [];
    const re = /class="result__a"[^>]*href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) hrefs.push(m[1]);

    // Also grab uddg= tracking links and decode them
    const trackRe = /uddg=([^"&]+)/g;
    while ((m = trackRe.exec(html)) !== null) {
      try { hrefs.push(decodeURIComponent(m[1])); } catch {}
    }

    return [...new Set(hrefs)]
      .filter(h => h.startsWith('http') && !SKIP_DOMAINS.some(d => h.includes(d)));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Search: URL slug probing (no search engine needed)
// ---------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase()
    .replace(/\bfsc\b/g, 'figureskatingclub')
    .replace(/\bsc\b/g, 'skatingclub')
    .replace(/\bisc\b/g, 'iceskatingclub')
    .replace(/\bfigure skating club\b/g, 'figureskatingclub')
    .replace(/\bskating club\b/g, 'skatingclub')
    .replace(/[^a-z0-9]/g, '')
    .replace(/figureskatingclubfigureskatingclub/, 'figureskatingclub');
}

function candidateUrls(name) {
  const s = slugify(name);
  const words = name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'figure', 'skating', 'club'].includes(w));
  const short   = words.slice(0, 2).join('');
  const acronym = words.map(w => w[0]).join('');

  const bases = [s, short, `${short}sc`, `${short}fsc`, `${acronym}sc`].filter(b => b.length >= 3);
  const tlds  = ['.org', '.com', '.net'];
  const out   = [];
  for (const base of [...new Set(bases)]) {
    for (const tld of tlds) {
      out.push(`https://www.${base}${tld}`);
      out.push(`https://${base}${tld}`);
    }
  }
  return [...new Set(out)];
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdgeMatchBot/1.0)' },
      signal: AbortSignal.timeout(5_000),
      redirect: 'follow',
    });
    return res.ok || res.status === 405;
  } catch { return false; }
}

async function slugProbe(club) {
  for (const url of candidateUrls(club.name)) {
    if (await probeUrl(url)) {
      // Quick content check
      const r = await fetchVerify(url, club);
      if (r?.verified) return url;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Find replacement URL (DDG + slug probe)
// ---------------------------------------------------------------------------

async function findReplacement(browser, club) {
  // 1. DuckDuckGo HTML search
  const query = `${club.name} ${club.city || ''} ${club.country || ''} figure skating official site`.trim();
  const candidates = await ddgSearch(query);

  if (candidates.length > 0) {
    // Verify up to 3 DDG results
    for (const url of candidates.slice(0, 3)) {
      const r = await fetchVerify(url, club);
      if (r?.verified) return url;

      if (r === null && browser) {
        const pr = await puppeteerVerify(browser, url, club);
        if (pr?.verified) return url;
      }
    }
  }

  // 2. Slug probing fallback
  return slugProbe(club);
}

// ---------------------------------------------------------------------------
// Extract contact info via fetch
// ---------------------------------------------------------------------------

async function extractContact(url, club) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });
    if (!res.ok) return { email: null, phone: null };

    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, ' ');

    // mailto: links
    const mailtos = [...html.matchAll(/mailto:([^\s"'<>?]+)/g)].map(m => m[1]);
    const emails  = [...new Set([...mailtos, ...(text.match(EMAIL_RE) ?? [])])]
      .filter(e => !BAD_EMAIL_RX.test(e) && e.length <= 80 && e.includes('.'));
    const phones = (text.match(PHONE_RE) ?? [])
      .map(p => p.trim())
      .filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });

    // Try contact sub-page if nothing found
    if (!emails[0] && !phones[0]) {
      const contactRe = /href="([^"]*(?:contact|about|info)[^"]*)"/gi;
      const subLinks  = [];
      let sm;
      while ((sm = contactRe.exec(html)) !== null) {
        const href = sm[1];
        if (!href.startsWith('mailto:') && !href.startsWith('tel:')) {
          const full = href.startsWith('http') ? href : new URL(href, url).href;
          subLinks.push(full);
        }
      }
      for (const sub of [...new Set(subLinks)].slice(0, 2)) {
        const sr = await fetch(sub, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }).catch(() => null);
        if (!sr?.ok) continue;
        const sh   = await sr.text();
        const st   = sh.replace(/<[^>]+>/g, ' ');
        const sms  = [...sh.matchAll(/mailto:([^\s"'<>?]+)/g)].map(m => m[1]);
        const sem  = [...new Set([...sms, ...(st.match(EMAIL_RE) ?? [])])]
          .filter(e => !BAD_EMAIL_RX.test(e) && e.length <= 80 && e.includes('.'));
        const sph  = (st.match(PHONE_RE) ?? []).map(p => p.trim())
          .filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });
        if (sem[0] || sph[0]) return { email: sem[0] ?? null, phone: sph[0] ?? null };
      }
    }

    return { email: emails[0] ?? null, phone: phones[0] ?? null };
  } catch {
    return { email: null, phone: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBatches(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const br    = await Promise.all(batch.map(fn));
    results.push(...br);
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.warn('Puppeteer not available : fetch-only mode');
    puppeteer = null;
  }

  const browser = puppeteer ? await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }) : null;

  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, name, city, state, country, website, contact_email, phone')
    .not('website', 'is', null);

  if (error) { console.error('Failed to load clubs:', error.message); process.exit(1); }
  console.log(`Loaded ${clubs.length} clubs with websites.\n`);

  const stats = {
    ok: 0, needsCorrect: [], unverifiable: 0,
    corrected: 0, cleared: 0, contactAdded: 0,
  };

  // ------------------------------------------------------------------
  // STEP 1: Verify all clubs (fetch first, puppeteer fallback)
  // ------------------------------------------------------------------

  console.log('=== STEP 1: Verifying websites (fetch + puppeteer fallback) ===');

  const verifyResults = await runBatches(clubs, async (club) => {
    const { method, verified } = await verifyClub(browser, club);
    const tag = verified === null ? 'UNVERIFIABLE'
              : verified           ? 'OK'
              :                      'NEEDS_CORRECT';
    const loc = [club.city, club.country].filter(Boolean).join(', ');
    console.log(`  [${tag.padEnd(12)}] (${method.padEnd(8)}) ${club.name}${loc ? ' (' + loc + ')' : ''}`);
    return { club, tag };
  });

  for (const { club, tag } of verifyResults) {
    if (tag === 'OK')             stats.ok++;
    else if (tag === 'UNVERIFIABLE') stats.unverifiable++;
    else                          stats.needsCorrect.push(club);
  }

  console.log(`\nStep 1: ${stats.ok} OK, ${stats.needsCorrect.length} NEEDS_CORRECT, ${stats.unverifiable} unverifiable\n`);

  // ------------------------------------------------------------------
  // STEP 2: Find replacements for flagged clubs
  // ------------------------------------------------------------------

  const correctedClubs = [];

  if (stats.needsCorrect.length > 0) {
    console.log('=== STEP 2: Finding replacements (DDG search + slug probing) ===');

    for (const club of stats.needsCorrect) {
      const loc = [club.city, club.country].filter(Boolean).join(', ');
      console.log(`\n  Searching: ${club.name}${loc ? ' (' + loc + ')' : ''}`);
      console.log(`    Current URL: ${club.website}`);

      const replacement = await findReplacement(browser, club);

      if (replacement) {
        console.log(`    Corrected to: ${replacement}`);
        if (!DRY_RUN) {
          const { error: upErr } = await supabase.from('clubs')
            .update({ website: replacement }).eq('id', club.id);
          if (upErr) console.error(`    DB error: ${upErr.message}`);
        }
        stats.corrected++;
        correctedClubs.push({ ...club, website: replacement });
      } else {
        console.log(`    Nothing found. Clearing.`);
        if (!DRY_RUN) {
          await supabase.from('clubs').update({ website: null }).eq('id', club.id);
        }
        stats.cleared++;
      }

      await sleep(SEARCH_DELAY);
    }
  }

  // ------------------------------------------------------------------
  // STEP 3: Extract contact info for newly corrected clubs + any OK
  //         clubs still missing email/phone
  // ------------------------------------------------------------------

  const enrichTargets = [
    ...correctedClubs,
    ...clubs.filter(c => {
      const res = verifyResults.find(r => r.club.id === c.id);
      return res?.tag === 'OK' && (!c.contact_email || !c.phone);
    }),
  ];

  if (enrichTargets.length > 0) {
    console.log(`\n=== STEP 3: Enriching ${enrichTargets.length} clubs missing contact info ===`);

    await runBatches(enrichTargets, async (club) => {
      const { email, phone } = await extractContact(club.website, club);
      const update = {};
      if (email && !club.contact_email) update.contact_email = email;
      if (phone && !club.phone)         update.phone = phone;
      if (Object.keys(update).length > 0) {
        console.log(`  ${club.name}: found ${Object.keys(update).join(', ')}`);
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

  if (browser) await browser.close().catch(() => {});

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------

  console.log('\n=== Summary ===');
  console.log(`Total clubs checked:   ${clubs.length}`);
  console.log(`Already correct:       ${stats.ok}`);
  console.log(`Corrected:             ${stats.corrected}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Cleared:               ${stats.cleared}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Unverifiable (kept):   ${stats.unverifiable}`);
  console.log(`Contact info added:    ${stats.contactAdded}${DRY_RUN ? ' (dry-run)' : ''}`);

  return stats;
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
