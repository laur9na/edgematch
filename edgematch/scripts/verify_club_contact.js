/**
 * scripts/verify_club_contact.js
 *
 * STEP 1: Validate and clear bad contact_email values (format + DNS + generic provider check).
 * STEP 2: Validate and normalize phone numbers.
 * STEP 3: Re-scrape websites for clubs whose email was cleared.
 *
 * Usage: node scripts/verify_club_contact.js [--dry-run]
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns';

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

const supabase   = createClient(SUPABASE_URL, SERVICE_KEY);
const dnsPromise = dns.promises;

const BATCH_SIZE       = 10;
const FETCH_TIMEOUT    = 8_000;
const NAV_TIMEOUT      = 12_000;

const EMAIL_FORMAT_RE  = /^[\w.\-+]+@[\w.\-]+\.\w{2,}$/;
const EMAIL_EXTRACT_RE = /[\w.\-+]+@[\w.\-]+\.\w{2,}/g;
const PHONE_EXTRACT_RE = /[\+\(]?[\d][\d\s\-\(\)]{6,}/g;

// Personal/generic providers : never a club's official email domain
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'live.com', 'msn.com', 'me.com', 'mac.com', 'protonmail.com',
  'aol.com', 'ymail.com',
]);

// Clearly non-club domains picked up as false positives
const BAD_DOMAINS = new Set([
  'annarbor.org', 'manhattan.org', 'nevada.org', 'buffalo.org', 'connecticut.com',
  'grandrapids.org', 'neworleans.org', 'neworleans.com', 'tampabay.org',
  'orangecounty.net', 'losangeles.org', 'southbend.net', 'southbay.com',
  'eastbay.com', 'westchester.org', 'lehighvalley.org', 'footlocker.com',
  'minneapolis.org', 'bayareanewsgroup.com', 'bluegrass.com', 'calgary.com',
  'pilotonline.com', 'coastalmississippi.com', 'indystar.com', 'latofonts.com',
  'telepathy.com', 'purposemedia.com', 'domain.com', 'wintersports.az',
  'hongkong.org', 'hketowashington.gov.hk', 'state.nm.us', 'mitrani.com',
  'justinhavre.com', 'bwchockey.com',
  // Error-tracking and site-builder infrastructure : never club emails
  'sentry.io', 'sentry.wixpress.com', 'sentry-next.wixpress.com',
  'wixpress.com', 'godaddy.com', 'musictoday.com', 'bayarea.com',
  // Personal ISPs scraped by mistake
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net',
  'charter.net', 'roadrunner.com', 'bellsouth.net',
]);

// Strings that indicate a scraped value is junk (version strings, dates, etc.)
const JUNK_EMAIL_RE = /intl-segmenter|@11\.|example\.|@domain\.|user@|noreply|no-reply|donotreply|filler@|name@company/i;

// UUID-looking local part (Sentry error tracking IDs leaked into HTML as email-like strings)
const UUID_LOCAL_RE = /^[0-9a-f]{32}$/i;

let puppeteer;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBatches(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const br = await Promise.all(batch.map(fn));
    results.push(...br);
    if (i + BATCH_SIZE < items.length) await sleep(200);
  }
  return results;
}

async function domainResolves(domain) {
  try {
    // Try MX first (faster for mail domains), then A record
    const mx = await dnsPromise.resolveMx(domain).catch(() => null);
    if (mx && mx.length > 0) return true;
    const a = await dnsPromise.resolve4(domain).catch(() => null);
    return !!(a && a.length > 0);
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// STEP 1: Validate emails
// ---------------------------------------------------------------------------

async function validateEmail(email) {
  if (!email) return { ok: false, reason: 'null' };

  // Format check
  if (!EMAIL_FORMAT_RE.test(email)) return { ok: false, reason: 'bad_format' };

  // Junk strings
  if (JUNK_EMAIL_RE.test(email)) return { ok: false, reason: 'junk' };

  const domain = email.split('@')[1].toLowerCase();

  // Personal provider
  if (PERSONAL_DOMAINS.has(domain)) return { ok: false, reason: 'personal_provider' };

  // Known bad domain
  if (BAD_DOMAINS.has(domain)) return { ok: false, reason: 'bad_domain' };

  // UUID local part (Sentry tracking IDs that look like emails in HTML)
  const localPart = email.split('@')[0];
  if (UUID_LOCAL_RE.test(localPart)) return { ok: false, reason: 'sentry_uuid' };

  // DNS check
  const resolves = await domainResolves(domain);
  if (!resolves) return { ok: false, reason: 'dns_fail' };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// STEP 2: Normalize phones
// ---------------------------------------------------------------------------

// Matches YYYY-YYYY, YYYY/YYYY, or YYYY-MM-DD patterns : never real phone numbers
const YEAR_RANGE_RE = /^(19|20)\d{2}[\s\-\/](19|20)\d{2}$/;
const DATE_RE       = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function normalizePhone(raw) {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Reject year ranges and dates before stripping non-digits
  if (YEAR_RANGE_RE.test(trimmed)) return null;
  if (DATE_RE.test(trimmed)) return null;

  // Reject multi-line values that look like zip+phone (two distinct number groups
  // separated by whitespace/newline where first group is 5 digits = zip code)
  const lines = trimmed.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const firstDigits = lines[0].replace(/\D/g, '');
    const secondDigits = lines[1].replace(/\D/g, '');
    // First line is a zip code (5 digits) and second is a phone : use only the phone
    if (firstDigits.length === 5 && secondDigits.length >= 7 && secondDigits.length <= 11) {
      raw = lines[1]; // use the phone line only
    } else {
      // Multi-line without clear zip+phone : treat as junk
      const allDigits = trimmed.replace(/\D/g, '');
      if (allDigits.length > 15) return null;
    }
  }

  // Strip everything except digits and leading +
  const digits = raw.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) return null; // invalid

  // Reject collapsed year ranges: 8 digits starting with 19xx or 20xx
  if (digits.length === 8 && /^(19|20)\d{6}$/.test(digits)) return null;
  // Reject 4-digit year pairs jammed together: 20232024 etc
  if (digits.length === 8 && /^(19|20)\d{2}(19|20)\d{2}$/.test(digits)) return null;

  // US/Canada: 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  // US/Canada with country code: 11 digits starting with 1
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  // International: keep + and group digits
  // Format: +CC XXXXXXXXX (no further grouping for international variety)
  if (digits.length >= 11) {
    // Try to preserve original +XX prefix
    const hasPlus = raw.trim().startsWith('+');
    if (hasPlus) return `+${digits}`;
    return `+${digits}`;
  }
  // 7-9 digit local numbers : keep digits only, no country code assumed
  return digits;
}

// ---------------------------------------------------------------------------
// STEP 3: Re-scrape website for email
// ---------------------------------------------------------------------------

async function refetchEmail(club) {
  if (!club.website) return null;

  // Try plain fetch first
  try {
    const res = await fetch(club.website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      const emails = await extractEmailsFromHtml(html, club.website);
      if (emails[0]) return emails[0];
    }
  } catch { /* fall through to puppeteer */ }

  // Puppeteer fallback
  if (!puppeteer) return null;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.goto(club.website, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    // Try contact sub-page
    const contactLinks = await page.evaluate(() => {
      const kw = ['contact', 'about', 'info', 'reach'];
      return [...document.querySelectorAll('a[href]')]
        .filter(a => kw.some(k => (a.href + a.textContent).toLowerCase().includes(k)) && !a.href.startsWith('mailto:'))
        .map(a => a.href)
        .slice(0, 2);
    }).catch(() => []);

    for (const url of [club.website, ...contactLinks]) {
      if (url !== club.website) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
      }
      const mailtos = await page.evaluate(() =>
        [...document.querySelectorAll('a[href^="mailto:"]')]
          .map(a => a.href.replace('mailto:', '').split('?')[0].trim())
      ).catch(() => []);
      const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      const emails = filterEmails([...mailtos, ...(body.match(EMAIL_EXTRACT_RE) ?? [])]);
      if (emails[0]) return emails[0];
    }
    return null;
  } catch { return null; }
  finally { await browser?.close().catch(() => {}); }
}

async function extractEmailsFromHtml(html, baseUrl) {
  // mailto: links
  const mailtos = [...html.matchAll(/mailto:([^\s"'<>?&]+)/g)].map(m => m[1]);
  const text = html.replace(/<[^>]+>/g, ' ');
  const found = [...mailtos, ...(text.match(EMAIL_EXTRACT_RE) ?? [])];
  return filterEmails(found);
}

function filterEmails(emails) {
  return [...new Set(emails)]
    .map(e => e.trim().toLowerCase())
    .filter(e => {
      if (!EMAIL_FORMAT_RE.test(e)) return false;
      if (JUNK_EMAIL_RE.test(e)) return false;
      if (e.length > 80) return false;
      const [local, domain] = e.split('@');
      if (!domain) return false;
      if (PERSONAL_DOMAINS.has(domain)) return false;
      if (BAD_DOMAINS.has(domain)) return false;
      if (UUID_LOCAL_RE.test(local)) return false;
      return true;
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  try { puppeteer = (await import('puppeteer')).default; } catch { puppeteer = null; }

  const stats = {
    emailChecked: 0, emailOk: 0, emailCleared: 0, emailRefound: 0,
    phoneChecked: 0, phoneOk: 0, phoneNormalized: 0, phoneCleared: 0,
  };

  // ----------------------------------------------------------------
  // STEP 1: Validate emails
  // ----------------------------------------------------------------
  console.log('=== STEP 1: Validating emails ===');

  const { data: emailClubs, error: e1 } = await supabase
    .from('clubs')
    .select('id, name, website, contact_email')
    .not('contact_email', 'is', null);
  if (e1) { console.error('Failed to load clubs:', e1.message); process.exit(1); }

  const cleared = []; // clubs whose email was cleared, for Step 3

  await runBatches(emailClubs, async (club) => {
    stats.emailChecked++;
    const { ok, reason } = await validateEmail(club.contact_email);

    if (ok) {
      console.log(`  [OK      ] ${club.name} : ${club.contact_email}`);
      stats.emailOk++;
    } else {
      console.log(`  [CLEARED ] ${club.name} : cleared bad email: ${club.contact_email} (${reason})`);
      if (!DRY_RUN) {
        const { error } = await supabase.from('clubs').update({ contact_email: null }).eq('id', club.id);
        if (error) console.error(`    DB error: ${error.message}`);
      }
      stats.emailCleared++;
      if (club.website) cleared.push(club);
    }
  });

  console.log(`\nStep 1: ${stats.emailOk} OK, ${stats.emailCleared} cleared\n`);

  // ----------------------------------------------------------------
  // STEP 2: Normalize phones
  // ----------------------------------------------------------------
  console.log('=== STEP 2: Normalizing phones ===');

  const { data: phoneClubs, error: e2 } = await supabase
    .from('clubs')
    .select('id, name, phone')
    .not('phone', 'is', null);
  if (e2) { console.error('Failed to load clubs:', e2.message); process.exit(1); }

  await runBatches(phoneClubs, async (club) => {
    stats.phoneChecked++;
    const normalized = normalizePhone(club.phone);

    if (normalized === null) {
      console.log(`  [CLEARED ] ${club.name} : cleared bad phone: ${JSON.stringify(club.phone)}`);
      if (!DRY_RUN) {
        await supabase.from('clubs').update({ phone: null }).eq('id', club.id);
      }
      stats.phoneCleared++;
    } else if (normalized !== club.phone) {
      console.log(`  [NORM    ] ${club.name} : "${club.phone}" -> "${normalized}"`);
      if (!DRY_RUN) {
        await supabase.from('clubs').update({ phone: normalized }).eq('id', club.id);
      }
      stats.phoneNormalized++;
      stats.phoneOk++;
    } else {
      stats.phoneOk++;
    }
  });

  console.log(`\nStep 2: ${stats.phoneOk} OK/normalized, ${stats.phoneCleared} cleared\n`);

  // ----------------------------------------------------------------
  // STEP 3: Re-scrape websites for clubs whose email was cleared
  // ----------------------------------------------------------------
  if (cleared.length > 0) {
    console.log(`=== STEP 3: Re-scraping ${cleared.length} websites for emails ===`);

    for (const club of cleared) {
      const email = await refetchEmail(club);
      if (email) {
        console.log(`  [REFOUND ] ${club.name} : ${email}`);
        if (!DRY_RUN) {
          const { error } = await supabase.from('clubs').update({ contact_email: email }).eq('id', club.id);
          if (error) console.error(`    DB error: ${error.message}`);
        }
        stats.emailRefound++;
      } else {
        console.log(`  [NONE    ] ${club.name} : no replacement found`);
      }
    }
  }

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  console.log('\n=== Summary ===');
  console.log(`Emails checked:    ${stats.emailChecked}`);
  console.log(`Emails OK:         ${stats.emailOk}`);
  console.log(`Emails cleared:    ${stats.emailCleared}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Emails re-found:   ${stats.emailRefound}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Phones checked:    ${stats.phoneChecked}`);
  console.log(`Phones OK:         ${stats.phoneOk}`);
  console.log(`Phones normalized: ${stats.phoneNormalized}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Phones cleared:    ${stats.phoneCleared}${DRY_RUN ? ' (dry-run)' : ''}`);

  return stats;
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
