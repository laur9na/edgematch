/**
 * supabase/functions/refresh_athlete_db/index.ts
 * Schedule: 0 3 * * * (3am UTC daily)
 *
 * Steps:
 *   1. Scrape IcePartnerSearch (pairs + ice_dance only)
 *   2. Normalize + deduplicate
 *   3. Upsert into raw_athletes (ON CONFLICT DO NOTHING by source_url)
 *   4. Promote raw_athletes to athletes where not already promoted
 *   5. Trigger score_new_athlete for each newly promoted athlete
 *   6. Log results
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IPS_BASE = 'https://icepartnersearch.com';
const DELAY_MS = 1500;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseDiscipline(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('pairs')) return 'pairs';
  if (s.includes('dance')) return 'ice_dance';
  return null;
}

function parseLevel(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('senior')) return 'senior';
  if (s.includes('junior')) return 'junior';
  if (s.includes('novice')) return 'novice';
  if (s.includes('intermediate') || s === 'int') return 'intermediate';
  if (s.includes('pre') && s.includes('juvenile')) return 'pre_juvenile';
  if (s.includes('juvenile')) return 'juvenile';
  if (s.includes('adult')) return 'adult';
  return null;
}

function parseHeight(raw: string | null): number | null {
  if (!raw) return null;
  const cm = raw.match(/(\d+)\s*cm/i);
  if (cm) return parseFloat(cm[1]);
  const ftIn = raw.match(/(\d+)'(\d+)"/);
  if (ftIn) return Math.round((parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54);
  return null;
}

function parseLocation(raw: string | null) {
  if (!raw) return { city: null, state: null, country: 'US' };
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts.slice(2).join(', ') };
  if (parts.length === 2) return { city: parts[0], state: null, country: parts[1] };
  return { city: null, state: null, country: parts[0] };
}

async function collectBioIds(): Promise<string[]> {
  const html = await fetchHtml(`${IPS_BASE}/searchbyqualities.php?submit=1`);
  const matches = html.match(/showbio\.php\?i=(\d+)/g) ?? [];
  return [...new Set(matches.map((m) => m.match(/\d+/)?.[0] ?? '').filter(Boolean))];
}

function parseBio(html: string, id: string) {
  function getField(label: string): string | null {
    const re = new RegExp(`${label}[\\s\\S]*?<th[^>]*>([^<]+)</th>`, 'i');
    const m = html.match(re);
    return m ? m[1].replace(/\u00a0/g, ' ').trim() : null;
  }

  const nameMatch = html.match(/<div[^>]*class="title"[^>]*><a[^>]*>([^<]+)<\/a>/i);
  const name = nameMatch?.[1]?.trim() ?? null;

  const wantsBlock = html.match(/Wants to compete[\s\S]*?<\/td>/i)?.[0] ?? '';
  const disciplineRaw = wantsBlock.match(/<b>(Pairs|Dance)<\/b>/i)?.[1] ?? null;
  const discipline = parseDiscipline(disciplineRaw);

  const levelMatches = [...wantsBlock.matchAll(/<(?:div|b)[^>]*><b>(Senior|Junior|Novice|Intermediate|Juvenile|Pre-Juvenile|Adult)<\/b>/gi)];
  const levels = levelMatches.map((m) => m[1]);
  const LEVEL_ORDER = ['pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'];
  let skating_level: string | null = null;
  let bestIdx = -1;
  for (const l of levels) {
    const norm = parseLevel(l);
    if (norm) {
      const idx = LEVEL_ORDER.indexOf(norm);
      if (idx > bestIdx) { bestIdx = idx; skating_level = norm; }
    }
  }

  const genderRaw = getField('Gender');
  const partner_role = genderRaw === 'Female' ? 'lady' : genderRaw === 'Male' ? 'man' : 'either';

  const height_cm = parseHeight(getField('Height'));
  const locationRaw = getField('Location');
  const { city, state, country } = parseLocation(locationRaw);
  const contact_note = getField('Email') ?? getField('Telephone #') ?? null;
  const ageRaw = getField('Age');
  const age = ageRaw ? parseInt(ageRaw, 10) || null : null;

  return {
    name,
    discipline,
    skating_level,
    partner_role,
    height_cm,
    location_city: city,
    location_state: state,
    location_country: country ?? 'US',
    age,
    contact_note,
    source: 'icepartnersearch',
    source_url: `${IPS_BASE}/showbio.php?i=${id}`,
    review_flag: !discipline || !skating_level || !height_cm || !name,
    promoted: false,
  };
}

Deno.serve(async (_req: Request) => {
  const log: string[] = [];
  let added = 0;
  let promoted = 0;
  let scored = 0;
  const errors: string[] = [];

  try {
    log.push('Starting IcePartnerSearch scrape...');
    const ids = await collectBioIds();
    log.push(`Found ${ids.length} profiles`);

    for (let i = 0; i < ids.length; i++) {
      try {
        const html = await fetchHtml(`${IPS_BASE}/showbio.php?i=${ids[i]}`);
        const record = parseBio(html, ids[i]);

        if (!record.discipline || record.review_flag) {
          if (i < ids.length - 1) await sleep(DELAY_MS);
          continue;
        }

        const { error } = await supabase
          .from('raw_athletes')
          .insert(record)
          .select();

        if (!error) added++;
      } catch (err) {
        errors.push(`Bio ${ids[i]}: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (i < ids.length - 1) await sleep(DELAY_MS);
    }

    log.push(`Scraped: ${added} new raw_athletes inserted`);

    // Promote raw_athletes that pass validation into athletes table
    const { data: unpromoted } = await supabase
      .from('raw_athletes')
      .select('*')
      .eq('promoted', false)
      .eq('review_flag', false)
      .not('discipline', 'is', null)
      .not('skating_level', 'is', null)
      .not('height_cm', 'is', null)
      .not('name', 'is', null);

    for (const raw of unpromoted ?? []) {
      const athlete = {
        name: raw.name,
        discipline: raw.discipline,
        skating_level: raw.skating_level,
        partner_role: raw.partner_role ?? 'either',
        height_cm: raw.height_cm,
        location_city: raw.location_city,
        location_state: raw.location_state,
        location_country: raw.location_country ?? 'US',
        age: raw.age,
        source: raw.source,
        source_url: raw.source_url,
        search_status: 'active',
      };

      const { data: newAthlete, error: insertErr } = await supabase
        .from('athletes')
        .insert(athlete)
        .select('id')
        .single();

      if (!insertErr && newAthlete) {
        await supabase.from('raw_athletes').update({ promoted: true }).eq('id', raw.id);
        promoted++;

        // Score new athlete against all existing
        const { error: scoreErr } = await supabase.rpc('score_new_athlete', {
          new_athlete_id: newAthlete.id,
        });
        if (!scoreErr) scored++;
      }
    }

    log.push(`Promoted: ${promoted} athletes`);
    log.push(`Scored: ${scored} athletes`);
    if (errors.length) log.push(`Errors: ${errors.join('; ')}`);

  } catch (err) {
    log.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  }

  return new Response(JSON.stringify({ ok: true, log, added, promoted, scored, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
