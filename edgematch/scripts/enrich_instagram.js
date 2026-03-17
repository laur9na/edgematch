/**
 * scripts/enrich_instagram.js — Phase 9.3
 *
 * For athletes where instagram_handle IS NULL and contact_note IS NOT NULL:
 *   - Prompt Claude: extract Instagram handle from contact_note text
 *   - Only write if confident. Never invent.
 *   - Run once after seed, then included in daily cron.
 *
 * Usage:
 *   node scripts/enrich_instagram.js
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY in .env.local
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
try {
  const env = readFileSync(join(__dirname, '../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  // .env.local not found — rely on environment variables
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const DELAY_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: HTTP ${res.status}`);
  return res.json();
}

async function supabasePatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table}/${id}: HTTP ${res.status}`);
}

/**
 * Ask Claude to extract an Instagram handle from arbitrary text.
 * Returns the handle (without @) or null if not found or not confident.
 */
async function extractInstagramHandle(contactNote) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: `Extract the Instagram handle from this text if present. Return only the handle without @, or the word null if not present. Do not explain. Text: ${contactNote}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API: HTTP ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() ?? 'null';

  if (text === 'null' || !text) return null;

  // Validate: Instagram handles are 1-30 chars, alphanumeric + . + _
  if (/^[a-zA-Z0-9._]{1,30}$/.test(text)) return text;
  return null;
}

async function main() {
  // Fetch athletes missing instagram_handle but having contact_note
  const athletes = await supabaseGet(
    'athletes?select=id,name,contact_note&instagram_handle=is.null&contact_note=not.is.null'
  );

  console.log(`Found ${athletes.length} athletes to enrich`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < athletes.length; i++) {
    const athlete = athletes[i];
    try {
      const handle = await extractInstagramHandle(athlete.contact_note);
      if (handle) {
        await supabasePatch('athletes', athlete.id, { instagram_handle: handle });
        updated++;
        console.log(`[${i + 1}/${athletes.length}] ${athlete.name}: @${handle}`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[${i + 1}/${athletes.length}] ${athlete.name}: ERROR ${err.message}`);
      errors++;
    }

    if (i < athletes.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
