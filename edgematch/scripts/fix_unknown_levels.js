/**
 * scripts/fix_unknown_levels.js
 *
 * Backfills level = 'unknown' rows in competition_results.
 *
 * For each row where level is 'unknown':
 *  1. Fetch the IJS event index page for that event.
 *  2. Build a map: CAT number -> level string (by parsing the event label text).
 *  3. Extract the CAT number from the row's segment_url.
 *  4. Update the row in the DB with the resolved level.
 *
 * Usage:
 *   node scripts/fix_unknown_levels.js
 *   node scripts/fix_unknown_levels.js --dry-run
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, '../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* rely on env */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IJS_BASE    = 'https://ijs.usfigureskating.org';
const DRY_RUN     = process.argv.includes('--dry-run');
const DELAY_MS    = 1000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EdgeMatch/0.1 (partner-matching research)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function detectLevel(text) {
  const t = text.toLowerCase();
  if (t.includes('senior')) return 'senior';
  if (t.includes('championship')) return 'senior'; // US Champs uses "Championship" = Senior
  if (t.includes('junior')) return 'junior';
  if (t.includes('novice')) return 'novice';
  if (t.includes('intermediate')) return 'intermediate';
  if (t.includes('pre') && t.includes('juvenile')) return 'pre_juvenile';
  if (t.includes('juvenile')) return 'juvenile';
  if (t.includes('adult')) return 'adult';
  return null;
}

/**
 * Fetch an event index page and build a map: catNum (e.g. "009") -> level string.
 * Parses all event label cells for pairs and ice dance categories.
 */
async function buildCatLevelMap(year, eventId) {
  const url = `${IJS_BASE}/leaderboard/results/${year}/${eventId}/index.asp`;
  let html;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.error(`  Failed to fetch index for ${year}/${eventId}: ${err.message}`);
    return {};
  }

  const map = {};

  // Find all rows and track the last event-cell text
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let lastLabel = '';

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    // Event label cell: class containing "event"
    const eventCellMatch = row.match(/class="event[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (eventCellMatch) {
      const text = eventCellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 2) lastLabel = text;
    }

    // Any link to a CATxxxSEGxxx.html file
    const linkMatch = row.match(/href=["']?(CAT(\d+)SEG\d+\.html)["']?/i);
    if (!linkMatch) continue;

    const catNum = linkMatch[2]; // e.g. "005" or "9"
    if (map[catNum]) continue;  // already resolved this category

    const level = detectLevel(lastLabel);
    if (level) {
      map[catNum] = level;
    }
  }

  return map;
}

/** Extract CAT number from a segment URL like .../CAT009SEG010.html -> "009" */
function extractCatNum(segmentUrl) {
  if (!segmentUrl) return null;
  const m = segmentUrl.match(/CAT(\d+)SEG/i);
  return m ? m[1] : null;
}

async function main() {
  // 1. Fetch all unknown-level rows
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competition_results?level=eq.unknown&select=id,event_id,event_year,event_name,segment_url&limit=2000`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error(`DB fetch failed: HTTP ${res.status}`);
  const rows = await res.json();
  console.log(`Found ${rows.length} rows with level = 'unknown'`);

  if (rows.length === 0) { console.log('Nothing to fix.'); return; }

  // 2. Group by event_id + event_year
  const eventMap = new Map();
  for (const row of rows) {
    const key = `${row.event_year}/${row.event_id}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, { year: row.event_year, eventId: row.event_id, name: row.event_name, rows: [] });
    }
    eventMap.get(key).rows.push(row);
  }
  console.log(`Across ${eventMap.size} unique events`);

  let fixed = 0;
  let skipped = 0;

  for (const [key, event] of eventMap) {
    console.log(`\nEvent: ${event.name} (${key}) : ${event.rows.length} unknown rows`);
    await sleep(DELAY_MS);

    const catMap = await buildCatLevelMap(event.year, event.eventId);
    console.log(`  CAT->level map:`, catMap);

    for (const row of event.rows) {
      const catNum = extractCatNum(row.segment_url);
      const level  = catNum ? catMap[catNum] : null;

      if (!level) {
        console.log(`  [skip] id=${row.id} catNum=${catNum ?? 'none'} url=${row.segment_url}`);
        skipped++;
        continue;
      }

      console.log(`  [fix]  id=${row.id} cat=${catNum} -> ${level}`);

      if (!DRY_RUN) {
        const upd = await fetch(
          `${SUPABASE_URL}/rest/v1/competition_results?id=eq.${row.id}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ level }),
          }
        );
        if (!upd.ok) {
          const t = await upd.text();
          console.error(`    Update failed: ${t}`);
        } else {
          fixed++;
        }
      } else {
        fixed++;
      }
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`Fixed:   ${fixed}`);
  console.log(`Skipped: ${skipped}${DRY_RUN ? ' (dry run)' : ''}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
