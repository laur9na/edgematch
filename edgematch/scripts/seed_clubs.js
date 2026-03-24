/**
 * scripts/seed_clubs.js : Phase 12.2
 *
 * 1. SELECT DISTINCT club_name FROM athletes WHERE club_name IS NOT NULL
 * 2. For each unique name: insert into clubs if not already there
 * 3. UPDATE athletes SET club_id = [id] WHERE club_name = [name]
 *
 * Usage: node scripts/seed_clubs.js
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

async function run() {
  // 1. Get all distinct club_names from athletes
  const { data: rows, error: fetchErr } = await supabase
    .from('athletes')
    .select('club_name')
    .not('club_name', 'is', null);

  if (fetchErr) {
    console.error('Failed to fetch athletes:', fetchErr.message);
    process.exit(1);
  }

  // Deduplicate case-insensitively, keep original casing from first occurrence
  const seen = new Map();
  for (const { club_name } of rows) {
    const key = club_name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, club_name.trim());
  }
  const uniqueNames = [...seen.values()];
  console.log(`Found ${uniqueNames.length} unique club name(s) across ${rows.length} athletes`);

  // 2. Load existing clubs to avoid duplicates
  const { data: existingClubs, error: clubsErr } = await supabase
    .from('clubs')
    .select('id, name');

  if (clubsErr) {
    console.error('Failed to fetch clubs:', clubsErr.message);
    process.exit(1);
  }

  const existingByName = new Map(
    (existingClubs || []).map(c => [c.name.trim().toLowerCase(), c.id])
  );

  let created = 0;
  let linked = 0;

  for (const name of uniqueNames) {
    const key = name.toLowerCase();

    let clubId = existingByName.get(key);

    // Insert if new
    if (!clubId) {
      const { data: inserted, error: insertErr } = await supabase
        .from('clubs')
        .insert({ name })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`  Insert failed for "${name}": ${insertErr.message}`);
        continue;
      }
      clubId = inserted.id;
      existingByName.set(key, clubId);
      created++;
      console.log(`  Created club: "${name}" (${clubId})`);
    } else {
      console.log(`  Existing club: "${name}" (${clubId})`);
    }

    // 3. Link all athletes with this club_name (case-insensitive)
    // Supabase doesn't support ilike on update filter easily, so handle both cases
    const variants = [name, name.toLowerCase(), name.toUpperCase(),
      name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
    // Use ilike via raw approach : just match all rows and filter in JS
    const { data: toLink, error: linkFetchErr } = await supabase
      .from('athletes')
      .select('id, club_name')
      .not('club_name', 'is', null);

    if (linkFetchErr) {
      console.error(`  Fetch athletes for link failed: ${linkFetchErr.message}`);
      continue;
    }

    const matching = (toLink || []).filter(
      a => a.club_name.trim().toLowerCase() === key
    );

    for (const athlete of matching) {
      const { error: updateErr } = await supabase
        .from('athletes')
        .update({ club_id: clubId })
        .eq('id', athlete.id);

      if (updateErr) {
        console.error(`  Link athlete ${athlete.id} failed: ${updateErr.message}`);
      } else {
        linked++;
      }
    }
    console.log(`  Linked ${matching.length} athlete(s) to "${name}"`);
  }

  console.log(`\nDone. Clubs created: ${created}, Athletes linked: ${linked}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
