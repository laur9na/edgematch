/**
 * scripts/run_migrations.js : Phase 8.5
 *
 * Applies instagram_handle, profile_photo_url, media_urls columns to athletes table.
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY directly from .env.local.
 * Uses supabase-js with service role key : no CLI, no keychain.
 *
 * Usage: node scripts/run_migrations.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(join(__dirname, '../.env.local'), 'utf8')
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

async function run() {
  // Check if columns already exist
  const { error: checkErr } = await supabase
    .from('athletes')
    .select('instagram_handle, profile_photo_url, media_urls')
    .limit(1);

  if (!checkErr) {
    console.log('[OK] Columns already exist on athletes table.');
    return;
  }

  console.log('Columns missing. Applying migration via REST...');

  // Supabase PostgREST does not support DDL directly.
  // The migration SQL is in supabase/migrations/010_athlete_media.sql.
  // Apply via: supabase db push (after supabase login) OR Supabase dashboard SQL editor.
  const sql = `
    ALTER TABLE athletes
      ADD COLUMN IF NOT EXISTS instagram_handle  text,
      ADD COLUMN IF NOT EXISTS profile_photo_url text,
      ADD COLUMN IF NOT EXISTS media_urls        text[] DEFAULT '{}';
  `;

  // Try calling any available exec RPC
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql });
  if (!rpcErr) {
    console.log('[OK] Migration applied via exec_sql RPC.');
  } else {
    console.log('exec_sql not available (expected). Migration SQL:');
    console.log(sql.trim());
    console.log('\nApply via Supabase dashboard SQL editor or: supabase db push --linked');
  }

  // Re-verify
  const { error: verifyErr } = await supabase
    .from('athletes')
    .select('instagram_handle, profile_photo_url, media_urls')
    .limit(1);

  if (!verifyErr) {
    console.log('[VERIFIED] Columns confirmed present.');
  } else {
    console.log('[PENDING] Columns not yet applied:', verifyErr.message);
  }
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
