/**
 * scripts/enrich_clubs.js — Phase 12.3
 *
 * For each club where website IS NULL:
 *   - Ask OpenAI to find website, contact_email, phone
 *   - Only write fields with high confidence. Never invent.
 *   - Rate limit: 1 request per second
 *
 * Usage: node scripts/enrich_clubs.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env.local
 *
 * NOTE: Requires supabase/migrations/011_clubs_enrich.sql to be applied first
 *       (adds website, phone, name_aliases columns to clubs).
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
const OPENAI_KEY = env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (!OPENAI_KEY) {
  console.warn('OPENAI_API_KEY not set in .env.local — skipping club enrichment');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function checkColumnsExist() {
  const { error } = await supabase.from('clubs').select('website, phone, name_aliases').limit(1);
  if (error) {
    console.error('clubs table is missing website/phone/name_aliases columns.');
    console.error('Apply supabase/migrations/011_clubs_enrich.sql via Supabase dashboard, then re-run.');
    process.exit(1);
  }
}

async function findClubInfo(name, city, state) {
  const location = [city, state].filter(Boolean).join(', ');
  const prompt = location
    ? `Find the official website and contact email for the "${name}" figure skating club in ${location}. Return JSON only with keys: website, contact_email, phone. Use null for any field you are not highly confident about. Do not invent or guess.`
    : `Find the official website and contact email for the "${name}" figure skating club. Return JSON only with keys: website, contact_email, phone. Use null for any field you are not highly confident about. Do not invent or guess.`;

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
          content: 'You are a research assistant. Return only valid JSON. Never invent data.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(json);
    return {
      website: typeof parsed.website === 'string' ? parsed.website : null,
      contact_email: typeof parsed.contact_email === 'string' ? parsed.contact_email : null,
      phone: typeof parsed.phone === 'string' ? parsed.phone : null,
    };
  } catch {
    return { website: null, contact_email: null, phone: null };
  }
}

async function run() {
  await checkColumnsExist();

  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, name, city, state, website')
    .is('website', null);

  if (error) {
    console.error('Failed to fetch clubs:', error.message);
    process.exit(1);
  }

  console.log(`Found ${clubs.length} club(s) to enrich`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i];
    try {
      const info = await findClubInfo(club.name, club.city, club.state);
      const hasData = info.website || info.contact_email || info.phone;

      if (hasData) {
        const { error: updateErr } = await supabase
          .from('clubs')
          .update(info)
          .eq('id', club.id);

        if (updateErr) {
          console.error(`[${i + 1}/${clubs.length}] "${club.name}": update failed — ${updateErr.message}`);
          errors++;
        } else {
          updated++;
          console.log(`[${i + 1}/${clubs.length}] "${club.name}": website=${info.website ?? 'null'} email=${info.contact_email ?? 'null'}`);
        }
      } else {
        skipped++;
        console.log(`[${i + 1}/${clubs.length}] "${club.name}": no data found`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${clubs.length}] "${club.name}": ERROR ${err.message}`);
      errors++;
    }

    if (i < clubs.length - 1) await sleep(1000);
  }

  console.log(`\nDone. Updated: ${updated}, No data: ${skipped}, Errors: ${errors}`);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
