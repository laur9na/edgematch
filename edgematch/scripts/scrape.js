/**
 * scripts/scrape.js — IcePartnerSearch.com scraper
 *
 * Phase 0.1 of the EdgeMatch build plan.
 *
 * Approach:
 *   1. Fetch the main search results page (no filters) to collect all profile IDs
 *   2. For each ID, fetch the individual bio page and parse all fields
 *   3. Write to supabase/seed/raw_icepartnersearch.json
 *
 * robots.txt check (done manually 2026-03-16):
 *   Disallowed paths are all authenticated/action pages (/editbio.php, /admin/, etc.)
 *   The public listing pages (searchbyqualities.php, showbio.php) are NOT disallowed.
 *
 * Rate limit: 1500ms between requests per plan spec.
 */

import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://icepartnersearch.com';
const DELAY_MS = 1500;
const OUTPUT_PATH = join(__dirname, '../supabase/seed/raw_icepartnersearch.json');

// --- helpers ----------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Parse ft/in or cm height string → cm (numeric or null).
 * Examples: "5'3\" / 160 cm", "160 cm", "5'3\""
 */
function parseHeight(raw) {
  if (!raw) return null;
  // Prefer the cm value if present
  const cmMatch = raw.match(/(\d+)\s*cm/i);
  if (cmMatch) return parseFloat(cmMatch[1]);
  // Fall back to ft/in
  const ftIn = raw.match(/(\d+)'(\d+)"/);
  if (ftIn) return Math.round((parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54);
  const ftOnly = raw.match(/(\d+)'/);
  if (ftOnly) return Math.round(parseInt(ftOnly[1]) * 30.48);
  return null;
}

/**
 * Parse lbs or kg weight string → kg (numeric or null).
 * Example: "112 lbs / 50 kg"
 */
function parseWeight(raw) {
  if (!raw) return null;
  const kgMatch = raw.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1]);
  const lbsMatch = raw.match(/(\d+(?:\.\d+)?)\s*lbs/i);
  if (lbsMatch) return Math.round(parseFloat(lbsMatch[1]) * 0.453592 * 10) / 10;
  return null;
}

/**
 * Map the site's discipline labels to our enum values.
 * The "Wants to compete" block uses "Pairs" / "Dance" labels.
 */
function normalizeDiscipline(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s.includes('pairs')) return 'pairs';
  if (s.includes('dance')) return 'ice_dance';
  if (s.includes('synchro') || s.includes('synchronized')) return 'synchro';
  return null;
}

/**
 * Map the site's level labels to our enum values.
 * Returns the highest level found (site can list multiple).
 */
const LEVEL_ORDER = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];

function normalizeLevel(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s.includes('senior')) return 'senior';
  if (s.includes('junior')) return 'junior';
  if (s.includes('novice')) return 'novice';
  if (s.includes('intermediate') || s === 'int') return 'intermediate';
  if (s.includes('juvenile') && s.includes('pre')) return 'pre_juvenile';
  if (s.includes('juvenile')) return 'juvenile';
  if (s.includes('adult')) return 'adult';
  return null;
}

/**
 * From a list of level strings, return the highest one.
 */
function highestLevel(levels) {
  let best = -1;
  let result = null;
  for (const l of levels) {
    const norm = normalizeLevel(l);
    if (norm) {
      const idx = LEVEL_ORDER.indexOf(norm);
      if (idx > best) {
        best = idx;
        result = norm;
      }
    }
  }
  return result;
}

/**
 * Parse city/state/country from location string like "Oberstdorf, Germany" or
 * "Waukesha, Wisconsin, United States".
 */
function parseLocation(raw) {
  if (!raw) return { city: null, state: null, country: null };
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length === 1) return { city: null, state: null, country: parts[0] };
  if (parts.length === 2) return { city: parts[0], state: null, country: parts[1] };
  if (parts.length >= 3)
    return { city: parts[0], state: parts[1], country: parts.slice(2).join(', ') };
  return { city: null, state: null, country: null };
}

// --- step 1: collect all bio IDs -------------------------------------------

async function collectIds() {
  console.log('Fetching search results to collect bio IDs…');
  const html = await fetchHtml(`${BASE_URL}/searchbyqualities.php?submit=1`);
  const ids = [...new Set(html.match(/showbio\.php\?i=(\d+)/g)?.map((m) => m.match(/\d+/)[0]) ?? [])];
  console.log(`Found ${ids.length} unique profiles`);
  return ids;
}

// --- step 2: parse individual bio page ------------------------------------

function parseBio(html, id) {
  const $ = cheerio.load(html);
  const sourceUrl = `${BASE_URL}/showbio.php?i=${id}`;

  // Helper: find value of a labeled table row
  function getField(label) {
    let result = null;
    $('td').each((_, el) => {
      if ($(el).text().trim() === label) {
        const th = $(el).next('th');
        if (th.length) result = th.text().replace(/\u00a0/g, ' ').trim();
      }
    });
    return result || null;
  }

  // Name from page title or heading
  const name = $('div.title a').first().text().trim() || getField('Name') || null;

  // Discipline + level from "Wants to compete" block
  // The block looks like: <b>Dance</b> at the level(s): <div><b>Junior</b></div><div><b>Senior</b></div>
  const wantsBlock = html.match(/Wants to compete[\s\S]*?<\/td>/i)?.[0] ?? '';
  const disciplineRaw = wantsBlock.match(/<b>(Pairs|Dance|Synchronized|Synchro)<\/b>/i)?.[1] ?? null;
  const discipline = normalizeDiscipline(disciplineRaw);

  // Extract all level labels from the wants block
  const levelMatches = [...wantsBlock.matchAll(/<(?:div|b)[^>]*><b>(Senior|Junior|Novice|Intermediate|Juvenile|Pre-Juvenile|Adult)<\/b>/gi)].map((m) => m[1]);
  // Also grab levels from plain <div><b>...</b></div> pattern
  const levelMatches2 = [...wantsBlock.matchAll(/<div><b>(Senior|Junior|Novice|Intermediate|Juvenile|Pre-Juvenile|Adult)<\/b><\/div>/gi)].map((m) => m[1]);
  const allLevels = [...new Set([...levelMatches, ...levelMatches2])];
  const skating_level = highestLevel(allLevels);

  const genderRaw = getField('Gender');
  // Map to partner_role: Female → lady, Male → man
  const partner_role = genderRaw === 'Female' ? 'lady' : genderRaw === 'Male' ? 'man' : 'either';

  const heightRaw = getField('Height');
  const height_cm = parseHeight(heightRaw);

  const weightRaw = getField('Weight');
  const weight_kg = parseWeight(weightRaw);

  const ageRaw = getField('Age');
  const age = ageRaw ? parseInt(ageRaw, 10) || null : null;

  const locationRaw = getField('Location');
  const { city, state, country } = parseLocation(locationRaw);

  const willRelocate = getField('Will relocate?') ?? null;

  const contact_note = getField('Email') ?? getField('Telephone #') ?? null;

  // Flag for review: missing discipline or level (parser wasn't confident)
  const review_flag = !discipline || !skating_level || !height_cm;

  return {
    name,
    discipline,
    skating_level,
    partner_role,
    height_cm,
    weight_kg,
    location_city: city,
    location_state: state,
    location_country: country ?? 'US',
    age,
    will_relocate: willRelocate,
    contact_note,
    source: 'icepartnersearch',
    source_url: sourceUrl,
    review_flag,
    scraped_at: new Date().toISOString(),
  };
}

// --- main ------------------------------------------------------------------

async function main() {
  const ids = await collectIds();

  const results = [];
  const parseErrors = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const url = `${BASE_URL}/showbio.php?i=${id}`;
    try {
      const html = await fetchHtml(url);
      const record = parseBio(html, id);
      results.push(record);
      const flag = record.review_flag ? ' [REVIEW]' : '';
      console.log(`[${i + 1}/${ids.length}] ${record.name ?? '(unnamed)'} — ${record.discipline ?? '?'} ${record.skating_level ?? '?'}${flag}`);
    } catch (err) {
      console.error(`  PARSE ERROR for ID ${id}: ${err.message}`);
      parseErrors.push({ id, url, error: err.message });
    }

    if (i < ids.length - 1) await sleep(DELAY_MS);
  }

  // Ensure output directory exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  console.log(`\nDone. ${results.length} records written to ${OUTPUT_PATH}`);
  console.log(`Parse errors: ${parseErrors.length}`);
  if (parseErrors.length) {
    console.log('Failed IDs:', parseErrors.map((e) => e.id).join(', '));
  }
  const reviewCount = results.filter((r) => r.review_flag).length;
  console.log(`Records flagged for review: ${reviewCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
