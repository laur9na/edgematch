/**
 * scripts/scrape_results.js — Phase 11 + live detection
 *
 * Scrapes competition results from ijs.usfigureskating.org for events in event_ids.json.
 * Matches results to athletes table by name + club. Inserts into competition_results.
 *
 * Current-year events (2026) are always re-scraped with ON CONFLICT DO UPDATE so
 * stale scores are overwritten on every cron run.
 *
 * Before scraping, the USFS calendar for the current year is checked for new event IDs
 * not yet in event_ids.json. Any found are auto-added and persisted to disk.
 *
 * URL patterns:
 *   /leaderboard/results/{year}/                       — year calendar (new event discovery)
 *   /leaderboard/results/{year}/{event_id}/index.asp   — event index
 *   /leaderboard/results/{year}/{event_id}/CAT{N}SEG{N}.html — segment results
 *
 * Usage:
 *   node scripts/scrape_results.js
 *   node scripts/scrape_results.js --dry-run   (parse only, no DB writes)
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, writeFileSync } from 'fs';
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
  // rely on environment variables
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IJS_BASE = 'https://ijs.usfigureskating.org';
const ISU_BASE = 'https://results.isu.org';
const DELAY_MS = 1500;
const MATCH_THRESHOLD = 0.75;
const DRY_RUN = process.argv.includes('--dry-run');
const CURRENT_YEAR = new Date().getFullYear();
const EVENT_IDS_PATH = join(__dirname, 'event_ids.json');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

let EVENT_IDS = JSON.parse(readFileSync(EVENT_IDS_PATH, 'utf8'));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'EdgeMatch/0.1 (partner-matching research; contact: edgematch-bot@example.com)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Step 0: discover new events from the USFS year calendar
// ---------------------------------------------------------------------------

async function discoverNewEvents(year) {
  const calendarUrl = `${IJS_BASE}/leaderboard/results/${year}/`;
  let html;
  try {
    html = await fetchHtml(calendarUrl);
  } catch (err) {
    console.warn(`  Calendar fetch failed for ${year}: ${err.message}`);
    return [];
  }

  // Extract all event IDs from href patterns like:
  //   /leaderboard/results/2026/36273/   or
  //   /leaderboard/results/2026/36273/index.asp
  const idPattern = new RegExp(
    `/leaderboard/results/${year}/(\\d{4,6})(?:/[^"'\\s>]*)?["'\\s>]`,
    'gi'
  );

  const foundIds = new Set();
  let m;
  while ((m = idPattern.exec(html)) !== null) {
    foundIds.add(m[1]);
  }

  const existingIds = new Set(EVENT_IDS.filter(e => e.year === year).map(e => String(e.event_id)));
  const newIds = [...foundIds].filter(id => !existingIds.has(id));

  if (newIds.length === 0) return [];

  // For each new ID, try to get event name from the index page title
  const newEvents = [];
  for (const id of newIds) {
    await sleep(500);
    let name = `${year} Event ${id}`;
    try {
      const indexHtml = await fetchHtml(`${IJS_BASE}/leaderboard/results/${year}/${id}/index.asp`);
      // Look for a <title> tag or heading
      const titleMatch = indexHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        name = titleMatch[1].replace(/\s+/g, ' ').trim().replace(/\s*-\s*IJS.*$/i, '').trim();
      } else {
        const h1Match = indexHtml.match(/<h[123][^>]*>([^<]+)<\/h[123]>/i);
        if (h1Match) name = h1Match[1].replace(/\s+/g, ' ').trim();
      }
    } catch {
      // event not live yet or 404 — skip
      continue;
    }
    newEvents.push({ year, event_id: id, event_name: name, source: 'usfs' });
    console.log(`  Discovered new event: "${name}" (${year}/${id})`);
  }

  return newEvents;
}

// ---------------------------------------------------------------------------
// Name fuzzy match — Levenshtein-based similarity
// ---------------------------------------------------------------------------

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(na, nb) / maxLen;
}

function clubSimilarity(a, b) {
  if (!a || !b) return 0.5;
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return 0.5;
}

// ---------------------------------------------------------------------------
// Detect discipline / level / segment from text
// ---------------------------------------------------------------------------

function detectDiscipline(text) {
  const t = text.toLowerCase();
  if (t.includes('pair')) return 'pairs';
  if (t.includes('dance') || t.includes('rhythm') || t.includes('free dance')) return 'ice_dance';
  return null;
}

function detectLevel(text) {
  const t = text.toLowerCase();
  if (t.includes('senior')) return 'senior';
  if (t.includes('junior')) return 'junior';
  if (t.includes('novice')) return 'novice';
  if (t.includes('intermediate')) return 'intermediate';
  if (t.includes('juvenile') && t.includes('pre')) return 'pre_juvenile';
  if (t.includes('juvenile')) return 'juvenile';
  if (t.includes('adult')) return 'adult';
  return 'unknown';
}

function detectSegment(text) {
  const t = text.toLowerCase();
  if (t.includes('rhythm')) return 'Rhythm Dance';
  if (t.includes('free dance')) return 'Free Dance';
  if (t.includes('short') || t.includes('sp ') || t.includes('_sp')) return 'Short Program';
  if (t.includes('free') || t.includes('fs ') || t.includes('_fs')) return 'Free Skate';
  return text.trim();
}

// ---------------------------------------------------------------------------
// ISU: normalize "First LAST" or "FIRST LAST" to "First Last"
// ---------------------------------------------------------------------------

function titleCase(name) {
  return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ISU results pages use fixed segment numbers:
//   SEG005 = Pairs Short Program
//   SEG006 = Pairs Free Skating
//   SEG007 = Ice Dance Rhythm Dance
//   SEG008 = Ice Dance Free Dance
// Returns the same shape as getSegmentLinks.
function getIsuSegments(event) {
  const base = `${ISU_BASE}/results/season${event.season}/${event.event_id}`;
  return [
    { url: `${base}/SEG005.htm`, discipline: 'pairs',     level: event.level, segment: 'Short Program' },
    { url: `${base}/SEG006.htm`, discipline: 'pairs',     level: event.level, segment: 'Free Skate' },
    { url: `${base}/SEG007.htm`, discipline: 'ice_dance', level: event.level, segment: 'Rhythm Dance' },
    { url: `${base}/SEG008.htm`, discipline: 'ice_dance', level: event.level, segment: 'Free Dance' },
  ];
}

// Parse ISU segment HTML.
// Row format (alternating Line1Green / Line2Green):
//   <td align="center">1</td>          <- placement
//   <td align="center">Q</td>          <- qual (skip)
//   <td class="CellLeft"><a>Name1 / Name2</a></td>  <- names
//   <td>JPN</td>                        <- nation
//   <td align="right">76.57</td>        <- TSS
function parseIsuSegmentHtml(html) {
  const results = [];
  // Pairs use Line1Green/Line2Green; ice dance uses Line1Yellow/Line2Yellow
  const rowRe = /<tr\s+class="Line[12](?:Green|Yellow)?"\s*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    // Placement: first <td align="center"> with a digit
    const placeMatch = row.match(/<td[^>]*align="center"[^>]*>\s*(\d+)\s*<\/td>/i);
    if (!placeMatch) continue;
    const placement = parseInt(placeMatch[1], 10);
    if (isNaN(placement) || placement < 1) continue;

    // Names: <td class="CellLeft">
    const nameCell = row.match(/<td[^>]*class="CellLeft"[^>]*>([\s\S]*?)<\/td>/i);
    if (!nameCell) continue;
    const rawName = nameCell[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Split on " / " for pairs/dance partner
    const parts = rawName.split(/\s*\/\s*/);
    const skaterName = titleCase(parts[0] || '');
    const partnerName = parts[1] ? titleCase(parts[1]) : null;
    if (!skaterName || skaterName.length < 2) continue;

    // TSS: first <td align="right">
    const scoreMatch = row.match(/<td[^>]*align="right"[^>]*>\s*([\d.]+)\s*<\/td>/i);
    const totalScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    results.push({ placement, skaterName, partnerName, clubName: null, totalScore });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Step 2: get segment links from event index page
// ---------------------------------------------------------------------------

async function getSegmentLinks(year, eventId) {
  const url = `${IJS_BASE}/leaderboard/results/${year}/${eventId}/index.asp`;
  let html;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.error(`  Index fetch failed for event ${eventId}: ${err.message}`);
    return [];
  }

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    rows.push(rm[1]);
  }

  const links = [];
  const seen = new Set();
  let lastEventLabel = '';

  for (const row of rows) {
    const eventCellMatch = row.match(/class="event[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (eventCellMatch) {
      const cellText = eventCellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cellText.length > 2) lastEventLabel = cellText;
    }

    const linkMatch = row.match(/href=["']?(CAT\d+SEG\d+\.html)["']?/i);
    if (!linkMatch) continue;

    const filename = linkMatch[1];
    const fullUrl = `${IJS_BASE}/leaderboard/results/${year}/${eventId}/${filename}`;
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);

    const context = row + ' ' + lastEventLabel;
    const discipline = detectDiscipline(context);
    if (!discipline) continue;

    const level = detectLevel(lastEventLabel || context);
    const segment = detectSegment(lastEventLabel || context);

    links.push({ url: fullUrl, discipline, level, segment });
  }

  return links;
}

// ---------------------------------------------------------------------------
// Step 3: parse a segment results page
// ---------------------------------------------------------------------------

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSegmentHtml(html) {
  const results = [];
  const parentRowRe = /<TR[^>]*class=parent[^>]*>([\s\S]*?)<\/TR>/gi;
  let rowMatch;

  while ((rowMatch = parentRowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    const placeMatch = row.match(/<TD[^>]*class=place[^>]*>\s*(\d+)\s*<\/TD>/i);
    if (!placeMatch) continue;
    const placement = parseInt(placeMatch[1], 10);
    if (isNaN(placement) || placement < 1) continue;

    const nameMatch = row.match(/<TD[^>]*class=name[^>]*>([\s\S]*?)<\/TD>/i);
    if (!nameMatch) continue;
    const nameCell = nameMatch[1];

    const entries = nameCell.split(/<BR\s*\/?>/i).map((e) => stripHtml(e));

    function splitEntry(entry) {
      const commaIdx = entry.indexOf(',');
      if (commaIdx === -1) return { name: entry.trim(), club: null };
      return {
        name: entry.slice(0, commaIdx).trim(),
        club: entry.slice(commaIdx + 1).trim() || null,
      };
    }

    const first = splitEntry(entries[0] ?? '');
    const second = entries.length >= 2 ? splitEntry(entries[1]) : null;

    if (!first.name || first.name.length < 2) continue;

    const scoreMatch = row.match(/<TD[^>]*class=score[^>]*>\s*([\d.]+)\s*<\/TD>/i);
    const totalScore = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    results.push({
      placement,
      skaterName: first.name,
      partnerName: second?.name ?? null,
      clubName: first.club ?? second?.club ?? null,
      totalScore,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step 4: match a skater name + club to an athlete in the DB
// ---------------------------------------------------------------------------

async function loadAthletes() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/athletes?select=id,name,club_name,location_state&search_status=eq.active`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase athletes fetch: HTTP ${res.status}`);
  return res.json();
}

function findBestMatch(skaterName, clubName, athletes) {
  let best = null;
  let bestScore = 0;

  for (const athlete of athletes) {
    const nameScore = nameSimilarity(skaterName, athlete.name);
    const clubScore = clubSimilarity(clubName, athlete.club_name);
    const confidence = nameScore * 0.7 + clubScore * 0.3;

    if (confidence > bestScore) {
      bestScore = confidence;
      best = { athlete, confidence };
    }
  }

  if (best && best.confidence >= MATCH_THRESHOLD) return best;
  return null;
}

// ---------------------------------------------------------------------------
// DB insert / upsert
// ---------------------------------------------------------------------------

async function insertResult(record, upsert = false) {
  // upsert=true for current-year events: overwrite stale scores on conflict
  // upsert=false for past events: ignore duplicates (already final)
  // on_conflict param tells PostgREST which columns form the unique key
  const url = upsert
    ? `${SUPABASE_URL}/rest/v1/competition_results?on_conflict=event_id,segment,skater_name`
    : `${SUPABASE_URL}/rest/v1/competition_results`;

  const prefer = upsert
    ? 'resolution=merge-duplicates,return=minimal'
    : 'resolution=ignore-duplicates,return=minimal';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: HTTP ${res.status} — ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function checkTableExists() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competition_results?limit=0`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (res.status === 404) {
    console.error('competition_results table is missing.');
    console.error('Apply supabase/migrations/009_competition_results.sql via Supabase dashboard SQL editor, then re-run.');
    process.exit(1);
  }
}

async function main() {
  if (!DRY_RUN) await checkTableExists();

  // Step 0: discover new events for current year
  console.log(`Checking for new ${CURRENT_YEAR} events on USFS calendar...`);
  const newEvents = DRY_RUN ? [] : await discoverNewEvents(CURRENT_YEAR);
  if (newEvents.length > 0) {
    EVENT_IDS = [...EVENT_IDS, ...newEvents];
    writeFileSync(EVENT_IDS_PATH, JSON.stringify(EVENT_IDS, null, 2) + '\n');
    console.log(`Added ${newEvents.length} new event(s) to event_ids.json`);
  } else {
    console.log(`No new events found.`);
  }

  console.log(`\nLoading athletes from Supabase...`);
  const athletes = await loadAthletes();
  console.log(`Loaded ${athletes.length} active athletes for matching`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  const unmatched = [];

  for (const event of EVENT_IDS) {
    const isCurrentYear = event.year === CURRENT_YEAR;
    const isIsu = event.source === 'isu';
    console.log(`\nEvent: ${event.event_name} (${event.year}/${event.event_id}) [${isIsu ? 'ISU' : 'USFS'}]${isCurrentYear ? ' [live — upsert]' : ''}`);

    let segments;
    if (isIsu) {
      segments = getIsuSegments(event);
      console.log(`  Using ${segments.length} fixed ISU segments`);
    } else {
      segments = await getSegmentLinks(event.year, event.event_id);
      console.log(`  Found ${segments.length} pairs/dance segment(s)`);
    }

    for (const seg of segments) {
      console.log(`  Segment: ${seg.discipline} ${seg.level} ${seg.segment} — ${seg.url}`);
      await sleep(DELAY_MS);

      let html;
      try {
        html = await fetchHtml(seg.url);
      } catch (err) {
        console.error(`    Fetch failed: ${err.message}`);
        continue;
      }

      const rows = isIsu ? parseIsuSegmentHtml(html) : parseSegmentHtml(html);
      console.log(`    Parsed ${rows.length} result rows`);

      for (const row of rows) {
        const match = findBestMatch(row.skaterName, row.clubName, athletes);
        const athleteId = match?.athlete.id ?? null;

        if (match) {
          totalMatched++;
        } else {
          totalUnmatched++;
          unmatched.push({ skaterName: row.skaterName, clubName: row.clubName, event: event.event_name });
        }

        const record = {
          athlete_id: athleteId,
          event_name: event.event_name,
          event_year: event.year,
          event_id: event.event_id,
          segment_url: seg.url,
          discipline: seg.discipline,
          level: seg.level,
          segment: seg.segment,
          skater_name: row.skaterName,
          partner_name: row.partnerName ?? null,
          club_name: row.clubName ?? null,
          placement: row.placement,
          total_score: row.totalScore ?? null,
        };

        if (!DRY_RUN) {
          if (isCurrentYear) totalUpdated++; else totalInserted++;
          try {
            await insertResult(record, isCurrentYear);
          } catch (err) {
            if (!err.message.includes('23505') && !err.message.includes('duplicate')) {
              console.error(`    Insert error for ${row.skaterName}: ${err.message}`);
            }
          }
        } else {
          totalInserted++;
        }
      }
    }
  }

  console.log(`\n--- Summary ---`);
  if (DRY_RUN) {
    console.log(`Results parsed:     ${totalInserted} (dry run)`);
  } else {
    console.log(`Past results saved: ${totalInserted}`);
    console.log(`Live results upserted: ${totalUpdated}`);
  }
  console.log(`Matched to athlete: ${totalMatched}`);
  console.log(`Unmatched:          ${totalUnmatched}`);

  if (unmatched.length > 0) {
    console.log(`\nUnmatched skaters (top 20):`);
    for (const u of unmatched.slice(0, 20)) {
      console.log(`  ${u.skaterName} (${u.clubName ?? 'no club'}) @ ${u.event}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
