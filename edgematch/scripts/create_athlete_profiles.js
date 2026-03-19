/**
 * scripts/create_athlete_profiles.js
 *
 * For every skater in competition_results with athlete_id IS NULL:
 *  1. Check if an athlete with ilike name match already exists — if yes, link and skip.
 *  2. If no match: INSERT into athletes. Only creates profiles for skaters
 *     whose most recent competition is 2023 or newer.
 *     search_status = 'active'  if max event_year >= 2024
 *     search_status = 'paused'  if max event_year == 2023
 *  3. Also creates profiles for partner_name (same club/discipline/level).
 *  4. Calls score_new_athlete(id) RPC for each new athlete.
 *  5. Links all competition_results rows back via athlete_id.
 *
 * Usage: node scripts/create_athlete_profiles.js
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

// Map competition_results.level to skating_level enum
const LEVEL_MAP = {
  pre_juvenile: 'pre_juvenile',
  juvenile:     'juvenile',
  intermediate: 'intermediate',
  novice:       'novice',
  junior:       'junior',
  senior:       'senior',
  adult:        'adult',
  unknown:      'senior', // undetected level in results defaults to senior
};

// Normalize name: "JOHN DOE" or "John DOE" -> "John Doe"
function normalizeName(name) {
  if (!name) return null;
  return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ilike name match against loaded athletes
function findAthleteMatch(name, athletes) {
  const normalized = normalizeName(name).toLowerCase();
  return athletes.find(a => a.name.toLowerCase() === normalized) || null;
}

async function scoreNewAthlete(athleteId) {
  const { error } = await supabase.rpc('score_new_athlete', { new_athlete_id: athleteId });
  if (error) console.warn(`    score_new_athlete(${athleteId}): ${error.message}`);
}

async function run() {
  // Load all current athletes for ilike matching
  const { data: allAthletes, error: athErr } = await supabase
    .from('athletes')
    .select('id, name');
  if (athErr) { console.error('Failed to load athletes:', athErr.message); process.exit(1); }

  console.log(`Loaded ${allAthletes.length} existing athletes for matching.\n`);

  // Get all competition_results rows missing athlete_id
  const { data: unmatched, error: crErr } = await supabase
    .from('competition_results')
    .select('id, skater_name, partner_name, club_name, discipline, level, event_year')
    .is('athlete_id', null);
  if (crErr) { console.error('Failed to load competition_results:', crErr.message); process.exit(1); }

  console.log(`Found ${unmatched.length} competition_results rows with no athlete_id.`);

  // Build: skater_name -> { maxYear, discipline, level, club_name, resultIds[] }
  const skaterMap = new Map();
  for (const row of unmatched) {
    const name = normalizeName(row.skater_name);
    if (!name) continue;
    if (!skaterMap.has(name)) {
      skaterMap.set(name, {
        name,
        maxYear: row.event_year,
        discipline: row.discipline,
        level: row.level,
        club_name: row.club_name,
        resultIds: [row.id],
        partnerName: row.partner_name ? normalizeName(row.partner_name) : null,
      });
    } else {
      const s = skaterMap.get(name);
      if (row.event_year > s.maxYear) {
        s.maxYear = row.event_year;
        s.discipline = row.discipline;
        s.level = row.level;
        s.club_name = s.club_name || row.club_name;
        s.partnerName = s.partnerName || (row.partner_name ? normalizeName(row.partner_name) : null);
      }
      s.resultIds.push(row.id);
    }
  }

  // Also collect partner names as separate skaters to create
  const allNames = new Set(skaterMap.keys());
  for (const [, s] of skaterMap) {
    if (s.partnerName && !allNames.has(s.partnerName)) {
      allNames.add(s.partnerName);
      skaterMap.set(s.partnerName, {
        name: s.partnerName,
        maxYear: s.maxYear,
        discipline: s.discipline,
        level: s.level,
        club_name: s.club_name,
        resultIds: [], // partner may not have their own row, linked via their own results
        partnerName: s.name,
      });
    }
  }

  const distinctSkaters = [...skaterMap.values()];
  const active = distinctSkaters.filter(s => s.maxYear >= 2023);
  const skipped = distinctSkaters.filter(s => s.maxYear < 2023);

  console.log(`Distinct skaters: ${distinctSkaters.length}`);
  console.log(`Active (last competed 2023+): ${active.length}`);
  console.log(`Skipped (last competed before 2023): ${skipped.length}\n`);

  // Reload athlete map after potential new insertions
  let athleteIndex = new Map(allAthletes.map(a => [a.name.toLowerCase(), a.id]));

  let linked = 0;
  let created = 0;
  let alreadyExisted = 0;
  let scored = 0;

  for (const skater of active) {
    const nameLower = skater.name.toLowerCase();
    let athleteId = athleteIndex.get(nameLower);

    if (athleteId) {
      // Already exists — just link results
      alreadyExisted++;
    } else {
      // Create new profile
      const skatingLevel = LEVEL_MAP[skater.level] || 'senior';
      const status = skater.maxYear >= 2024 ? 'active' : 'paused';

      const { data: inserted, error: insertErr } = await supabase
        .from('athletes')
        .insert({
          name: skater.name,
          discipline: skater.discipline,
          skating_level: skatingLevel,
          partner_role: 'either',
          club_name: skater.club_name || null,
          search_status: status,
          verified: false,
          source: 'usfs_results',
          height_cm: 0, // placeholder — skater can update after claiming profile
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`  "${skater.name}": insert failed — ${insertErr.message}`);
        continue;
      }

      athleteId = inserted.id;
      athleteIndex.set(nameLower, athleteId);
      created++;
      console.log(`  Created [${status}] "${skater.name}" (${skater.discipline} ${skatingLevel}, club: ${skater.club_name || 'none'})`);

      // Run incremental scoring
      await scoreNewAthlete(athleteId);
      scored++;
    }

    // Link all competition_results rows for this skater
    if (skater.resultIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('competition_results')
        .update({ athlete_id: athleteId })
        .in('id', skater.resultIds);
      if (linkErr) {
        console.error(`  "${skater.name}": link failed — ${linkErr.message}`);
      } else {
        linked += skater.resultIds.length;
      }
    }
  }

  // Also link any partner rows that may exist in competition_results
  // by name (partner may appear as skater_name in another row)
  const { data: stillUnmatched } = await supabase
    .from('competition_results')
    .select('id, skater_name')
    .is('athlete_id', null);

  let extraLinked = 0;
  for (const row of stillUnmatched || []) {
    const norm = normalizeName(row.skater_name)?.toLowerCase();
    const id = norm ? athleteIndex.get(norm) : null;
    if (id) {
      await supabase.from('competition_results').update({ athlete_id: id }).eq('id', row.id);
      extraLinked++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`New athlete profiles created:   ${created}`);
  console.log(`Already existed (linked):       ${alreadyExisted}`);
  console.log(`Skipped (last competed < 2023): ${skipped.length}`);
  console.log(`Compatibility scores computed:  ${scored}`);
  console.log(`Competition results linked:     ${linked + extraLinked}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
