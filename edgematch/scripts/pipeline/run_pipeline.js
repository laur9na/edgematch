/**
 * scripts/pipeline/run_pipeline.js
 *
 * Runs pipeline steps 01-05 in sequence.
 * Each step is logged to pipeline_runs (start/finish/error).
 * Usage: node scripts/pipeline/run_pipeline.js [--dry-run] [--skip-clubs]
 *
 * --dry-run    Pass --dry-run to all steps (no DB writes)
 * --skip-clubs Skip 03_scrape_clubs.js (requires puppeteer)
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const DRY_RUN    = process.argv.includes('--dry-run');
const SKIP_CLUBS = process.argv.includes('--skip-clubs');

const extraArgs = DRY_RUN ? ['--dry-run'] : [];

const steps = [
  { name: '01_scrape_usfs', file: '01_scrape_usfs.js' },
  { name: '02_scrape_isu',  file: '02_scrape_isu.js' },
  { name: '03_scrape_clubs',file: '03_scrape_clubs.js', skip: SKIP_CLUBS },
  { name: '04_deduplicate', file: '04_deduplicate.js' },
  { name: '05_score',       file: '05_score.js' },
];

const pad = (s, n) => s.padEnd(n, ' ');

console.log(`\nEdgeMatch pipeline starting${DRY_RUN ? ' [dry-run]' : ''}...\n`);

const results = [];
const startAll = Date.now();

for (const step of steps) {
  if (step.skip) {
    console.log(`[SKIP] ${step.name}`);
    results.push({ name: step.name, status: 'skipped' });
    continue;
  }

  console.log(`[START] ${step.name}`);
  const t0 = Date.now();

  const result = spawnSync('node', [join(__dirname, step.file), ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const status = result.status === 0 ? 'ok' : 'error';
  console.log(`[${status.toUpperCase()}] ${step.name} (${elapsed}s)\n`);
  results.push({ name: step.name, status, elapsed });

  if (status === 'error') {
    console.error(`Pipeline aborted at step ${step.name}.`);
    break;
  }
}

const totalElapsed = ((Date.now() - startAll) / 1000).toFixed(1);
console.log('\n--- Pipeline Summary ---');
for (const r of results) {
  const icon = r.status === 'ok' ? 'OK  ' : r.status === 'skipped' ? 'SKIP' : 'ERR ';
  console.log(`  ${icon}  ${pad(r.name, 20)}  ${r.elapsed ? r.elapsed + 's' : ''}`);
}
console.log(`Total: ${totalElapsed}s`);

const failed = results.find(r => r.status === 'error');
if (failed) process.exit(1);
