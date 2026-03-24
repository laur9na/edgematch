/**
 * scripts/create_storage_bucket.js : Phase 15.5
 *
 * Creates the athlete-media storage bucket in Supabase using the service role key.
 * Safe to run multiple times : no-ops if bucket already exists.
 *
 * Usage: node scripts/create_storage_bucket.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
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

const BUCKET = 'athlete-media';

async function run() {
  // Check if bucket already exists
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error('Failed to list buckets:', listErr.message);
    process.exit(1);
  }

  const exists = (buckets || []).some(b => b.name === BUCKET);

  if (exists) {
    console.log(`[OK] Bucket "${BUCKET}" already exists.`);
    return;
  }

  // Create bucket : public: false (signed URLs for private access)
  const { data, error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  });

  if (error) {
    console.error(`Failed to create bucket "${BUCKET}":`, error.message);
    process.exit(1);
  }

  console.log(`[OK] Bucket "${BUCKET}" created successfully.`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
