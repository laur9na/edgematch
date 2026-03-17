/**
 * scripts/verify.js — Phase 0.6
 * Prints row counts and top 10 scores from local JSON files.
 * Run against a live Supabase instance with --live (requires .env.local).
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const norm   = JSON.parse(readFileSync(join(__dirname, '../supabase/seed/normalized.json'), 'utf8'));
const scores = JSON.parse(readFileSync(join(__dirname, '../supabase/seed/compatibility_scores.json'), 'utf8'));

const promoted = norm.filter(r => !r.review_flag && r.name && r.discipline && r.skating_level && r.height_cm);
const flagged  = norm.filter(r => r.review_flag);

console.log('=== Phase 0.6 Verification (offline) ===\n');
console.log('Table counts (apply SQL migrations to Supabase for live counts):');
console.log('  raw_athletes:        ', norm.length,      '  (expect 217)');
console.log('  athletes (promoted): ', promoted.length,  '  (expect 207)');
console.log('  review_flag=true:    ', flagged.length,   '  (expect  10)');
console.log('  compatibility_scores:', scores.length,    '  (expect 12331)');

console.log('\nDiscipline breakdown:');
const byDisc = {};
for (const r of promoted) byDisc[r.discipline] = (byDisc[r.discipline] || 0) + 1;
for (const [k, v] of Object.entries(byDisc)) console.log(`  ${k.padEnd(12)} ${v}`);

console.log('\nLevel breakdown:');
const byLevel = {};
for (const r of promoted) byLevel[r.skating_level] = (byLevel[r.skating_level] || 0) + 1;
const ord = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];
for (const l of ord) if (byLevel[l]) console.log(`  ${l.padEnd(16)} ${byLevel[l]}`);

console.log('\nTop 10 compatibility scores:');
for (const s of scores.slice(0, 10)) {
  const pair = `${s.athlete_a_name} × ${s.athlete_b_name}`;
  console.log(`  ${s.total_score.toFixed(3)} | ${s.discipline.padEnd(9)} | ${pair}`);
}

console.log('\nScore distribution:');
const buckets = { '0.9+': 0, '0.8–0.89': 0, '0.7–0.79': 0, '0.6–0.69': 0, '<0.6': 0 };
for (const s of scores) {
  if (s.total_score >= 0.9) buckets['0.9+']++;
  else if (s.total_score >= 0.8) buckets['0.8–0.89']++;
  else if (s.total_score >= 0.7) buckets['0.7–0.79']++;
  else if (s.total_score >= 0.6) buckets['0.6–0.69']++;
  else buckets['<0.6']++;
}
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(10)} ${v}`);
