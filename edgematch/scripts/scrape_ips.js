/**
 * scripts/scrape_ips.js
 *
 * Logs in to IcePartnerSearch with Puppeteer, scrapes all pairs and
 * ice dance skaters actively looking for partners, then cross-references
 * against the athletes table:
 *
 *   Match found (name similarity >= 0.85): UPDATE search_status = 'active'
 *   No match:                              INSERT new athlete, search_status = 'active'
 *
 * Usage:
 *   node scripts/scrape_ips.js
 *   node scripts/scrape_ips.js --dry-run
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IPS_EMAIL, IPS_PASSWORD
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, '../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* rely on env */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IPS_EMAIL    = process.env.IPS_EMAIL;
const IPS_PASSWORD = process.env.IPS_PASSWORD;
const IPS_BASE     = 'https://icepartnersearch.com';
const DELAY_MS     = 1200;
const DRY_RUN      = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!IPS_EMAIL || !IPS_PASSWORD) {
  console.error('[BLOCKED: need IPS_EMAIL and IPS_PASSWORD in .env.local]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

// ---------------------------------------------------------------------------
// Parsers (same as before)
// ---------------------------------------------------------------------------

function parseDiscipline(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('pairs')) return 'pairs';
  if (s.includes('dance')) return 'ice_dance';
  return null;
}

function parseLevel(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('senior')) return 'senior';
  if (s.includes('junior')) return 'junior';
  if (s.includes('novice')) return 'novice';
  if (s.includes('intermediate') || s === 'int') return 'intermediate';
  if (s.includes('pre') && s.includes('juvenile')) return 'pre_juvenile';
  if (s.includes('juvenile')) return 'juvenile';
  if (s.includes('adult')) return 'adult';
  return null;
}

function parseHeight(raw) {
  if (!raw) return null;
  const cm = raw.match(/(\d+)\s*cm/i);
  if (cm) return parseFloat(cm[1]);
  const ftIn = raw.match(/(\d+)'(\d+)"/);
  if (ftIn) return Math.round((parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54);
  return null;
}

function parseLocation(raw) {
  if (!raw) return { city: null, state: null, country: 'US' };
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts.slice(2).join(', ') };
  if (parts.length === 2) return { city: parts[0], state: null, country: parts[1] };
  return { city: null, state: null, country: parts[0] };
}

function parseBio(html, id) {
  function getField(label) {
    // Match <td>Label</td><th ...>Value</th> directly
    const re = new RegExp(`<td[^>]*>${label}<\\/td>\\s*<th[^>]*>([^<]+)<\\/th>`, 'i');
    const m = html.match(re);
    return m ? m[1].replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim() : null;
  }

  // Name is in <h1> or page title
  const h1Match    = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleMatch = html.match(/<title>([^<]+?) - Ice Partner Search<\/title>/i);
  const name = h1Match?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? null;

  const wantsBlock = html.match(/Wants to compete[\s\S]*?<\/td>/i)?.[0] ?? '';
  const disciplineRaw = wantsBlock.match(/<b>(Pairs|Dance)<\/b>/i)?.[1] ?? null;
  const discipline = parseDiscipline(disciplineRaw);

  const levelMatches = [...wantsBlock.matchAll(/<(?:div|b)[^>]*><b>(Senior|Junior|Novice|Intermediate|Juvenile|Pre-Juvenile|Adult)<\/b>/gi)];
  const LEVEL_ORDER = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];
  let skating_level = null;
  let bestIdx = -1;
  for (const m of levelMatches) {
    const norm = parseLevel(m[1]);
    if (norm) {
      const idx = LEVEL_ORDER.indexOf(norm);
      if (idx > bestIdx) { bestIdx = idx; skating_level = norm; }
    }
  }

  const genderRaw = getField('Gender');
  const partner_role = genderRaw === 'Female' ? 'lady' : genderRaw === 'Male' ? 'man' : 'either';
  const height_cm   = parseHeight(getField('Height'));
  const { city, state, country } = parseLocation(getField('Location'));
  const contact_note = getField('Email') ?? getField('Telephone #') ?? null;
  const ageRaw = getField('Age');
  const age = ageRaw ? parseInt(ageRaw, 10) || null : null;

  return {
    name,
    discipline,
    skating_level,
    partner_role,
    height_cm,
    location_city: city,
    location_state: state,
    location_country: country ?? 'US',
    age,
    contact_note,
    source: 'icepartnersearch',
    source_url: `${IPS_BASE}/showbio.php?i=${id}`,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Puppeteer login — returns cookie string for fetch()
// ---------------------------------------------------------------------------

async function loginAndGetCookies() {
  console.log('Launching Puppeteer for IPS login...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      protocolTimeout: 120000,
    });
  } catch (err) {
    console.warn(`  Puppeteer launch failed: ${err.message} -- proceeding without login`);
    return '';
  }

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(15000);

  // Common login form selectors
  const emailSel  = 'input[type="email"], input[name="email"], input[name="username"], input[id="email"]';
  const passSel   = 'input[type="password"]';
  const submitSel = 'button[type="submit"], input[type="submit"]';

  let loggedIn = false;
  let cookieStr = '';

  try {
    // Try navigating to a known login page directly
    const loginPaths = ['/login.php', '/member_login.php', '/login', '/members/login', '/'];
    for (const path of loginPaths) {
      try {
        await page.goto(`${IPS_BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const emailInput = await page.$(emailSel).catch(() => null);
        if (emailInput) break; // found a page with a login form
      } catch { continue; }
    }

    const emailInput = await page.$(emailSel).catch(() => null);
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(IPS_EMAIL, { delay: 30 });
      await page.type(passSel, IPS_PASSWORD, { delay: 30 });

      const submitBtn = await page.$(submitSel).catch(() => null);
      if (submitBtn) {
        await Promise.all([
          submitBtn.click(),
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
        ]);
      } else {
        await Promise.all([
          page.keyboard.press('Enter'),
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
        ]);
      }

      loggedIn = true;
      console.log(`  Logged in as ${IPS_EMAIL}`);
    } else {
      console.log('  No login form found -- proceeding with public access');
    }

    const cookies = await page.cookies();
    cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (err) {
    console.warn(`  Login attempt failed: ${err.message} -- proceeding without login`);
  }

  await browser.close().catch(() => {});

  if (!loggedIn) {
    console.log('  Using public (unauthenticated) scrape');
  }

  return cookieStr;
}

// ---------------------------------------------------------------------------
// Step 2: Collect bio IDs (search pages)
// ---------------------------------------------------------------------------

async function collectBioIds(cookieStr) {
  const headers = {
    'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)',
    ...(cookieStr ? { Cookie: cookieStr } : {}),
  };

  const searchUrls = [
    `${IPS_BASE}/searchbyqualities.php?submit=1&discipline=Pairs`,
    `${IPS_BASE}/searchbyqualities.php?submit=1&discipline=Dance`,
    `${IPS_BASE}/searchbyqualities.php?submit=1`,
    `${IPS_BASE}/search`,
    `${IPS_BASE}/skaters`,
    `${IPS_BASE}/browse`,
    `${IPS_BASE}/listings`,
  ];

  const ids = new Set();
  for (const url of searchUrls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = html.match(/showbio\.php\?i=(\d+)/g) ?? [];
      for (const m of matches) {
        const id = m.match(/\d+/)?.[0];
        if (id) ids.add(id);
      }
      await sleep(400);
    } catch { /* ignore unreachable alternate paths */ }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Step 3+4: Fetch each bio, parse, cross-reference athletes table
// ---------------------------------------------------------------------------

async function fetchHtml(url, cookieStr) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function findMatchingAthlete(name) {
  // ilike search on first name token
  const firstName = name.split(/\s+/)[0];
  const url = `${SUPABASE_URL}/rest/v1/athletes?name=ilike.*${encodeURIComponent(firstName)}*&select=id,name,search_status&limit=50`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();

  let best = null;
  let bestSim = 0;
  for (const row of rows ?? []) {
    const sim = similarity(name, row.name);
    if (sim > bestSim) { bestSim = sim; best = row; }
  }
  return bestSim >= 0.85 ? best : null;
}

async function updateSearchStatus(athleteId) {
  await fetch(`${SUPABASE_URL}/rest/v1/athletes?id=eq.${athleteId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ search_status: 'active' }),
  });
}

async function insertAthlete(record) {
  const athlete = {
    name: record.name,
    discipline: record.discipline,
    skating_level: record.skating_level,
    partner_role: record.partner_role ?? 'either',
    height_cm: record.height_cm,
    location_city: record.location_city,
    location_state: record.location_state,
    location_country: record.location_country ?? 'US',
    age: record.age,
    source: record.source,
    source_url: record.source_url,
    search_status: 'active',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/athletes?on_conflict=source_url`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(athlete),
  });
  if (!res.ok) {
    const t = await res.text();
    if (!t.includes('23505') && !t.includes('duplicate')) {
      throw new Error(`Insert failed: ${t}`);
    }
  }

  // Score new athlete against existing ones
  const text = await res.text().catch(() => '');
  let newId = null;
  try {
    const parsed = JSON.parse(text);
    newId = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
  } catch { /* no id */ }

  if (newId) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/score_new_athlete`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_athlete_id: newId }),
    }).catch(err => console.warn(`    Score RPC failed: ${err.message}`));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Step 1: Login
  const cookieStr = await loginAndGetCookies();

  // Step 2: Collect bio IDs
  console.log('\nCollecting IPS skater listing...');
  const ids = await collectBioIds(cookieStr);

  if (ids.length === 0) {
    console.log('No bio IDs found -- IPS may be fully login-gated or empty. Exiting.');
    process.exit(0);
  }
  console.log(`Found ${ids.length} profiles on IPS`);

  // Step 3+4: Fetch each bio and cross-reference
  let totalScraped   = 0;
  let matched        = 0;
  let inserted       = 0;
  let unparseable    = 0;
  let errors         = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const bioUrl = `${IPS_BASE}/showbio.php?i=${id}`;

    await sleep(DELAY_MS);

    let html;
    try {
      html = await fetchHtml(bioUrl, cookieStr);
    } catch (err) {
      console.warn(`  [skip] bio ${id}: ${err.message}`);
      errors++;
      continue;
    }

    const record = parseBio(html, id);
    totalScraped++;

    if (!record.name) {
      unparseable++;
      continue;
    }

    if (!record.discipline) {
      // Not pairs or ice dance -- skip
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] ${record.name} | ${record.discipline} | ${record.skating_level ?? 'no level'} | ${record.location_state ?? record.location_country ?? 'unknown'}`);
      continue;
    }

    // Skip new-insert if required fields are missing (existing matched athletes update regardless)
    const canInsert = !!record.skating_level;

    // Cross-reference athletes table
    let matchedAthlete = null;
    try {
      matchedAthlete = await findMatchingAthlete(record.name);
    } catch (err) {
      console.warn(`  [error] lookup for ${record.name}: ${err.message}`);
      errors++;
      continue;
    }

    if (matchedAthlete) {
      // Athlete already exists -- ensure they show as actively searching
      if (matchedAthlete.search_status !== 'active') {
        await updateSearchStatus(matchedAthlete.id).catch(() => {});
        console.log(`  [matched] ${record.name} -> id=${matchedAthlete.id} (set active)`);
      } else {
        console.log(`  [matched] ${record.name} -> id=${matchedAthlete.id} (already active)`);
      }
      matched++;
    } else if (canInsert) {
      // New athlete -- insert
      try {
        await insertAthlete(record);
        console.log(`  [new]     ${record.name} | ${record.discipline} | ${record.skating_level} | ${record.location_state ?? record.location_country}`);
        inserted++;
      } catch (err) {
        console.error(`  [error] insert ${record.name}: ${err.message}`);
        errors++;
      }
    } else {
      console.log(`  [skip]    ${record.name} | no skating level on IPS profile`);
      unparseable++;
    }
  }

  // Step 5: Summary
  console.log('\n--- IPS Scrape Summary ---');
  console.log(`Total scraped:  ${totalScraped}`);
  console.log(`Matched:        ${matched}`);
  console.log(`New:            ${inserted}`);
  console.log(`Unparseable:    ${unparseable}`);
  console.log(`Errors:         ${errors}`);
  if (DRY_RUN) console.log('(dry run -- no DB writes)');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
