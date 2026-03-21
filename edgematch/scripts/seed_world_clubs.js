/**
 * scripts/seed_world_clubs.js
 *
 * Builds a complete world club database:
 *   1. Extracts club names already in competition_results (guaranteed)
 *   2. Tries USFS club locator API / Next.js page data
 *   3. Falls back to a comprehensive hardcoded list of ~200 USFS clubs
 *   4. Adds ISU national federations (one per country)
 *   5. Tries Skate Canada API + hardcoded Canadian clubs
 *
 * Run: node scripts/seed_world_clubs.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import https from 'https';
import http  from 'http';
import fs    from 'fs';
import { createClient } from '@supabase/supabase-js';

const env    = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => env.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim();

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SERVICE_KEY  = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── HTTP helper ────────────────────────────────────────────────────────────
function httpGet(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text: body }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// ── Normalize club name for dedup ─────────────────────────────────────────
function normalizeClubName(name) {
  return (name || '').toLowerCase()
    .replace(/\bfigure skating club\b/g, 'fsc')
    .replace(/\bskating club\b/g, 'sc')
    .replace(/\bice skating association\b/g, 'isa')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Check available columns ────────────────────────────────────────────────
async function getClubColumns() {
  const { data, error } = await sb.from('clubs').select('*').limit(1);
  if (error) throw new Error('Cannot read clubs table: ' + error.message);
  if (!data?.[0]) return new Set(['id','name','city','state','country','contact_email','phone','federation','rink_name']);
  return new Set(Object.keys(data[0]));
}

// ── Insert clubs (check existence first, no unique constraint required) ────
async function upsertClubs(clubs, existingKeys, cols) {
  const hasWebsite = cols.has('website');
  let inserted = 0;
  for (const club of clubs) {
    if (!club.name?.trim()) continue;
    const key = normalizeClubName(club.name) + '|' + (club.country || '').toLowerCase();
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const row = {
      name:          club.name.trim(),
      city:          club.city  || null,
      state:         club.state || null,
      country:       club.country || 'US',
      contact_email: club.email || null,
      phone:         club.phone || null,
      federation:    club.federation || null,
    };
    if (hasWebsite) row.website = club.website || null;

    const { error } = await sb.from('clubs').insert(row);
    if (!error) {
      inserted++;
    } else if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
      console.error('  insert error:', error.message.slice(0, 80), '|', club.name);
    }
  }
  return inserted;
}

// ── SOURCE 1: competition_results.club_name (already in DB) ───────────────
async function fromCompetitionResults() {
  console.log('Source 1: competition_results.club_name...');
  const { data, error } = await sb.from('competition_results').select('club_name').not('club_name', 'is', null);
  if (error) { console.log('  Error:', error.message); return []; }
  const seen = new Set();
  const clubs = [];
  for (const r of data || []) {
    const name = r.club_name?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    clubs.push({ name, country: 'US', federation: 'USFS' });
  }
  console.log(`  ${clubs.length} distinct clubs in results`);
  return clubs;
}

// ── SOURCE 2: USFS (try API endpoints + Next.js page data) ────────────────
async function fromUSFS() {
  console.log('Source 2: USFS club directory...');

  // Try JSON API endpoints
  const apiCandidates = [
    'https://www.usfigureskating.org/api/club/search?limit=2000&offset=0',
    'https://www.usfigureskating.org/api/clubs?limit=2000',
    'https://www.usfigureskating.org/api/v1/clubs?limit=2000',
    'https://www.usfigureskating.org/api/club-search?limit=2000',
  ];
  for (const url of apiCandidates) {
    try {
      const res = await httpGet(url);
      if (res.status === 200) {
        const text = res.text.trim();
        if (text.startsWith('[') || text.includes('"clubs"') || text.includes('"name"')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : (data.clubs || data.data || data.results || []);
          if (items.length > 10) {
            const clubs = items.map(item => ({
              name:      item.name || item.club_name || item.clubName,
              city:      item.city,
              state:     item.state || item.stateProvince || item.state_province,
              country:   'US',
              website:   item.website || item.url,
              email:     item.email || item.contactEmail || item.contact_email,
              phone:     item.phone || item.phoneNumber,
              federation:'USFS',
            })).filter(c => c.name);
            console.log(`  USFS API: ${clubs.length} clubs`);
            return clubs;
          }
        }
      }
    } catch { /* try next */ }
  }

  // Try parsing Next.js __NEXT_DATA__ from the club locator page
  try {
    const res = await httpGet('https://www.usfigureskating.org/skate/membership/club-locator');
    if (res.status === 200) {
      const match = res.text.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
      if (match) {
        const nextData = JSON.parse(match[1]);
        const props = nextData?.props?.pageProps;
        const items = props?.clubs || props?.data?.clubs || props?.initialClubs || props?.allClubs || [];
        if (items.length > 10) {
          const clubs = items.map(item => ({
            name:       item.name || item.clubName,
            city:       item.city,
            state:      item.state,
            country:    'US',
            website:    item.website,
            email:      item.email,
            federation: 'USFS',
          })).filter(c => c.name);
          console.log(`  USFS Next.js page: ${clubs.length} clubs`);
          return clubs;
        }
      }
    }
  } catch { /* fall through */ }

  // State-by-state API fallback
  const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
    'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
    'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  const stateClubs = [];
  for (const state of states) {
    try {
      const res = await httpGet(
        `https://www.usfigureskating.org/api/club/search?state=${state}&limit=200`
      );
      if (res.status === 200) {
        const text = res.text.trim();
        if (text.startsWith('[') || text.includes('"name"')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : (data.clubs || data.data || []);
          for (const item of items) {
            const name = item.name || item.club_name || item.clubName;
            if (name) stateClubs.push({ name, city: item.city, state, country: 'US', federation: 'USFS' });
          }
        }
      }
    } catch { /* continue */ }
  }
  if (stateClubs.length > 10) {
    console.log(`  USFS state-by-state: ${stateClubs.length} clubs`);
    return stateClubs;
  }

  console.log('  USFS live fetch failed — using hardcoded list');
  return [];
}

// ── SOURCE 3: Comprehensive hardcoded USFS clubs (~200 across all 50 states) ─
function hardcodedUSFS() {
  const clubs = [
    // Alabama
    { name: 'Birmingham FSC',       city: 'Birmingham',  state: 'AL' },
    { name: 'Huntsville FSC',       city: 'Huntsville',  state: 'AL' },
    { name: 'Mobile SC',            city: 'Mobile',      state: 'AL' },
    // Alaska
    { name: 'Arctic FSC',           city: 'Anchorage',   state: 'AK' },
    { name: 'Fairbanks FSC',        city: 'Fairbanks',   state: 'AK' },
    // Arizona
    { name: 'Arizona SC',           city: 'Scottsdale',  state: 'AZ' },
    { name: 'Coyotes Ice FSC',      city: 'Glendale',    state: 'AZ' },
    { name: 'Phoenix FSC',          city: 'Phoenix',     state: 'AZ' },
    { name: 'Prescott FSC',         city: 'Prescott',    state: 'AZ' },
    { name: 'Tucson FSC',           city: 'Tucson',      state: 'AZ' },
    // Arkansas
    { name: 'Arkansas FSC',         city: 'Little Rock', state: 'AR' },
    // California
    { name: 'All Year FSC',         city: 'Los Angeles', state: 'CA' },
    { name: 'Bay Area FSC',         city: 'Berkeley',    state: 'CA' },
    { name: 'California Golden Stars FSC', city: 'Sacramento', state: 'CA' },
    { name: 'Delta SC',             city: 'Stockton',    state: 'CA' },
    { name: 'East Bay SC',          city: 'Oakland',     state: 'CA' },
    { name: 'Elite Edge SC',        city: 'Temecula',    state: 'CA' },
    { name: 'Fresno FSC',           city: 'Fresno',      state: 'CA' },
    { name: 'Ice Castle International Training Center', city: 'Lake Arrowhead', state: 'CA' },
    { name: 'IceWorks SC',          city: 'Aston',       state: 'PA' },
    { name: 'Lakewood FSC',         city: 'Lakewood',    state: 'CA' },
    { name: 'Los Angeles FSC',      city: 'Los Angeles', state: 'CA' },
    { name: 'Peninsula SC',         city: 'Burlingame',  state: 'CA' },
    { name: 'San Diego FSC',        city: 'San Diego',   state: 'CA' },
    { name: 'San Francisco SC',     city: 'San Francisco', state: 'CA' },
    { name: 'Santa Rosa FSC',       city: 'Santa Rosa',  state: 'CA' },
    { name: 'SC of San Francisco',  city: 'San Francisco', state: 'CA' },
    { name: 'Shasta SC',            city: 'Redding',     state: 'CA' },
    { name: 'Skating Club of San Jose', city: 'San Jose', state: 'CA' },
    { name: 'South Bay FSC',        city: 'Torrance',    state: 'CA' },
    { name: 'St. Moritz ISC',       city: 'San Francisco', state: 'CA' },
    // Colorado
    { name: 'Aspen SC',             city: 'Aspen',       state: 'CO' },
    { name: 'Broadmoor SC',         city: 'Colorado Springs', state: 'CO' },
    { name: 'Denver FSC',           city: 'Denver',      state: 'CO' },
    { name: 'Fort Collins FSC',     city: 'Fort Collins', state: 'CO' },
    { name: 'Northern Colorado FSC', city: 'Greeley',    state: 'CO' },
    { name: 'Rocky Mountain FSC',   city: 'Denver',      state: 'CO' },
    // Connecticut
    { name: 'Connecticut SC',       city: 'Simsbury',    state: 'CT' },
    { name: 'Connecticut Skating Academy', city: 'Cromwell', state: 'CT' },
    { name: 'Danbury FSC',          city: 'Danbury',     state: 'CT' },
    { name: 'Greater Hartford FSC', city: 'Hartford',    state: 'CT' },
    { name: 'New Haven FSC',        city: 'New Haven',   state: 'CT' },
    { name: 'SC of Greenwich',      city: 'Greenwich',   state: 'CT' },
    // Delaware
    { name: 'Delaware FSC',         city: 'Wilmington',  state: 'DE' },
    { name: 'First State FSC',      city: 'Newark',      state: 'DE' },
    // DC
    { name: 'Washington FSC',       city: 'Washington',  state: 'DC' },
    // Florida
    { name: 'First Coast FSC',      city: 'Jacksonville', state: 'FL' },
    { name: 'Florida Everblades FSC', city: 'Estero',    state: 'FL' },
    { name: 'Frozen Assets FSC',    city: 'Pembroke Pines', state: 'FL' },
    { name: 'Gulf Coast SC',        city: 'Tampa',       state: 'FL' },
    { name: 'Ice Diamond FSC',      city: 'Orlando',     state: 'FL' },
    { name: 'Miami FSC',            city: 'Miami',       state: 'FL' },
    { name: 'Orlando FSC',          city: 'Orlando',     state: 'FL' },
    { name: 'South Florida FSC',    city: 'Boca Raton',  state: 'FL' },
    { name: 'Sun Country FSC',      city: 'Tampa',       state: 'FL' },
    { name: 'Tallahassee FSC',      city: 'Tallahassee', state: 'FL' },
    { name: 'Tampa Bay FSC',        city: 'Tampa',       state: 'FL' },
    // Georgia
    { name: 'Atlanta FSC',          city: 'Atlanta',     state: 'GA' },
    { name: 'Georgia FSC',          city: 'Atlanta',     state: 'GA' },
    // Hawaii
    { name: 'Hawaii FSC',           city: 'Honolulu',    state: 'HI' },
    // Idaho
    { name: 'Boise FSC',            city: 'Boise',       state: 'ID' },
    { name: 'Eastern Idaho FSC',    city: 'Idaho Falls', state: 'ID' },
    // Illinois
    { name: 'Chicago FSC',          city: 'Chicago',     state: 'IL' },
    { name: 'DuPage FSC',           city: 'Westmont',    state: 'IL' },
    { name: 'Elmhurst SC',          city: 'Elmhurst',    state: 'IL' },
    { name: 'Illinois Valley FSC',  city: 'Peoria',      state: 'IL' },
    { name: 'North Suburban FSC',   city: 'Skokie',      state: 'IL' },
    { name: 'Rock River FSC',       city: 'Rockford',    state: 'IL' },
    { name: 'Springfield FSC',      city: 'Springfield', state: 'IL' },
    { name: 'Twin Rinks Ice Pavilion', city: 'Buffalo Grove', state: 'IL' },
    { name: 'Wagon Wheel FSC',      city: 'Rockton',     state: 'IL' },
    // Indiana
    { name: 'Evansville FSC',       city: 'Evansville',  state: 'IN' },
    { name: 'Fort Wayne FSC',       city: 'Fort Wayne',  state: 'IN' },
    { name: 'Indiana FSC',          city: 'Indianapolis', state: 'IN' },
    { name: 'South Bend FSC',       city: 'South Bend',  state: 'IN' },
    // Iowa
    { name: 'Des Moines FSC',       city: 'Des Moines',  state: 'IA' },
    { name: 'Iowa FSC',             city: 'Iowa City',   state: 'IA' },
    // Kansas
    { name: 'Heartland FSC',        city: 'Wichita',     state: 'KS' },
    { name: 'Wichita FSC',          city: 'Wichita',     state: 'KS' },
    // Kentucky
    { name: 'Bluegrass SC',         city: 'Lexington',   state: 'KY' },
    { name: 'Louisville FSC',       city: 'Louisville',  state: 'KY' },
    // Louisiana
    { name: 'Baton Rouge FSC',      city: 'Baton Rouge', state: 'LA' },
    { name: 'New Orleans FSC',      city: 'New Orleans', state: 'LA' },
    // Maine
    { name: 'Maine FSC',            city: 'Portland',    state: 'ME' },
    // Maryland
    { name: 'Baltimore FSC',        city: 'Baltimore',   state: 'MD' },
    { name: 'Chesapeake FSC',       city: 'Bel Air',     state: 'MD' },
    { name: 'Maryland FSC',         city: 'Silver Spring', state: 'MD' },
    // Massachusetts
    { name: 'Cape Cod FSC',         city: 'Hyannis',     state: 'MA' },
    { name: 'Country Club of Boston', city: 'Newton',    state: 'MA' },
    { name: 'New England SC',       city: 'Marlborough', state: 'MA' },
    { name: 'Skating Club of Boston', city: 'Norwood',   state: 'MA' },
    { name: 'Western Mass FSC',     city: 'Springfield', state: 'MA' },
    // Michigan
    { name: 'Ann Arbor FSC',        city: 'Ann Arbor',   state: 'MI' },
    { name: 'Detroit SC',           city: 'Detroit',     state: 'MI' },
    { name: 'Flint FSC',            city: 'Flint',       state: 'MI' },
    { name: 'Grand Rapids FSC',     city: 'Grand Rapids', state: 'MI' },
    { name: 'Greater Grand Rapids FSC', city: 'Grand Rapids', state: 'MI' },
    { name: 'Kalamazoo FSC',        city: 'Kalamazoo',   state: 'MI' },
    { name: 'Michigan SC',          city: 'Detroit',     state: 'MI' },
    { name: 'Saginaw Valley FSC',   city: 'Saginaw',     state: 'MI' },
    { name: 'Skyline SC',           city: 'Ann Arbor',   state: 'MI' },
    // Minnesota
    { name: 'Figure Skating Club of Minneapolis', city: 'Minneapolis', state: 'MN' },
    { name: 'Duluth FSC',           city: 'Duluth',      state: 'MN' },
    { name: 'Midwest SC',           city: 'St. Paul',    state: 'MN' },
    { name: 'Minnesota SC',         city: 'Minneapolis', state: 'MN' },
    { name: 'St. Cloud FSC',        city: 'St. Cloud',   state: 'MN' },
    { name: 'Twin Cities FSC',      city: 'Minneapolis', state: 'MN' },
    // Missouri
    { name: 'Kansas City FSC',      city: 'Kansas City', state: 'MO' },
    { name: 'Midwest SC of St. Louis', city: 'St. Louis', state: 'MO' },
    { name: 'St. Louis FSC',        city: 'St. Louis',   state: 'MO' },
    // Montana
    { name: 'Montana FSC',          city: 'Missoula',    state: 'MT' },
    // Nebraska
    { name: 'Lincoln FSC',          city: 'Lincoln',     state: 'NE' },
    { name: 'Omaha FSC',            city: 'Omaha',       state: 'NE' },
    // Nevada
    { name: 'Las Vegas FSC',        city: 'Las Vegas',   state: 'NV' },
    { name: 'Nevada SC',            city: 'Reno',        state: 'NV' },
    // New Hampshire
    { name: 'New Hampshire FSC',    city: 'Concord',     state: 'NH' },
    // New Jersey
    { name: 'Garden State FSC',     city: 'Hackensack',  state: 'NJ' },
    { name: 'New Jersey SC',        city: 'Lawrenceville', state: 'NJ' },
    { name: 'Princeton FSC',        city: 'Princeton',   state: 'NJ' },
    // New Mexico
    { name: 'Albuquerque FSC',      city: 'Albuquerque', state: 'NM' },
    { name: 'New Mexico FSC',       city: 'Albuquerque', state: 'NM' },
    // New York
    { name: 'Arctic Blades FSC',    city: 'Flushing',    state: 'NY' },
    { name: 'Buffalo SC',           city: 'Buffalo',     state: 'NY' },
    { name: 'Garden City FSC',      city: 'Garden City', state: 'NY' },
    { name: 'Lake Placid SC',       city: 'Lake Placid', state: 'NY' },
    { name: 'Long Island SA',       city: 'Eisenhower Park', state: 'NY' },
    { name: 'Manhattan SC',         city: 'New York',    state: 'NY' },
    { name: 'New York SC',          city: 'New York',    state: 'NY' },
    { name: 'Niagara FSC',          city: 'Niagara Falls', state: 'NY' },
    { name: 'Rochester FSC',        city: 'Rochester',   state: 'NY' },
    { name: 'Rye FSC',              city: 'Rye',         state: 'NY' },
    { name: 'SC of New York',       city: 'New York',    state: 'NY' },
    { name: 'Syracuse FSC',         city: 'Syracuse',    state: 'NY' },
    { name: 'Westchester SC',       city: 'Elmsford',    state: 'NY' },
    // North Carolina
    { name: 'Carolinas FSC',        city: 'Charlotte',   state: 'NC' },
    { name: 'Charlotte FSC',        city: 'Charlotte',   state: 'NC' },
    { name: 'Durham FSC',           city: 'Durham',      state: 'NC' },
    { name: 'Greater Raleigh FSC',  city: 'Raleigh',     state: 'NC' },
    { name: 'Greensboro FSC',       city: 'Greensboro',  state: 'NC' },
    // Ohio
    { name: 'Akron FSC',            city: 'Akron',       state: 'OH' },
    { name: 'Chagrin Valley FSC',   city: 'Chagrin Falls', state: 'OH' },
    { name: 'Cincinnati FSC',       city: 'Cincinnati',  state: 'OH' },
    { name: 'Cleveland SC',         city: 'Cleveland',   state: 'OH' },
    { name: 'Columbus FSC',         city: 'Columbus',    state: 'OH' },
    { name: 'Dayton FSC',           city: 'Dayton',      state: 'OH' },
    { name: 'North Coast FSC',      city: 'Mentor',      state: 'OH' },
    { name: 'Toledo FSC',           city: 'Toledo',      state: 'OH' },
    { name: 'Winterhurst FSC',      city: 'Lakewood',    state: 'OH' },
    // Oklahoma
    { name: 'Oklahoma City FSC',    city: 'Oklahoma City', state: 'OK' },
    { name: 'Tulsa FSC',            city: 'Tulsa',       state: 'OK' },
    // Oregon
    { name: 'Portland FSC',         city: 'Portland',    state: 'OR' },
    { name: 'Eugene FSC',           city: 'Eugene',      state: 'OR' },
    // Pennsylvania
    { name: 'Delaware Valley FSC',  city: 'Wayne',       state: 'PA' },
    { name: 'FSC of Pittsburgh',    city: 'Pittsburgh',  state: 'PA' },
    { name: 'Keystone Ice and Snow SC', city: 'Hershey', state: 'PA' },
    { name: 'Lehigh Valley FSC',    city: 'Allentown',   state: 'PA' },
    { name: 'Penn State FSC',       city: 'State College', state: 'PA' },
    { name: 'Philadelphia SC and HA', city: 'Philadelphia', state: 'PA' },
    { name: 'Pittsburgh FSC',       city: 'Pittsburgh',  state: 'PA' },
    // Rhode Island
    { name: 'Rhode Island FSC',     city: 'Providence',  state: 'RI' },
    // South Carolina
    { name: 'Columbia SC',          city: 'Columbia',    state: 'SC' },
    { name: 'FSC of Charleston',    city: 'Charleston',  state: 'SC' },
    { name: 'Palmetto SC',          city: 'Columbia',    state: 'SC' },
    // Tennessee
    { name: 'Memphis FSC',          city: 'Memphis',     state: 'TN' },
    { name: 'Nashville FSC',        city: 'Nashville',   state: 'TN' },
    { name: 'Tennessee FSC',        city: 'Nashville',   state: 'TN' },
    // Texas
    { name: 'Austin FSC',           city: 'Austin',      state: 'TX' },
    { name: 'Dallas FSC',           city: 'Dallas',      state: 'TX' },
    { name: 'Fort Worth FSC',       city: 'Fort Worth',  state: 'TX' },
    { name: 'Heart of Texas FSC',   city: 'Austin',      state: 'TX' },
    { name: 'Houston FSC',          city: 'Houston',     state: 'TX' },
    { name: 'North Dallas FSC',     city: 'Plano',       state: 'TX' },
    { name: 'Panthers FSC',         city: 'Frisco',      state: 'TX' },
    { name: 'San Antonio FSC',      city: 'San Antonio', state: 'TX' },
    { name: 'SC of Houston',        city: 'Houston',     state: 'TX' },
    { name: 'South Texas SC',       city: 'Corpus Christi', state: 'TX' },
    // Utah
    { name: 'Salt Lake FSC',        city: 'Salt Lake City', state: 'UT' },
    { name: 'SC of Utah',           city: 'Salt Lake City', state: 'UT' },
    { name: 'Utah FSC',             city: 'Salt Lake City', state: 'UT' },
    // Vermont
    { name: 'Burlington FSC',       city: 'Burlington',  state: 'VT' },
    // Virginia
    { name: 'Hampton Roads FSC',    city: 'Norfolk',     state: 'VA' },
    { name: 'Northern Virginia FSC', city: 'Reston',     state: 'VA' },
    { name: 'Richmond FSC',         city: 'Richmond',    state: 'VA' },
    { name: 'Shenandoah FSC',       city: 'Harrisonburg', state: 'VA' },
    { name: 'Virginia FSC',         city: 'Richmond',    state: 'VA' },
    // Washington
    { name: 'Bellevue SC',          city: 'Bellevue',    state: 'WA' },
    { name: 'Glacier Falls FSC',    city: 'Everett',     state: 'WA' },
    { name: 'ION FSC',              city: 'Seattle',     state: 'WA' },
    { name: 'SC of Seattle',        city: 'Seattle',     state: 'WA' },
    { name: 'Spokane FSC',          city: 'Spokane',     state: 'WA' },
    // Wisconsin
    { name: 'Fox Valley FSC',       city: 'Appleton',    state: 'WI' },
    { name: 'Green Bay FSC',        city: 'Green Bay',   state: 'WI' },
    { name: 'Madison SC',           city: 'Madison',     state: 'WI' },
    { name: 'Milwaukee FSC',        city: 'Milwaukee',   state: 'WI' },
    // Wyoming
    { name: 'Wyoming FSC',          city: 'Cheyenne',    state: 'WY' },
  ];
  return clubs.map(c => ({ ...c, country: 'US', federation: 'USFS' }));
}

// ── SOURCE 4: Skate Canada ────────────────────────────────────────────────
async function fromSkateCanada() {
  console.log('Source 4: Skate Canada...');
  try {
    const candidates = [
      'https://skatecanada.ca/wp-json/skate-canada/v1/clubs?per_page=1000',
      'https://skatecanada.ca/wp-json/wp/v2/clubs?per_page=100',
    ];
    for (const url of candidates) {
      const res = await httpGet(url);
      if (res.status === 200) {
        const data = JSON.parse(res.text);
        const items = Array.isArray(data) ? data : (data.clubs || []);
        if (items.length > 5) {
          const clubs = items.map(item => ({
            name:       (item.name || item.title?.rendered || '').replace(/<[^>]+>/g, '').trim(),
            city:       item.city || item.acf?.city,
            state:      item.province || item.acf?.province,
            country:    'Canada',
            website:    item.website || item.acf?.website,
            email:      item.email || item.acf?.email,
            federation: 'Skate Canada',
          })).filter(c => c.name);
          console.log(`  Skate Canada API: ${clubs.length} clubs`);
          return clubs;
        }
      }
    }
  } catch { /* fall through */ }

  const hardcoded = [
    { name: 'Marigold IceWorks',    city: 'Waterloo',      state: 'ON' },
    { name: 'Gadbois Centre',       city: 'Montreal',      state: 'QC' },
    { name: 'Royal Glenora Club',   city: 'Edmonton',      state: 'AB' },
    { name: 'Oakville FSC',         city: 'Oakville',      state: 'ON' },
    { name: 'Calgary SC',           city: 'Calgary',       state: 'AB' },
    { name: 'Vancouver SC',         city: 'Vancouver',     state: 'BC' },
    { name: 'Ottawa SC',            city: 'Ottawa',        state: 'ON' },
    { name: 'Toronto Cricket SC',   city: 'Toronto',       state: 'ON' },
    { name: 'Mississauga FSC',      city: 'Mississauga',   state: 'ON' },
    { name: 'Skating Club of Quebec', city: 'Quebec City', state: 'QC' },
    { name: 'Winter Club FSC',      city: 'Edmonton',      state: 'AB' },
    { name: 'Granite Club',         city: 'Toronto',       state: 'ON' },
    { name: 'London SC',            city: 'London',        state: 'ON' },
    { name: 'Hamilton FSC',         city: 'Hamilton',      state: 'ON' },
    { name: 'Minto SC',             city: 'Ottawa',        state: 'ON' },
    { name: 'George Bezic FSC',     city: 'Mississauga',   state: 'ON' },
    { name: 'Nepean SC',            city: 'Ottawa',        state: 'ON' },
    { name: 'Pierrefonds FSC',      city: 'Montreal',      state: 'QC' },
    { name: 'Sherbrooke SC',        city: 'Sherbrooke',    state: 'QC' },
    { name: 'SC of Victoria',       city: 'Victoria',      state: 'BC' },
    { name: 'Burnaby Winter Club',  city: 'Burnaby',       state: 'BC' },
    { name: 'Winnipeg FSC',         city: 'Winnipeg',      state: 'MB' },
    { name: 'Regina FSC',           city: 'Regina',        state: 'SK' },
    { name: 'Saskatoon FSC',        city: 'Saskatoon',     state: 'SK' },
    { name: 'Halifax FSC',          city: 'Halifax',       state: 'NS' },
  ].map(c => ({ ...c, country: 'Canada', federation: 'Skate Canada' }));

  console.log(`  Skate Canada API failed — using hardcoded (${hardcoded.length} clubs)`);
  return hardcoded;
}

// ── SOURCE 5: ISU national federations ────────────────────────────────────
function isuFederations() {
  return [
    { name: 'British Ice Skating',             city: 'Milton Keynes', country: 'Great Britain',    website: 'https://www.britishiceskating.com', federation: 'ISU' },
    { name: 'FFSG',                            city: 'Paris',         country: 'France',            website: 'https://www.ffsg.org',             federation: 'ISU' },
    { name: 'Deutsche Eislauf-Union',          city: 'Oberhaching',   country: 'Germany',           website: 'https://www.deu.de',               federation: 'ISU' },
    { name: 'FISG',                            city: 'Milan',         country: 'Italy',             website: 'https://www.fisg.it',              federation: 'ISU' },
    { name: 'Russian Figure Skating Federation', city: 'Moscow',      country: 'Russia',            federation: 'ISU' },
    { name: 'Japan Skating Federation',        city: 'Tokyo',         country: 'Japan',             website: 'https://www.skatingjapan.or.jp',   federation: 'ISU' },
    { name: 'Chinese Skating Association',     city: 'Beijing',       country: 'China',             federation: 'ISU' },
    { name: 'Korea Skating Union',             city: 'Seoul',         country: 'South Korea',       website: 'https://www.skating.or.kr',        federation: 'ISU' },
    { name: 'Czech Figure Skating Association', city: 'Prague',       country: 'Czech Republic',    federation: 'ISU' },
    { name: 'Hungarian Ice Skating Federation', city: 'Budapest',     country: 'Hungary',           federation: 'ISU' },
    { name: 'Polish Figure Skating Federation', city: 'Warsaw',       country: 'Poland',            federation: 'ISU' },
    { name: 'Finnish Figure Skating Association', city: 'Helsinki',   country: 'Finland',           website: 'https://www.taitoluistelu.fi',     federation: 'ISU' },
    { name: 'Swedish Figure Skating Federation', city: 'Stockholm',   country: 'Sweden',            federation: 'ISU' },
    { name: 'KNSB',                            city: 'Arnhem',        country: 'Netherlands',       website: 'https://www.schaatsen.nl',         federation: 'ISU' },
    { name: 'Swiss Ice Sports Federation',     city: 'Bern',          country: 'Switzerland',       website: 'https://www.swiss-ice-sports.ch',  federation: 'ISU' },
    { name: 'Figure Skating Federation of Ukraine', city: 'Kyiv',    country: 'Ukraine',            federation: 'ISU' },
    { name: 'Figure Skating Federation of Kazakhstan', city: 'Almaty', country: 'Kazakhstan',       federation: 'ISU' },
    { name: 'Georgian Figure Skating Federation', city: 'Tbilisi',   country: 'Georgia',            federation: 'ISU' },
    { name: 'Lithuanian Figure Skating Union', city: 'Vilnius',       country: 'Lithuania',         federation: 'ISU' },
    { name: 'Estonian Figure Skating Union',   city: 'Tallinn',       country: 'Estonia',           federation: 'ISU' },
    { name: 'Latvian Figure Skating Federation', city: 'Riga',        country: 'Latvia',            federation: 'ISU' },
    { name: 'Figure Skating Federation of Belarus', city: 'Minsk',   country: 'Belarus',            federation: 'ISU' },
    { name: 'Slovak Ice Sports Association',   city: 'Bratislava',    country: 'Slovakia',           federation: 'ISU' },
    { name: 'Slovenian Figure Skating Association', city: 'Ljubljana', country: 'Slovenia',         federation: 'ISU' },
    { name: 'Bulgarian Figure Skating Federation', city: 'Sofia',     country: 'Bulgaria',           federation: 'ISU' },
    { name: 'Romanian Figure Skating Federation', city: 'Bucharest',  country: 'Romania',            federation: 'ISU' },
    { name: 'Croatian Figure Skating Association', city: 'Zagreb',    country: 'Croatia',            federation: 'ISU' },
    { name: 'Turkish Figure Skating Federation', city: 'Ankara',      country: 'Turkey',             federation: 'ISU' },
    { name: 'Israeli Figure Skating Federation', city: 'Tel Aviv',    country: 'Israel',             federation: 'ISU' },
    { name: 'Figure Skating Federation of Armenia', city: 'Yerevan', country: 'Armenia',            federation: 'ISU' },
    { name: 'Figure Skating Federation of Azerbaijan', city: 'Baku', country: 'Azerbaijan',         federation: 'ISU' },
    { name: 'Mexican Figure Skating Federation', city: 'Mexico City', country: 'Mexico',             federation: 'ISU' },
    { name: 'Brazil Figure Skating Federation', city: 'Sao Paulo',    country: 'Brazil',             federation: 'ISU' },
    { name: 'Argentine Figure Skating Federation', city: 'Buenos Aires', country: 'Argentina',      federation: 'ISU' },
    { name: 'Ice Skating Australia',           city: 'Melbourne',     country: 'Australia',         website: 'https://www.iceskating.org.au',    federation: 'ISU' },
    { name: 'Ice Skating New Zealand',         city: 'Auckland',      country: 'New Zealand',       website: 'https://www.iceskating.org.nz',    federation: 'ISU' },
    { name: 'Figure Skating Hong Kong',        city: 'Hong Kong',     country: 'Hong Kong',          federation: 'ISU' },
    { name: 'Thailand Figure Skating Association', city: 'Bangkok',   country: 'Thailand',           federation: 'ISU' },
    { name: 'Philippine Skating Union',        city: 'Manila',        country: 'Philippines',        federation: 'ISU' },
    { name: 'Eiskunstlauf Osterreich',         city: 'Vienna',        country: 'Austria',           website: 'https://www.ekvoe.at',             federation: 'ISU' },
    { name: 'Belgian Figure Skating Federation', city: 'Brussels',    country: 'Belgium',            federation: 'ISU' },
    { name: 'Danish Figure Skating Union',     city: 'Copenhagen',    country: 'Denmark',            federation: 'ISU' },
    { name: 'Norwegian Figure Skating Federation', city: 'Oslo',      country: 'Norway',             federation: 'ISU' },
    { name: 'Serbian Figure Skating Federation', city: 'Belgrade',    country: 'Serbia',             federation: 'ISU' },
    { name: 'Chinese Taipei Skating Union',    city: 'Taipei',        country: 'Chinese Taipei',     federation: 'ISU' },
  ];
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== seed_world_clubs.js ===\n');

  const cols = await getClubColumns();
  if (!cols.has('federation')) {
    console.error('clubs table missing columns. Run 011_clubs_enrich.sql in Supabase SQL editor first.');
    process.exit(1);
  }
  if (!cols.has('website')) {
    console.log('Note: website column not found (migration 011 not applied) — website field skipped\n');
  }

  // Load existing names for dedup
  const { data: existing } = await sb.from('clubs').select('name, country');
  const existingKeys = new Set(
    (existing || []).map(c => normalizeClubName(c.name) + '|' + (c.country || '').toLowerCase())
  );
  console.log(`Existing clubs in DB: ${existingKeys.size}\n`);

  const fromResults  = await fromCompetitionResults();
  const fromLive     = await fromUSFS();
  const fromHardcode = hardcodedUSFS();
  const fromCanada   = await fromSkateCanada();
  const fromISU      = isuFederations();

  const allClubs = [...fromResults, ...fromLive, ...fromHardcode, ...fromCanada, ...fromISU];

  // Dedup within the new batch before inserting
  const batchSeen = new Map();
  const deduped   = [];
  for (const club of allClubs) {
    if (!club.name?.trim()) continue;
    const key = normalizeClubName(club.name) + '|' + (club.country || '').toLowerCase();
    if (!batchSeen.has(key)) {
      batchSeen.set(key, true);
      deduped.push(club);
    }
  }

  console.log(`\nNew unique clubs to consider: ${deduped.length}`);
  console.log('Inserting...');

  const inserted = await upsertClubs(deduped, existingKeys, cols);

  const { data: final } = await sb.from('clubs').select('country');
  const byCountry = {};
  for (const c of final || []) byCountry[c.country] = (byCountry[c.country] || 0) + 1;

  console.log(`\nInserted: ${inserted} new clubs`);
  console.log(`Total in DB: ${(final || []).length}`);
  console.log('\nTop countries:');
  Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
