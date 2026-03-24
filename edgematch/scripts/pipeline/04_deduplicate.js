/**
 * scripts/pipeline/04_deduplicate.js
 *
 * 1. Computes normalized_name for athletes and competition_results rows where it is null.
 *    normalized_name = lowercase, strip punctuation, collapse whitespace.
 * 2. Finds athlete pairs with Levenshtein similarity > 0.82 (distance < 0.18).
 * 3. For each duplicate pair: keep the row with more competition_results,
 *    copy missing fields from the other, delete the duplicate.
 *
 * Usage: node scripts/pipeline/04_deduplicate.js [--dry-run]
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, '../../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* rely on environment */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN      = process.argv.includes('--dry-run');
const DISTANCE_THRESHOLD = 0.18; // pairs within this edit-distance ratio are duplicates

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeNameStr(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function distanceRatio(a, b) {
  if (!a && !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}

// Merge b's fields into a, preferring a's non-null values
function mergeFields(a, b) {
  const copyableFields = [
    'email', 'age', 'height_cm', 'weight_kg', 'location_city', 'location_state',
    'location_country', 'location_lat', 'location_lng', 'goals', 'training_hours_wk',
    'preferred_level_min', 'preferred_level_max', 'max_distance_km',
    'coach_name', 'club_id', 'club_name', 'instagram_handle', 'profile_photo_url',
    'media_urls', 'is_claimed', 'user_id',
  ];
  const update = {};
  for (const f of copyableFields) {
    if ((a[f] === null || a[f] === undefined || a[f] === '' || a[f] === 0) && b[f]) {
      update[f] = b[f];
    }
  }
  return update;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Pre-flight: check that 012 migration has been applied
  const { error: colCheck } = await supabase
    .from('athletes').select('normalized_name').limit(1);
  if (colCheck?.message?.includes('does not exist')) {
    console.error('Migration 012 not yet applied. Paste supabase/migrations/012_athletes_extend.sql in Supabase SQL editor first.');
    process.exit(1);
  }

  // Step 1: Compute normalized_name for athletes with null
  console.log('Step 1: Computing normalized_name for athletes...');
  const { data: athletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, name, normalized_name, first_name, last_name');
  if (athErr) { console.error('Failed to load athletes:', athErr.message); process.exit(1); }

  let normUpdated = 0;
  const toNormalize = athletes.filter(a => !a.normalized_name && a.name);
  for (const a of toNormalize) {
    const normalized = normalizeNameStr(a.name);
    const parts = a.name.trim().split(/\s+/);
    const firstName = parts[0] ?? null;
    const lastName  = parts.length > 1 ? parts[parts.length - 1] : null;
    if (!DRY_RUN) {
      await supabase.from('athletes').update({
        normalized_name: normalized,
        first_name: a.first_name ?? firstName,
        last_name:  a.last_name  ?? lastName,
      }).eq('id', a.id);
    }
    normUpdated++;
  }
  console.log(`  Updated normalized_name for ${normUpdated} athlete(s).`);

  // Step 2: Compute normalized_name for competition_results with null
  console.log('Step 2: Computing normalized_name for competition_results...');
  const { data: results, error: resErr } = await supabase
    .from('competition_results')
    .select('id, skater_name, normalized_name')
    .is('normalized_name', null);
  if (resErr) { console.error('Failed to load competition_results:', resErr.message); process.exit(1); }

  let resNormUpdated = 0;
  const BATCH = 100;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    if (!DRY_RUN) {
      for (const r of batch) {
        await supabase.from('competition_results')
          .update({ normalized_name: normalizeNameStr(r.skater_name) })
          .eq('id', r.id);
      }
    }
    resNormUpdated += batch.length;
  }
  console.log(`  Updated normalized_name for ${resNormUpdated} result row(s).`);

  // Step 3: Reload athletes with their normalized names and result counts
  console.log('Step 3: Finding duplicate athlete pairs...');
  const { data: allAthletes } = await supabase
    .from('athletes')
    .select('id, name, normalized_name, discipline, skating_level');

  // Count competition_results per athlete
  const { data: countRows } = await supabase
    .from('competition_results')
    .select('athlete_id');
  const resultCount = {};
  for (const r of countRows ?? []) {
    if (r.athlete_id) resultCount[r.athlete_id] = (resultCount[r.athlete_id] || 0) + 1;
  }

  // Build list with normalized names
  const pool = (allAthletes ?? []).filter(a => a.normalized_name);
  let duplicatePairs = 0;
  let deleted = 0;

  // O(n^2) pairwise comparison (acceptable for current athlete count ~700)
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (a.discipline && b.discipline && a.discipline !== b.discipline) continue;

      const ratio = distanceRatio(a.normalized_name, b.normalized_name);
      if (ratio > DISTANCE_THRESHOLD) continue;

      duplicatePairs++;
      const aCount = resultCount[a.id] ?? 0;
      const bCount = resultCount[b.id] ?? 0;

      // Keep the one with more results; if tied, keep the one claimed or older (id sort)
      const [keep, drop] = aCount >= bCount ? [a, b] : [b, a];

      console.log(`  Duplicate: "${keep.name}" (${aCount} results) vs "${drop.name}" (${bCount} results) : ratio ${ratio.toFixed(3)}`);
      console.log(`    Keeping ${keep.id}, dropping ${drop.id}`);

      if (!DRY_RUN) {
        // Load full records to merge fields
        const { data: keepFull } = await supabase.from('athletes').select('*').eq('id', keep.id).single();
        const { data: dropFull } = await supabase.from('athletes').select('*').eq('id', drop.id).single();

        // Re-link competition_results to the keeper
        await supabase.from('competition_results').update({ athlete_id: keep.id }).eq('athlete_id', drop.id);

        // Re-link tryouts
        await supabase.from('tryouts').update({ requester_id: keep.id }).eq('requester_id', drop.id);
        await supabase.from('tryouts').update({ recipient_id: keep.id }).eq('recipient_id', drop.id);

        // Copy missing fields from dropped into keeper
        if (keepFull && dropFull) {
          const update = mergeFields(keepFull, dropFull);
          if (Object.keys(update).length > 0) {
            await supabase.from('athletes').update(update).eq('id', keep.id);
          }
        }

        // Delete scores for the duplicate
        await supabase.from('compatibility_scores')
          .delete()
          .or(`athlete_a_id.eq.${drop.id},athlete_b_id.eq.${drop.id}`);

        // Delete the duplicate athlete
        await supabase.from('athletes').delete().eq('id', drop.id);
        deleted++;

        // Remove from pool to avoid re-processing
        pool.splice(j, 1);
        j--;
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Athletes with normalized_name updated: ${normUpdated}`);
  console.log(`Results with normalized_name updated:  ${resNormUpdated}`);
  console.log(`Duplicate pairs found: ${duplicatePairs}`);
  console.log(`Duplicates deleted:    ${deleted}${DRY_RUN ? ' (dry-run : no changes made)' : ''}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
