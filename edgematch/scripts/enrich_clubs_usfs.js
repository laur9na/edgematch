/**
 * scripts/enrich_clubs_usfs.js
 *
 * 1. Seeds all distinct club_name values from competition_results into clubs table.
 * 2. Enriches each club with contact info from verified static lookup + targeted web scrape.
 *    Only scrapes the known-correct website for each club. No domain guessing.
 *    Falls back to OpenAI if OPENAI_API_KEY is set and contact not found.
 * 3. Stores: contact_email (always available), website + phone (if 011 migration applied).
 * 4. Links athletes to clubs based on competition_results.club_name.
 *
 * Usage: node scripts/enrich_clubs_usfs.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Optional: OPENAI_API_KEY for AI fallback on unresolved clubs
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
const OPENAI_KEY = env.OPENAI_API_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Verified static lookup: only clubs where we have high-confidence website + email.
// Website URLs are known-correct. Emails are only included where confirmed.
// Do not add entries here unless the domain clearly matches the club name.
const STATIC_LOOKUP = {
  'all year fsc':          { website: 'https://www.allyearfsc.org' },
  'ann arbor fsc':         { website: 'https://www.aafsc.org' },
  'arctic fsc':            { website: 'https://www.arcticfsc.org', contact_email: 'arcticfsc@gmail.com' },
  'aspen sc':              { website: 'https://www.aspensc.org' },
  'boise fsc':             { website: 'https://www.boisefsc.org' },
  'broadmoor sc':          { website: 'https://www.broadmoorsc.com' },
  'carolinas fsc':         { website: 'https://www.carolinasfsc.org' },
  'chicago fsc':           { website: 'https://www.chicagofsc.org', contact_email: 'info@chicagofsc.org' },
  'cleveland sc':          { website: 'https://www.clevelandskatingclub.org' },
  'connecticut skating academy': { website: 'https://www.ctskatingacademy.com', contact_email: 'ctskatingacademy@gmail.com' },
  'detroit sc':            { website: 'https://www.detroitskatingclub.com' },
  'dupage fsc':            { website: 'https://www.dupagestc.org' },
  'elite edge sc':         { website: 'https://www.eliteedgeic.com' },
  'fsc of charleston':     { website: 'https://www.fscofcharleston.com', contact_email: 'club@fscofcharleston.com' },
  'first coast fsc':       { website: 'https://www.firstcoastfsc.org' },
  'florida everblades fsc':{ website: 'https://www.fefsc.com', contact_email: 'info@floridaeverblades.com' },
  'glacier falls fsc':     { website: 'https://www.glacierfallsfsc.com' },
  'greater grand rapids fsc': { website: 'https://www.ggrfsc.org' },
  'heart of texas fsc':    { website: 'https://www.hotfsc.org' },
  'ion fsc':               { website: 'https://www.ionfsc.com' },
  'iceworks sc':           { website: 'https://www.iceworkspa.com' },
  'los angeles fsc':       { website: 'https://www.lafsc.org', contact_email: 'info@lafsc.org' },
  'magic city fsc':        { website: 'https://www.magiccityfsc.org' },
  'north jersey fsc':      { website: 'https://www.njfsc.org', contact_email: 'NorthJerseyFSC@gmail.com' },
  'northern ice sc':       { website: 'https://www.northernicesc.org', contact_email: 'info@northernsc.org' },
  'oklahoma city fsc':     { website: 'https://www.okfsc.org' },
  'orange county fsc':     { website: 'https://www.ocfsc.org' },
  'panthers fsc':          { website: 'https://www.panthersfsc.org' },
  'pavilion sc of cleveland heights': { website: 'https://www.pavilionfsc.org' },
  'peninsula sc':          { website: 'https://www.peninsulaskatingclub.org' },
  'sc of boston':          { website: 'https://www.skateboston.org', contact_email: 'info@skateboston.org' },
  'sc of houston':         { website: 'https://www.skatehoustonsc.org' },
  'sc of new york':        { website: 'https://www.skatingclubofnewyork.org' },
  'scott hamilton sc':     { website: 'https://www.scotthamiltonsc.com' },
  'shenandoah fsc':        { website: 'https://www.shenandoahfsc.org' },
  'skokie valley sc':      { website: 'https://www.skokievalleysc.org', contact_email: 'info@skokievalley.org' },
  'south carolina fsc':    { website: 'https://www.southcarolinafsc.org' },
  'st. clair shores fsc':  { website: 'https://www.stclairshoresskatecenter.com' },
  'strongsville sc':       { website: 'https://www.strongsvilleskatecenter.com' },
  'thunderbirds fsc':      { website: 'https://www.thunderbirdsfsc.org' },
  'wasatch fsc':           { website: 'https://www.wasatchfsc.org' },
  'washington fsc':        { website: 'https://www.wfsc.org', contact_email: 'presidentofwfsc@gmail.com' },
  'winterhurst fsc':       { website: 'https://www.winterhurstfsc.com', contact_email: 'iceworks6@aol.com' },
};

// Extract emails only from mailto: links (avoids picking up tracking/CDN emails)
function extractMailtoEmails(html) {
  return (html.match(/href=["']mailto:([^"'?\s]+)/gi) || [])
    .map(m => m.replace(/href=["']mailto:/i, '').replace(/["']/g, '').trim())
    .filter(e => {
      if (!e || e.length < 6 || e.length > 80) return false;
      const [, domain] = e.split('@');
      if (!domain) return false;
      const tld = domain.split('.').pop();
      if (/\d/.test(tld)) return false; // reject version strings like 3.5.7
      const lc = e.toLowerCase();
      if (lc.includes('youremail') || lc.includes('user@domain') || lc.includes('@example')
          || lc.includes('mysite.com') || lc.startsWith('noreply')) return false;
      if (domain.includes('sentry') || domain.includes('wixpress') || domain.includes('pixel')) return false;
      return true;
    });
}

// Scrape contact from a known-correct website URL (not a guess)
async function scrapeFromKnownSite(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const mailtoEmails = extractMailtoEmails(html);
    const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g);
    return {
      contact_email: mailtoEmails[0] || null,
      phone: (phoneMatch || [])[0] || null,
    };
  } catch {
    return null;
  }
}

// OpenAI fallback (only runs if OPENAI_API_KEY is set)
async function openAiFallback(clubName) {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Return only valid JSON. Never invent data. Use null for any field you are not highly confident about.',
          },
          {
            role: 'user',
            content: `What is the official website and contact email for "${clubName}" figure skating club? Return JSON {website, contact_email, phone} or null for unknown fields.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(json);
    return {
      website: typeof parsed.website === 'string' ? parsed.website : null,
      contact_email: typeof parsed.contact_email === 'string' ? parsed.contact_email : null,
      phone: typeof parsed.phone === 'string' ? parsed.phone : null,
    };
  } catch {
    return null;
  }
}

async function run() {
  // Check if 011 migration is applied
  const { error: colCheck } = await supabase.from('clubs').select('website').limit(1);
  const hasWebsiteCol = !colCheck;

  if (!hasWebsiteCol) {
    console.log('[WARN] clubs.website column missing. To enable full storage, paste in Supabase SQL editor:');
    console.log('  ALTER TABLE clubs ADD COLUMN IF NOT EXISTS website text, ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS name_aliases text[];');
    console.log('  Proceeding with contact_email only.\n');
  } else {
    console.log('[OK] clubs.website column found.\n');
  }

  if (!OPENAI_KEY) {
    console.log('[INFO] OPENAI_API_KEY not set. OpenAI fallback disabled.\n');
  }

  // Get all distinct club_names from competition_results
  const { data: crRows, error: crErr } = await supabase
    .from('competition_results')
    .select('club_name')
    .not('club_name', 'is', null);

  if (crErr) {
    console.error('Failed to fetch competition_results:', crErr.message);
    process.exit(1);
  }

  const crClubNames = [...new Set((crRows || []).map(r => r.club_name.trim()))].sort();
  console.log(`Found ${crClubNames.length} distinct club names in competition_results.\n`);

  // Load existing clubs
  const { data: existingClubs, error: clubsErr } = await supabase
    .from('clubs')
    .select('id, name, contact_email');

  if (clubsErr) {
    console.error('Failed to fetch clubs:', clubsErr.message);
    process.exit(1);
  }

  const clubByName = new Map(
    (existingClubs || []).map(c => [c.name.trim().toLowerCase(), c])
  );

  let seeded = 0;
  let enriched = 0;
  let skipped = 0;

  for (let i = 0; i < crClubNames.length; i++) {
    const name = crClubNames[i];
    const key = name.toLowerCase();
    const staticInfo = STATIC_LOOKUP[key] || null;

    // Seed club if not in table
    let club = clubByName.get(key);
    if (!club) {
      const { data: inserted, error: insertErr } = await supabase
        .from('clubs')
        .insert({ name, country: 'US' })
        .select('id, name, contact_email')
        .single();

      if (insertErr) {
        console.error(`[${i + 1}/${crClubNames.length}] "${name}": insert failed - ${insertErr.message}`);
        continue;
      }
      club = inserted;
      clubByName.set(key, club);
      seeded++;
    }

    // Skip if already has verified email
    if (club.contact_email) {
      console.log(`[${i + 1}/${crClubNames.length}] "${name}": already has contact_email, skipping`);
      skipped++;
      await sleep(100);
      continue;
    }

    let website = staticInfo?.website || null;
    let contact_email = staticInfo?.contact_email || null;
    let phone = null;

    // Scrape from the known-correct website if we have one but no email
    if (website && !contact_email) {
      const scraped = await scrapeFromKnownSite(website);
      if (scraped) {
        contact_email = scraped.contact_email;
        phone = scraped.phone;
      }
      await sleep(2000);
    }

    // OpenAI fallback for clubs without a static website entry
    if (!contact_email && !website) {
      const ai = await openAiFallback(name);
      if (ai) {
        website = ai.website || null;
        contact_email = ai.contact_email || null;
        phone = ai.phone || null;
      }
      if (OPENAI_KEY) await sleep(1000);
    }

    // Build update from available columns
    const update = {};
    if (contact_email) update.contact_email = contact_email;
    if (hasWebsiteCol) {
      if (website) update.website = website;
      if (phone) update.phone = phone;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase
        .from('clubs')
        .update(update)
        .eq('id', club.id);

      if (updateErr) {
        console.error(`[${i + 1}/${crClubNames.length}] "${name}": update failed - ${updateErr.message}`);
      } else {
        enriched++;
        console.log(`[${i + 1}/${crClubNames.length}] "${name}": enriched - email=${contact_email ?? 'null'} phone=${phone ?? 'null'}`);
      }
    } else {
      console.log(`[${i + 1}/${crClubNames.length}] "${name}": no contact data found (add OPENAI_API_KEY for AI fallback)`);
    }
  }

  console.log(`\nSeed + enrich done. Seeded: ${seeded}, Enriched: ${enriched}, Already had data: ${skipped}`);

  // Link athletes to clubs based on competition_results
  console.log('\nLinking athletes to clubs via competition_results...');

  const { data: allClubs } = await supabase.from('clubs').select('id, name');
  const clubIdByName = new Map(
    (allClubs || []).map(c => [c.name.trim().toLowerCase(), c.id])
  );

  // Get all competition_results with athlete_id and club_name
  const { data: results, error: resErr } = await supabase
    .from('competition_results')
    .select('athlete_id, club_name')
    .not('club_name', 'is', null)
    .not('athlete_id', 'is', null);

  if (resErr) {
    console.error('Failed to fetch competition_results for linking:', resErr.message);
    return;
  }

  // Map athlete_id -> club_id (first match per athlete)
  const athleteClubMap = new Map();
  for (const row of (results || [])) {
    if (!row.athlete_id) continue;
    const cid = clubIdByName.get(row.club_name.trim().toLowerCase());
    if (cid && !athleteClubMap.has(row.athlete_id)) {
      athleteClubMap.set(row.athlete_id, cid);
    }
  }

  console.log(`Found ${athleteClubMap.size} athletes to potentially link.`);

  const athleteIds = [...athleteClubMap.keys()];
  if (athleteIds.length === 0) {
    console.log('No athletes to link.');
    return;
  }

  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, club_id')
    .in('id', athleteIds);

  let linked = 0;
  let alreadyLinked = 0;

  for (const athlete of (athletes || [])) {
    if (athlete.club_id) { alreadyLinked++; continue; }
    const clubId = athleteClubMap.get(athlete.id);
    if (!clubId) continue;

    const { error: linkErr } = await supabase
      .from('athletes')
      .update({ club_id: clubId })
      .eq('id', athlete.id);

    if (linkErr) {
      console.error(`  Athlete ${athlete.id}: link failed - ${linkErr.message}`);
    } else {
      linked++;
    }
  }

  console.log(`Link done. Newly linked: ${linked}, Already had club: ${alreadyLinked}`);
  console.log(`\nTotal: ${seeded} clubs seeded, ${enriched} enriched, ${linked} athletes newly linked.`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
