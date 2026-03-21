/**
 * scripts/link_international_athletes.js
 *
 * Links international athletes (those without a club_id) to their national
 * federation club (federation = 'ISU') by matching athlete.location_country
 * to club.country.
 *
 * Run: node scripts/link_international_athletes.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim();

const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

const NATION_MAP = {
  'USA': 'United States', 'CAN': 'Canada', 'GBR': 'Great Britain',
  'FRA': 'France', 'GER': 'Germany', 'ITA': 'Italy', 'RUS': 'Russia',
  'JPN': 'Japan', 'CHN': 'China', 'KOR': 'South Korea', 'CZE': 'Czech Republic',
  'HUN': 'Hungary', 'POL': 'Poland', 'FIN': 'Finland', 'SWE': 'Sweden',
  'NED': 'Netherlands', 'SUI': 'Switzerland', 'UKR': 'Ukraine',
  'KAZ': 'Kazakhstan', 'GEO': 'Georgia', 'LTU': 'Lithuania', 'EST': 'Estonia',
  'LAT': 'Latvia', 'BLR': 'Belarus', 'SVK': 'Slovakia', 'SLO': 'Slovenia',
  'BUL': 'Bulgaria', 'ROU': 'Romania', 'CRO': 'Croatia', 'TUR': 'Turkey',
  'ISR': 'Israel', 'ARM': 'Armenia', 'AZE': 'Azerbaijan', 'MEX': 'Mexico',
  'BRA': 'Brazil', 'ARG': 'Argentina', 'AUS': 'Australia', 'NZL': 'New Zealand',
  'HKG': 'Hong Kong', 'THA': 'Thailand', 'PHI': 'Philippines', 'AUT': 'Austria',
  'ESP': 'Spain', 'NOR': 'Norway', 'DEN': 'Denmark', 'BEL': 'Belgium',
};

async function loadUnlinkedAthletes() {
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('athletes')
      .select('id, name, location_country')
      .is('club_id', null)
      .range(offset, offset + 999);
    if (error) { console.error('loadAthletes error:', error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function main() {
  console.log('=== link_international_athletes.js ===\n');

  // Load all athletes without a club_id
  const athletes = await loadUnlinkedAthletes();
  console.log(`Athletes without club_id: ${athletes.length}`);

  // Load all ISU federation clubs
  const { data: isuClubs, error: ce } = await sb
    .from('clubs')
    .select('id, name, country')
    .eq('federation', 'ISU');
  if (ce) { console.error('Failed to load ISU clubs:', ce.message); process.exit(1); }
  console.log(`ISU federation clubs available: ${isuClubs.length}`);

  // Build country → club map
  const clubByCountry = new Map();
  for (const club of isuClubs) {
    if (club.country) clubByCountry.set(club.country.toLowerCase(), club);
  }

  let processed = 0, linked = 0, stillUnlinked = 0;
  const samples = [];

  for (const athlete of athletes) {
    processed++;

    const rawCountry = athlete.location_country?.trim();
    // Resolve 3-letter nation code to full name, or use as-is
    const resolvedCountry = (NATION_MAP[rawCountry] ?? rawCountry ?? '').toLowerCase();

    const club = resolvedCountry ? clubByCountry.get(resolvedCountry) : null;

    if (club) {
      const { error } = await sb
        .from('athletes')
        .update({ club_id: club.id })
        .eq('id', athlete.id);
      if (!error) {
        linked++;
        if (samples.length < 5) {
          samples.push({ name: athlete.name, country: rawCountry, club: club.name });
        }
      }
    } else {
      stillUnlinked++;
    }

    if (processed % 50 === 0) {
      console.log(`  Progress: ${processed}/${athletes.length} — linked so far: ${linked}`);
    }
  }

  console.log('\n── Results ──');
  console.log(`Total processed:    ${processed}`);
  console.log(`Linked to ISU club: ${linked}`);
  console.log(`Still unlinked:     ${stillUnlinked}`);

  if (samples.length) {
    console.log('\nSample matches:');
    for (const s of samples) {
      console.log(`  ${s.name} (${s.country}) → ${s.club}`);
    }
  }

  console.log('\nDone.');
  return linked;
}

main().catch(console.error);
