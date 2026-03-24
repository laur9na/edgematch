/**
 * scripts/find_missing_websites.js
 *
 * Finds websites for clubs that have none in the DB.
 * Strategy (in order):
 *   1. DuckDuckGo HTML search: "[name] [city] figure skating official site"
 *   2. DuckDuckGo HTML search: "[name] [city] skating" (broader)
 *   3. Slug probing: HEAD-check common domain patterns
 *
 * For each found URL, verifies the page actually belongs to the club
 * (title/body contains club name keywords or skating words), then writes
 * the URL to the DB and attempts to extract contact email + phone.
 *
 * Usage: node scripts/find_missing_websites.js [--dry-run]
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

const FETCH_TIMEOUT = 8_000;
const BATCH_SIZE    = 6;
const BATCH_DELAY   = 1_200;
const SEARCH_DELAY  = 1_500;

const SKATING_WORDS = ['skating', 'skate', 'ice', 'figure'];
const SKIP_DOMAINS  = [
  'google.', 'duckduckgo.', 'wikipedia.org', 'facebook.com', 'instagram.com',
  'youtube.com', 'yelp.com', 'twitter.com', 'linkedin.com', 'amazon.',
  'usfigureskating.org', 'skatecanada.ca', 'isu.org', 'isuresults.com',
];

const EMAIL_RE    = /[\w.\-+]+@[\w.\-]+\.\w{2,}/g;
const PHONE_RE    = /[\+\(]?[\d][\d\s\-\(\)]{6,}/g;
const BAD_EMAIL   = /\.(png|jpg|gif|svg|css|js)$|^(noreply|no-reply|example|test)@/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clubNameWords(club) {
  const STOP = new Set(['the','and','for','of','at','ice','skating','figure',
                        'club','skate','fsc','isc','sc','figure','winter']);
  return club.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function isClubPage(text, club) {
  const t     = text.toLowerCase();
  const words = clubNameWords(club);
  return (words.length > 0 && words.some(w => t.includes(w)))
      || SKATING_WORDS.some(w => t.includes(w));
}

// ---------------------------------------------------------------------------
// Plain fetch with text extraction
// ---------------------------------------------------------------------------

async function fetchAndCheck(url, club) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });
    if (!res.ok && res.status !== 403) return null;
    const html = await res.text().catch(() => '');
    if (!html || html.length < 200) return null;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    return { verified: isClubPage(text, club), text, html };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML search
// ---------------------------------------------------------------------------

async function ddgSearch(query) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      }
    );
    if (!res.ok) return [];
    const html  = await res.text();
    const hrefs = [];
    const re    = /class="result__a"[^>]*href="([^"]+)"/g;
    const re2   = /uddg=([^"&]+)/g;
    let m;
    while ((m = re.exec(html))  !== null) hrefs.push(m[1]);
    while ((m = re2.exec(html)) !== null) {
      try { hrefs.push(decodeURIComponent(m[1])); } catch {}
    }
    return [...new Set(hrefs)]
      .filter(h => h.startsWith('http') && !SKIP_DOMAINS.some(d => h.includes(d)))
      .slice(0, 8);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Slug / domain probing
// ---------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase()
    .replace(/\bfsc\b/g, 'fsc')
    .replace(/\bsc\b/g, 'sc')
    .replace(/[^a-z0-9]/g, '');
}

function candidateUrls(club) {
  const words = club.name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the','and','for','figure','skating','club','ice','winter','of','at'].includes(w));

  const full    = slugify(club.name);
  const short   = words.slice(0, 2).join('');
  const acronym = words.map(w => w[0]).join('');
  const city    = (club.city || '').toLowerCase().replace(/[^a-z]/g, '');

  const bases = [full, short, `${short}sc`, `${short}fsc`, `${acronym}fsc`, `${acronym}sc`,
                 city ? `${short}${city}` : null].filter(Boolean);
  const tlds  = ['.org', '.com', '.net'];

  const out = [];
  for (const base of [...new Set(bases)].filter(b => b.length >= 3)) {
    for (const tld of tlds) {
      out.push(`https://www.${base}${tld}`);
      out.push(`https://${base}${tld}`);
    }
  }
  return [...new Set(out)];
}

async function slugProbe(club) {
  for (const url of candidateUrls(club)) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdgeMatchBot/1.0)' },
        signal: AbortSignal.timeout(5_000),
        redirect: 'follow',
      });
      if (res.ok || res.status === 405) {
        const r = await fetchAndCheck(url, club);
        if (r?.verified) return url;
      }
    } catch { /* try next */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Find a website for a club with none
// ---------------------------------------------------------------------------

async function findWebsite(club) {
  const loc   = [club.city, club.state, club.country].filter(Boolean).join(', ');
  const name  = club.name;

  // Try two DDG queries: specific then broad
  const queries = [
    `"${name}" ${club.city || ''} figure skating official site`,
    `${name} ${club.city || ''} ${club.country || ''} figure skating`,
  ];

  for (const q of queries) {
    const candidates = await ddgSearch(q);
    for (const url of candidates.slice(0, 4)) {
      const r = await fetchAndCheck(url, club);
      if (r?.verified) return url;
    }
    await sleep(SEARCH_DELAY);
  }

  // Final fallback: slug probing
  return slugProbe(club);
}

// ---------------------------------------------------------------------------
// Extract contact info from a verified URL
// ---------------------------------------------------------------------------

async function extractContact(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });
    if (!res.ok) return { email: null, phone: null };

    const html    = await res.text();
    const text    = html.replace(/<[^>]+>/g, ' ');
    const mailtos = [...html.matchAll(/mailto:([^\s"'<>?]+)/g)].map(m => m[1]);
    const emails  = [...new Set([...mailtos, ...(text.match(EMAIL_RE) ?? [])])]
      .filter(e => !BAD_EMAIL.test(e) && e.length <= 80 && e.includes('.'));
    const phones  = (text.match(PHONE_RE) ?? [])
      .map(p => p.trim())
      .filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });

    if (!emails[0] && !phones[0]) {
      const subRe   = /href="([^"]*(?:contact|about|info)[^"]*)"/gi;
      const subLinks = [];
      let sm;
      while ((sm = subRe.exec(html)) !== null) {
        const href = sm[1];
        if (!href.startsWith('mailto:') && !href.startsWith('tel:')) {
          try { subLinks.push(href.startsWith('http') ? href : new URL(href, url).href); } catch {}
        }
      }
      for (const sub of [...new Set(subLinks)].slice(0, 2)) {
        const sr = await fetch(sub, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }).catch(() => null);
        if (!sr?.ok) continue;
        const sh  = await sr.text();
        const st  = sh.replace(/<[^>]+>/g, ' ');
        const sms = [...sh.matchAll(/mailto:([^\s"'<>?]+)/g)].map(m => m[1]);
        const sem = [...new Set([...sms, ...(st.match(EMAIL_RE) ?? [])])]
          .filter(e => !BAD_EMAIL.test(e) && e.length <= 80 && e.includes('.'));
        const sph = (st.match(PHONE_RE) ?? []).map(p => p.trim())
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
// Main
// ---------------------------------------------------------------------------

async function run() {
  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, name, city, state, country')
    .is('website', null)
    .order('name');

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  console.log(`Finding websites for ${clubs.length} clubs with none.\n`);

  let found = 0, notFound = 0;

  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i];
    const loc  = [club.city, club.country].filter(Boolean).join(', ');
    process.stdout.write(`[${String(i + 1).padStart(3)}/${clubs.length}] ${club.name}${loc ? ' (' + loc + ')' : ''} ... `);

    const url = await findWebsite(club);

    if (url) {
      console.log(`FOUND: ${url}`);
      found++;
      if (!DRY_RUN) {
        const { email, phone } = await extractContact(url);
        const update = { website: url };
        if (email) update.contact_email = email;
        if (phone) update.phone = phone;
        const { error: upErr } = await supabase.from('clubs').update(update).eq('id', club.id);
        if (upErr) console.error(`  DB error: ${upErr.message}`);
        else {
          const extras = [email ? `email` : null, phone ? `phone` : null].filter(Boolean);
          if (extras.length) console.log(`  + ${extras.join(', ')}`);
        }
      }
    } else {
      console.log('not found');
      notFound++;
    }

    if (i < clubs.length - 1) await sleep(BATCH_DELAY);
  }

  console.log(`\n=== Done ===`);
  console.log(`Found:     ${found}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Not found: ${notFound}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
