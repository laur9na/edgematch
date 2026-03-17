/**
 * scripts/run_migrations.js — Phase 8.5
 *
 * Applies instagram_handle, profile_photo_url, media_urls columns to athletes table.
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Approach:
 *   1. Check if columns already exist (if so, done).
 *   2. Try supabase db push via CLI (requires SUPABASE_ACCESS_TOKEN env var or `supabase login`).
 *   3. If unavailable, print the one command needed to apply manually.
 *
 * Usage: node scripts/run_migrations.js
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function columnsExist() {
  const { error } = await supabase
    .from('athletes')
    .select('instagram_handle, profile_photo_url, media_urls')
    .limit(1);
  return !error;
}

async function applyViaCLI() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;

  try {
    execSync('supabase db push --linked', {
      cwd: ROOT,
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log('Checking columns...');

  if (await columnsExist()) {
    console.log('[OK] instagram_handle, profile_photo_url, media_urls already exist on athletes.');
    return;
  }

  console.log('Columns missing. Attempting supabase db push...');

  const ok = await applyViaCLI();
  if (ok) {
    console.log('[OK] Migration applied via CLI.');
    if (await columnsExist()) {
      console.log('[VERIFIED] Columns confirmed present.');
    }
    return;
  }

  // Note: service_role key cannot run DDL via PostgREST (by design in Supabase).
  // DDL requires either:
  //   a) SUPABASE_ACCESS_TOKEN env var + `supabase db push --linked`
  //   b) Direct postgres connection with the DB password
  //   c) Supabase dashboard SQL editor

  console.error('\n[BLOCKED] Cannot apply migration automatically without CLI auth or DB password.');
  console.error('Migration file is ready at: supabase/migrations/010_athlete_media.sql');
  console.error('\nTo apply, run ONE of:');
  console.error('  1. supabase login && supabase db push --linked');
  console.error('  2. Paste supabase/migrations/010_athlete_media.sql into Supabase Dashboard > SQL Editor');
  process.exit(1);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
