/**
 * scripts/link_athletes_and_results.js
 *
 * Three steps run in order:
 *   Step 0: Populate athletes.club_name from competition_results
 *           (athletes were created without club_name — find it from their results)
 *   Step 1: Link athletes to clubs (athletes.club_id) via fuzzy club_name match
 *   Step 2: Link competition_results to athletes (results.athlete_id) via name match
 *   Step 3: Verify and print summary
 *
 * Safe to re-run — skips already-linked rows.
 * Run: node scripts/link_athletes_and_results.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim();

const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

// Name normalization handles all IJS/ISU formats:
//   "Sophia Kartashov"  — already correct
//   "CHEN Nathan"       — IJS all-caps surname
//   "DUHAMEL Meagan"    — same
//   "Chen, Nathan"      — comma-separated
function normalizeName(raw) {
  if (!raw) return '';
  let name = raw.trim();

  // Handle "Last, First" (comma-separated)
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    name = `${first} ${last}`;
  } else {
    // Detect IJS all-caps surname: first word is all uppercase letters/hyphens
    // e.g. "CAIN-GRIBBLE Timothy" → "Timothy Cain-Gribble"
    const parts = name.split(/\s+/);
    const firstWord = parts[0];
    if (
      parts.length >= 2 &&
      firstWord === firstWord.toUpperCase() &&
      /^[A-Z][A-Z\-]+$/.test(firstWord)
    ) {
      const surname = parts[0];
      const given   = parts.slice(1).join(' ');
      name = `${given} ${surname}`;
    }
  }

  return name.toLowerCase().replace(/[^a-z\- ]/g, '').replace(/\s+/g, ' ').trim();
}

// Club name normalization
function normalizeClub(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/\bfigure skating club\b/g, 'fsc')
    .replace(/\bskating club\b/g, 'sc')
    .replace(/\bice skating association\b/g, 'isa')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein similarity (0 to 1)
function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalizeClub(a);
  const nb = normalizeClub(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const m = na.length, n = nb.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = na[i - 1] === nb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// Load all athletes with pagination
async function loadAthletes(filter = {}) {
  let rows = [], offset = 0;
  while (true) {
    let q = sb.from('athletes').select('id, name, club_name, club_id').range(offset, offset + 999);
    if (filter.clubNameNull)    q = q.is('club_name', null);
    if (filter.clubIdNull)      q = q.is('club_id', null);
    if (filter.clubNameNotNull) q = q.not('club_name', 'is', null);
    const { data, error } = await q;
    if (error) { console.error('loadAthletes error:', error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// Load all competition_results with pagination
async function loadResults(filter = {}) {
  let rows = [], offset = 0;
  while (true) {
    let q = sb.from('competition_results')
      .select('id, skater_name, partner_name, club_name, athlete_id')
      .range(offset, offset + 999);
    if (filter.athleteIdNull)    q = q.is('athlete_id', null);
    if (filter.clubNameNotNull)  q = q.not('club_name', 'is', null);
    const { data, error } = await q;
    if (error) { console.error('loadResults error:', error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// STEP 0: Populate athletes.club_name from competition_results
// Athletes were created from results but club_name wasn't copied.
// For each athlete with no club_name, find their results by name match
// and copy the club_name.
async function populateAthleteClubNames() {
  console.log('\n── Step 0: Populate athletes.club_name from competition_results ──');

  const athletes = await loadAthletes({ clubNameNull: true });
  console.log(`Athletes with no club_name: ${athletes.length}`);

  // Build result map: normalized_name → club_name (most common)
  const allResults = await loadResults({ clubNameNotNull: true });
  const nameToClubs = new Map(); // normalized athlete name to [club_names]
  for (const r of allResults) {
    const key = normalizeName(r.skater_name);
    if (!key) continue;
    if (!nameToClubs.has(key)) nameToClubs.set(key, []);
    nameToClubs.get(key).push(r.club_name);
    // Also index partner_name if present
    if (r.partner_name) {
      const pKey = normalizeName(r.partner_name);
      if (pKey) {
        if (!nameToClubs.has(pKey)) nameToClubs.set(pKey, []);
        nameToClubs.get(pKey).push(r.club_name);
      }
    }
  }
  console.log(`Unique skater names with club in results: ${nameToClubs.size}`);

  let updated = 0, notFound = 0;
  for (const athlete of athletes) {
    const key = normalizeName(athlete.name);

    // Exact match
    let clubs = nameToClubs.get(key);

    // Fuzzy: try first + last name substring
    if (!clubs?.length) {
      const parts = key.split(' ');
      if (parts.length >= 2) {
        const first = parts[0];
        const last  = parts[parts.length - 1];
        for (const [rKey, rClubs] of nameToClubs) {
          if (rKey.includes(first) && rKey.includes(last)) {
            clubs = rClubs;
            break;
          }
        }
      }
    }

    if (clubs?.length) {
      // Pick most common club
      const counts = {};
      for (const c of clubs) counts[c] = (counts[c] || 0) + 1;
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const { error } = await sb.from('athletes').update({ club_name: best }).eq('id', athlete.id);
      if (!error) {
        updated++;
        if (updated <= 5) console.log(`  Set club_name: "${athlete.name}" → "${best}"`);
      }
    } else {
      notFound++;
    }
  }

  console.log(`Updated club_name: ${updated}  |  No match found: ${notFound}`);
}

// STEP 1: Link athletes.club_id via club_name fuzzy match
async function linkAthletesToClubs() {
  console.log('\n── Step 1: Link athletes.club_id via club_name ──');

  const { data: clubs, error: ce } = await sb.from('clubs').select('id, name, country');
  if (ce) { console.error('Failed to load clubs:', ce.message); return; }
  console.log(`Clubs available: ${clubs.length}`);

  // Build normalized lookup for exact/prefix matching
  const clubByNorm = new Map();
  for (const club of clubs) {
    clubByNorm.set(normalizeClub(club.name), club);
  }

  // Athletes with club_name but no club_id
  const athletes = await loadAthletes({ clubIdNull: true });
  const withClubName = athletes.filter(a => a.club_name);
  console.log(`Athletes with club_name but no club_id: ${withClubName.length}`);

  let linked = 0, noMatch = 0;
  for (const athlete of withClubName) {
    // Try exact normalized match first
    const normName = normalizeClub(athlete.club_name);
    let match = clubByNorm.get(normName);

    // Fuzzy if no exact hit
    if (!match) {
      let bestScore = 0, bestClub = null;
      for (const club of clubs) {
        const score = similarity(athlete.club_name, club.name);
        if (score > bestScore) { bestScore = score; bestClub = club; }
      }
      if (bestScore >= 0.72) match = bestClub;
    }

    if (match) {
      const { error } = await sb.from('athletes').update({ club_id: match.id }).eq('id', athlete.id);
      if (!error) {
        linked++;
        if (linked <= 5) console.log(`  Linked: "${athlete.name}" → "${match.name}"`);
      }
    } else {
      noMatch++;
      if (noMatch <= 3) console.log(`  No club match for: "${athlete.club_name}" (${athlete.name})`);
    }
  }

  console.log(`Linked: ${linked}  |  No match: ${noMatch}`);
}

// STEP 2: Link competition_results.athlete_id via name match
async function linkResultsToAthletes() {
  console.log('\n── Step 2: Link competition_results.athlete_id ──');

  const allAthletes = await loadAthletes({});
  console.log(`Total athletes: ${allAthletes.length}`);

  // Build name lookup: normalized name → athlete id (first match wins)
  const byExact = new Map();
  for (const a of allAthletes) {
    const key = normalizeName(a.name);
    if (key && !byExact.has(key)) byExact.set(key, a.id);
  }

  const results = await loadResults({ athleteIdNull: true });
  console.log(`Results missing athlete_id: ${results.length}`);

  let linked = 0, skipped = 0;
  for (const result of results) {
    const key = normalizeName(result.skater_name);

    // Exact match
    let athleteId = byExact.get(key);

    // Fuzzy match if no exact hit
    if (!athleteId && key) {
      let bestScore = 0, bestId = null;
      for (const [aKey, aId] of byExact) {
        // Quick pre-filter: share at least one word
        const aWords = aKey.split(' ');
        const kWords = key.split(' ');
        const shared = kWords.some(w => w.length > 2 && aWords.includes(w));
        if (!shared) continue;

        const score = 1 - levenshtein(key, aKey) / Math.max(key.length, aKey.length);
        if (score > bestScore) { bestScore = score; bestId = aId; }
      }
      if (bestScore >= 0.88) athleteId = bestId;
    }

    if (athleteId) {
      const { error } = await sb
        .from('competition_results')
        .update({ athlete_id: athleteId })
        .eq('id', result.id);
      if (!error) {
        linked++;
        if (linked <= 5) console.log(`  Linked result: "${result.skater_name}" → athlete ${athleteId}`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`Linked: ${linked}  |  No match: ${skipped}`);
}

// STEP 3: Verify
async function verify() {
  console.log('\n── Step 3: Verification ──');

  const { count: athTotal }    = await sb.from('athletes').select('*', { count: 'exact', head: true });
  const { count: athWithClub } = await sb.from('athletes').select('*', { count: 'exact', head: true }).not('club_id', 'is', null);
  const { count: athWithName } = await sb.from('athletes').select('*', { count: 'exact', head: true }).not('club_name', 'is', null);
  const { count: crTotal }     = await sb.from('competition_results').select('*', { count: 'exact', head: true });
  const { count: crLinked }    = await sb.from('competition_results').select('*', { count: 'exact', head: true }).not('athlete_id', 'is', null);

  console.log(`Athletes: ${athTotal} total`);
  console.log(`  with club_name: ${athWithName}`);
  console.log(`  with club_id:   ${athWithClub}`);
  console.log(`Results: ${crTotal} total`);
  console.log(`  with athlete_id: ${crLinked}`);

  const { data: sample } = await sb
    .from('athletes')
    .select('name, club_name, clubs(name)')
    .not('club_id', 'is', null)
    .limit(5);

  if (sample?.length) {
    console.log('\nSample athletes with clubs:');
    sample.forEach(a => console.log(`  ${a.name} → ${a.clubs?.name || a.club_name}`));
  }

  const { data: rSample } = await sb
    .from('competition_results')
    .select('skater_name, event_name, event_year, placement, athlete_id')
    .not('athlete_id', 'is', null)
    .limit(5);

  if (rSample?.length) {
    console.log('\nSample results linked to athletes:');
    rSample.forEach(r => console.log(`  ${r.skater_name} | ${r.event_name} ${r.event_year} | #${r.placement}`));
  }
}

// MAIN
async function main() {
  console.log('=== link_athletes_and_results.js ===');
  await populateAthleteClubNames();
  await linkAthletesToClubs();
  await linkResultsToAthletes();
  await verify();
  console.log('\nDone.');
}

main().catch(console.error);
