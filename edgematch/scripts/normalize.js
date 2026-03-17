/**
 * scripts/normalize.js — Phase 0.2
 *
 * Reads supabase/seed/raw_icepartnersearch.json → applies normalization rules
 * from PLAN.md → writes:
 *   - supabase/seed/athletes.csv        (for human inspection / import)
 *   - supabase/seed/normalized.json     (used by 002_seed.sql generator & score_all.js)
 *
 * Also logs any deduplicated records and merge counts.
 *
 * Decision: normalize.js is offline (no DB connection required). Insertion into
 * raw_athletes table happens via 002_seed.sql (step 0.4) against a live Supabase
 * instance. This keeps the pipeline runnable without credentials at every step.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_PATH   = join(__dirname, '../supabase/seed/raw_icepartnersearch.json');
const NORM_PATH  = join(__dirname, '../supabase/seed/normalized.json');
const CSV_PATH   = join(__dirname, '../supabase/seed/athletes.csv');

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Height → cm. Handles "5'2\"", "5'2", "62\"", "157cm", "157 cm", numbers. */
function normalizeHeight(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();

  // Already cm value (e.g., "157cm" or "157")
  const cmOnly = s.match(/^(\d+(?:\.\d+)?)\s*cm$/i);
  if (cmOnly) return parseFloat(cmOnly[1]);

  // ft'in" like 5'2" or 5'2
  const ftIn = s.match(/^(\d+)'(\d+)"?$/);
  if (ftIn) return Math.round((parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54);

  // Total inches like 62"
  const totalIn = s.match(/^(\d+)"$/);
  if (totalIn) return Math.round(parseInt(totalIn[1]) * 2.54);

  // Bare number — assume cm if >= 100, else feet (edge case)
  const num = parseFloat(s);
  if (!isNaN(num)) return num >= 100 ? num : null;

  return null;
}

/** Weight → kg. Handles "50kg", "110lbs", numbers. */
function normalizeWeight(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  const kg = s.match(/^(\d+(?:\.\d+)?)\s*kg$/i);
  if (kg) return parseFloat(kg[1]);
  const lbs = s.match(/^(\d+(?:\.\d+)?)\s*lbs$/i);
  if (lbs) return Math.round(parseFloat(lbs[1]) * 0.453592 * 10) / 10;
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

/**
 * Skating level mapping per PLAN.md.
 * Returns one of: pre_juvenile | juvenile | intermediate | novice | junior | senior | adult
 */
function normalizeLevel(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'pre_juvenile' || s === 'pre-juvenile' || s === 'pre juvenile') return 'pre_juvenile';
  if (s === 'juvenile' || s === 'juv') return 'juvenile';
  if (s === 'intermediate' || s === 'int') return 'intermediate';
  if (s === 'novice' || s === 'nov') return 'novice';
  if (s === 'junior' || s === 'jun') return 'junior';
  if (s === 'senior' || s === 'sen') return 'senior';
  if (s === 'adult') return 'adult';
  return null;
}

/**
 * Discipline mapping per PLAN.md.
 */
function normalizeDiscipline(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'pairs' || s === 'pairs skating') return 'pairs';
  if (s === 'ice_dance' || s === 'ice dancing' || s === 'ice dance' || s === 'dance') return 'ice_dance';
  if (s === 'synchro' || s.includes('synchronized') || s.includes('synchro')) return null;
  if (s === 'singles') return 'singles';
  return null;
}

/** Normalize a name for deduplication: lowercase, collapse whitespace, strip punctuation. */
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Main normalization pass
// ---------------------------------------------------------------------------

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
console.log(`Read ${raw.length} raw records`);

const normalized = [];
const parseWarnings = [];

for (const rec of raw) {
  const height_cm  = normalizeHeight(rec.height_cm);
  const weight_kg  = normalizeWeight(rec.weight_kg);
  const skating_level = normalizeLevel(rec.skating_level);
  const discipline    = normalizeDiscipline(rec.discipline);

  // review_flag: true if any required field is missing or normalization failed
  const review_flag =
    !discipline || !skating_level || !height_cm || !rec.name;

  if (review_flag) {
    parseWarnings.push({
      source_url: rec.source_url,
      name: rec.name,
      missing: [
        !rec.name        && 'name',
        !discipline      && 'discipline',
        !skating_level   && 'skating_level',
        !height_cm       && 'height_cm',
      ].filter(Boolean),
    });
  }

  normalized.push({
    name:             rec.name ?? null,
    discipline,
    skating_level,
    partner_role:     rec.partner_role ?? 'either',
    height_cm,
    weight_kg,
    location_city:    rec.location_city ?? null,
    location_state:   rec.location_state ?? null,
    location_country: rec.location_country ?? 'US',
    age:              typeof rec.age === 'number' ? rec.age : null,
    contact_note:     rec.contact_note ?? null,
    source:           'icepartnersearch',
    source_url:       rec.source_url,
    review_flag,
    scraped_at:       rec.scraped_at,
    // internal dedup key — not written to DB
    _name_normalized: normalizeName(rec.name),
  });
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------
// Key: name_normalized + location_state + discipline
// Strategy: keep most recently scraped; log merges.

const seen = new Map();
const deduped = [];
let mergeCount = 0;

for (const rec of normalized) {
  const key = `${rec._name_normalized}|${rec.location_state ?? ''}|${rec.discipline ?? ''}`;
  if (seen.has(key)) {
    const existing = seen.get(key);
    if (rec.scraped_at > existing.scraped_at) {
      console.log(`  MERGE: keeping newer record for "${rec.name}" (${rec.source_url})`);
      seen.set(key, rec);
    } else {
      console.log(`  MERGE: dropping older duplicate for "${rec.name}" (${rec.source_url})`);
    }
    mergeCount++;
  } else {
    seen.set(key, rec);
  }
}

for (const rec of seen.values()) {
  const { _name_normalized, ...clean } = rec;
  deduped.push(clean);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

writeFileSync(NORM_PATH, JSON.stringify(deduped, null, 2));
console.log(`\nNormalized: ${deduped.length} records written to ${NORM_PATH}`);

// CSV — columns match raw_athletes table
const CSV_COLS = [
  'name', 'discipline', 'skating_level', 'partner_role',
  'height_cm', 'weight_kg',
  'location_city', 'location_state', 'location_country',
  'age', 'contact_note', 'source', 'source_url', 'review_flag', 'scraped_at',
];

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const csvLines = [
  CSV_COLS.join(','),
  ...deduped.map((r) => CSV_COLS.map((c) => csvEscape(r[c])).join(',')),
];
writeFileSync(CSV_PATH, csvLines.join('\n'));
console.log(`CSV written to ${CSV_PATH}`);

// Summary
console.log(`\nSummary:`);
console.log(`  Total raw records:   ${raw.length}`);
console.log(`  Duplicates merged:   ${mergeCount}`);
console.log(`  Final records:       ${deduped.length}`);
console.log(`  Flagged for review:  ${deduped.filter(r => r.review_flag).length}`);

const byDiscipline = {};
const byLevel = {};
for (const r of deduped) {
  byDiscipline[r.discipline ?? 'null'] = (byDiscipline[r.discipline ?? 'null'] ?? 0) + 1;
  byLevel[r.skating_level ?? 'null'] = (byLevel[r.skating_level ?? 'null'] ?? 0) + 1;
}
console.log(`\n  By discipline:`, byDiscipline);
console.log(`  By level:     `, byLevel);

if (parseWarnings.length) {
  console.log(`\nRecords with missing required fields:`);
  for (const w of parseWarnings) {
    console.log(`  ${w.name ?? '(unnamed)'} — missing: ${w.missing.join(', ')} — ${w.source_url}`);
  }
}
