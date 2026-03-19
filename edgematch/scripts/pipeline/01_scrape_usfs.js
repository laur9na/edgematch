/**
 * scripts/pipeline/01_scrape_usfs.js
 * Scrapes USFS IJS competition results and upserts into competition_results.
 * Wraps scripts/scrape_results.js with --source=usfs filter.
 * Usage: node scripts/pipeline/01_scrape_usfs.js [--dry-run]
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const args = ['scripts/scrape_results.js', '--source=usfs', ...process.argv.slice(2)];
const result = spawnSync('node', args, { cwd: root, stdio: 'inherit' });

if (result.status !== 0) process.exit(result.status ?? 1);
