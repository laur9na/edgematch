/**
 * scripts/scrape_ips.js
 *
 * Scrapes IcePartnerSearch for pairs and ice dance athletes actively
 * looking for partners. Upserts into raw_athletes, promotes validated
 * profiles to athletes, and scores new athletes against all existing ones.
 *
 * Deduplication: keyed on source_url (IPS bio URL). Profiles already in
 * raw_athletes are skipped. Existing athletes with a matching source_url
 * are updated (name/level/height may change over time).
 *
 * Usage:
 *   node scripts/scrape_ips.js
 *   node scripts/scrape_ips.js --dry-run
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
const IPS_BASE     = 'https://icepartnersearch.com';
const DELAY_MS     = 1500;
const DRY_RUN      = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Parsers
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

/** Collect all bio IDs from the IPS search results page */
async function collectBioIds() {
  // Try pairs first, then ice dance
  const urls = [
    `${IPS_BASE}/searchbyqualities.php?submit=1&discipline=Pairs`,
    `${IPS_BASE}/searchbyqualities.php?submit=1&discipline=Dance`,
    `${IPS_BASE}/searchbyqualities.php?submit=1`,
  ];

  const ids = new Set();
  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const matches = html.match(/showbio\.php\?i=(\d+)/g) ?? [];
      for (const m of matches) {
        const id = m.match(/\d+/)?.[0];
        if (id) ids.add(id);
      }
      await sleep(500);
    } catch (err) {
      console.warn(`  Warning: could not fetch ${url}: ${err.message}`);
    }
  }
  return [...ids];
}

/** Parse a single IPS bio page */
function parseBio(html, id) {
  function getField(label) {
    const re = new RegExp(`${label}[\\s\\S]*?<th[^>]*>([^<]+)<\\/th>`, 'i');
    const m = html.match(re);
    return m ? m[1].replace(/\u00a0/g, ' ').trim() : null;
  }

  const nameMatch = html.match(/<div[^>]*class="title"[^>]*><a[^>]*>([^<]+)<\/a>/i);
  const name = nameMatch?.[1]?.trim() ?? null;

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
    review_flag: !discipline || !skating_level || !height_cm || !name,
    promoted: false,
  };
}

// ---------------------------------------------------------------------------
// DB helpers (raw REST — no supabase-js dep needed)
// ---------------------------------------------------------------------------

async function dbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`);
  return res.json();
}

async function dbPost(path, body, prefer = 'resolution=ignore-duplicates,return=minimal') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST ${path}: HTTP ${res.status} — ${t}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function dbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${path}: HTTP ${res.status} — ${t}`);
  }
}

async function rpc(fn, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`RPC ${fn}: HTTP ${res.status} — ${t}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Collecting IcePartnerSearch bio IDs...');
  let ids;
  try {
    ids = await collectBioIds();
  } catch (err) {
    console.error(`Failed to collect bio IDs: ${err.message}`);
    console.error('IPS may be login-gated. Exiting cleanly.');
    process.exit(0);
  }

  if (ids.length === 0) {
    console.log('No bio IDs found — IPS may be login-gated or empty. Exiting.');
    process.exit(0);
  }
  console.log(`Found ${ids.length} profiles on IPS`);

  // Load existing source_urls to skip already-known athletes
  const existing = await dbGet('raw_athletes?select=source_url&source=eq.icepartnersearch&limit=5000');
  const knownUrls = new Set((existing ?? []).map(r => r.source_url));
  console.log(`Already have ${knownUrls.size} IPS athletes in raw_athletes`);

  let scraped = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const sourceUrl = `${IPS_BASE}/showbio.php?i=${id}`;

    if (knownUrls.has(sourceUrl)) {
      skipped++;
      continue;
    }

    await sleep(DELAY_MS);

    let html;
    try {
      html = await fetchHtml(sourceUrl);
    } catch (err) {
      console.warn(`  [skip] bio ${id}: ${err.message}`);
      errors++;
      continue;
    }

    const record = parseBio(html, id);
    scraped++;

    if (!record.name) {
      console.log(`  [skip] bio ${id}: no name found`);
      continue;
    }

    // Only pairs and ice dance
    if (!record.discipline) {
      continue;
    }

    console.log(`  [new]  ${record.name} | ${record.discipline} | ${record.skating_level ?? 'unknown level'} | ${record.location_state ?? record.location_country}`);

    if (!DRY_RUN) {
      try {
        await dbPost('raw_athletes', record);
        inserted++;
      } catch (err) {
        if (!err.message.includes('23505') && !err.message.includes('duplicate')) {
          console.error(`    Insert error: ${err.message}`);
          errors++;
        }
      }
    } else {
      inserted++;
    }
  }

  console.log(`\nScrape complete: ${scraped} new profiles fetched, ${inserted} inserted, ${skipped} already known, ${errors} errors`);

  if (DRY_RUN) { console.log('(dry run — no DB writes)'); return; }

  // Promote validated raw_athletes to athletes table
  console.log('\nPromoting validated raw athletes...');
  const unpromoted = await dbGet(
    'raw_athletes?promoted=eq.false&review_flag=eq.false&discipline=not.is.null&skating_level=not.is.null&height_cm=not.is.null&name=not.is.null&source=eq.icepartnersearch&limit=500'
  );

  let promoted = 0;
  let scored = 0;

  for (const raw of unpromoted ?? []) {
    const athlete = {
      name: raw.name,
      discipline: raw.discipline,
      skating_level: raw.skating_level,
      partner_role: raw.partner_role ?? 'either',
      height_cm: raw.height_cm,
      location_city: raw.location_city,
      location_state: raw.location_state,
      location_country: raw.location_country ?? 'US',
      age: raw.age,
      source: raw.source,
      source_url: raw.source_url,
      search_status: 'active',
    };

    try {
      // Insert athlete; if duplicate source_url exists, skip
      const newAthletes = await dbPost(
        'athletes?on_conflict=source_url',
        athlete,
        'resolution=ignore-duplicates,return=representation'
      );

      const newAthlete = Array.isArray(newAthletes) ? newAthletes[0] : newAthletes;
      if (newAthlete?.id) {
        // Mark raw as promoted
        await dbPatch(`raw_athletes?id=eq.${raw.id}`, { promoted: true });
        promoted++;

        // Score against all existing athletes
        try {
          await rpc('score_new_athlete', { new_athlete_id: newAthlete.id });
          scored++;
          console.log(`  Promoted + scored: ${raw.name}`);
        } catch (scoreErr) {
          console.warn(`  Promoted but score failed for ${raw.name}: ${scoreErr.message}`);
        }
      }
    } catch (err) {
      console.error(`  Promote error for ${raw.name}: ${err.message}`);
    }
  }

  console.log(`\nPromotion complete: ${promoted} athletes added, ${scored} scored`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
