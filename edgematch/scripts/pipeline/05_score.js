/**
 * scripts/pipeline/05_score.js
 *
 * Scores only athlete pairs that have no existing compatibility_score row.
 * Skips re-scoring to avoid overwriting manually corrected scores.
 * Uses the same computeScore logic as src/lib/scorer.js.
 *
 * Usage: node scripts/pipeline/05_score.js [--dry-run]
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { computeScore, SCORE_VERSION } from '../../src/lib/scorer.js';

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
const BATCH_SIZE   = 500;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function canonicalPair(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

async function run() {
  // Graceful preflight: pipeline_runs may not exist until 012 migration applied
  const { error: prCheck } = await supabase.from('pipeline_runs').select('id').limit(0);
  const hasPipelineRuns = !prCheck;

  console.log('Loading active athletes...');
  const { data: athletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, name, discipline, skating_level, partner_role, height_cm, ' +
            'location_lat, location_lng, max_distance_km, search_status, goals')
    .eq('search_status', 'active');
  if (athErr) { console.error('Failed to load athletes:', athErr.message); process.exit(1); }
  console.log(`Loaded ${athletes.length} active athletes.`);

  // Load existing scored pairs into a Set for fast lookup
  console.log('Loading existing compatibility scores...');
  const { data: existing, error: scoreErr } = await supabase
    .from('compatibility_scores')
    .select('athlete_a_id, athlete_b_id');
  if (scoreErr) { console.error('Failed to load scores:', scoreErr.message); process.exit(1); }

  const scoredPairs = new Set(existing.map(s => `${s.athlete_a_id}|${s.athlete_b_id}`));
  console.log(`Existing scored pairs: ${scoredPairs.size}`);

  // Compute new scores for unscored pairs
  const newScores = [];
  let skipped = 0;
  let incompatible = 0;

  for (let i = 0; i < athletes.length; i++) {
    for (let j = i + 1; j < athletes.length; j++) {
      const a = athletes[i], b = athletes[j];
      const [aid, bid] = canonicalPair(a.id, b.id);
      const key = `${aid}|${bid}`;

      if (scoredPairs.has(key)) { skipped++; continue; }

      const scores = computeScore(a, b);
      if (!scores) { incompatible++; continue; }

      newScores.push({
        athlete_a_id:  aid,
        athlete_b_id:  bid,
        height_score:  scores.height,
        level_score:   scores.level,
        role_score:    scores.role,
        location_score: scores.location,
        goals_score:   scores.goals,
        total_score:   scores.total,
        score_version: SCORE_VERSION,
        computed_at:   new Date().toISOString(),
      });
    }
  }

  console.log(`New pairs to score: ${newScores.length} (${skipped} already scored, ${incompatible} incompatible)`);

  if (DRY_RUN) {
    console.log('Dry run — no writes.');
    return newScores.length;
  }

  // Insert in batches
  let inserted = 0;
  const runId = hasPipelineRuns ? await logStart() : null;
  try {
    for (let i = 0; i < newScores.length; i += BATCH_SIZE) {
      const batch = newScores.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('compatibility_scores').insert(batch);
      if (error) {
        console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
      } else {
        inserted += batch.length;
        process.stdout.write(`  Inserted ${inserted}/${newScores.length}\r`);
      }
    }
    console.log(`\nInserted ${inserted} new compatibility scores.`);
    await logFinish(runId, inserted, 'ok');
  } catch (err) {
    await logFinish(runId, inserted, 'error', err.message);
    throw err;
  }

  return inserted;
}

async function logStart() {
  try {
    const { data } = await supabase.from('pipeline_runs')
      .insert({ step: '05_score', status: 'running' }).select('id').single();
    return data?.id ?? null;
  } catch { return null; }
}

async function logFinish(runId, rows, status, error) {
  if (!runId) return;
  try {
    await supabase.from('pipeline_runs')
      .update({ finished_at: new Date().toISOString(), rows_affected: rows, status, error: error ?? null })
      .eq('id', runId);
  } catch { /* log failure is non-fatal */ }
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
