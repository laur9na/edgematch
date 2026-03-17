/**
 * scripts/scrape_results.js — Phase 11
 *
 * Scrapes competition results from ijs.usfigureskating.org for events in event_ids.json.
 * Matches results to athletes table by name + club. Inserts into competition_results.
 *
 * URL patterns:
 *   /leaderboard/results/{year}/{event_id}/index.asp          — event index
 *   /leaderboard/results/{year}/{event_id}/CAT{N}SEG{N}.html  — segment results
 *
 * Usage:
 *   node scripts/scrape_results.js
 *   node scripts/scrape_results.js --dry-run   (parse only, no DB writes)
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
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
  // rely on environment variables
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IJS_BASE = 'https://ijs.usfigureskating.org';
const DELAY_MS = 1500;
const MATCH_THRESHOLD = 0.75;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EVENT_IDS = JSON.parse(readFileSync(join(__dirname, 'event_ids.json'), 'utf8'));

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
// Detect discipline from segment link text / URL
// ---------------------------------------------------------------------------

function detectDiscipline(text) {
  const t = text.toLowerCase();
  if (t.includes('pair')) return 'pairs';
  if (t.includes('dance') || t.includes('rhythm') || t.includes('free dance')) return 'ice_dance';
  return null;
}

// Detect level from segment heading text
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

// Detect segment name (Short Program, Free Skate, etc.)
function detectSegment(text) {
  const t = text.toLowerCase();
  if (t.includes('rhythm')) return 'Rhythm Dance';
  if (t.includes('free dance')) return 'Free Dance';
  if (t.includes('short') || t.includes('sp ') || t.includes('_sp')) return 'Short Program';
  if (t.includes('free') || t.includes('fs ') || t.includes('_fs')) return 'Free Skate';
  return text.trim();
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

  // IJS pages use unquoted href: <A href=CAT001SEG001.html>
  // Row structure: <TD class="event ...">Novice Pairs / Short Program</TD>...
  //               <TD class="stat ..."><A href=CAT001SEG001.html>Final</A></TD>
  //
  // Strategy: parse each <TR>, find any CAT*SEG*.html link in it, and look
  // at all text in that row + the closest preceding row with event text.

  // Extract all table rows
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    rows.push(rm[1]);
  }

  const links = [];
  const seen = new Set();

  // Track the last seen event label across rows (rowspan cells often split info)
  let lastEventLabel = '';

  for (const row of rows) {
    // Update event label if this row contains one
    const eventCellMatch = row.match(/class="event[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (eventCellMatch) {
      const cellText = eventCellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cellText.length > 2) lastEventLabel = cellText;
    }

    // Look for a CAT*SEG*.html link (quoted or unquoted href)
    const linkMatch = row.match(/href=["']?(CAT\d+SEG\d+\.html)["']?/i);
    if (!linkMatch) continue;

    const filename = linkMatch[1];
    const fullUrl = `${IJS_BASE}/leaderboard/results/${year}/${eventId}/${filename}`;
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);

    // Use the event label from this row or the last seen one
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

  // IJS segment pages have parent result rows structured as:
  // <TR class=parent id="XXXX">
  //   <TD class=place>1</TD>
  //   <TD class=start>2</TD>
  //   <TD class=name sort-key=...>First Last, Club Name<BR>First Last, Club Name</TD>
  //   <TD class=score>41.33</TD>
  //   ...
  // </TR>
  //
  // For singles events the name cell has one skater, for pairs/dance there are two
  // separated by <BR>.

  const parentRowRe = /<TR[^>]*class=parent[^>]*>([\s\S]*?)<\/TR>/gi;
  let rowMatch;

  while ((rowMatch = parentRowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    // Extract placement
    const placeMatch = row.match(/<TD[^>]*class=place[^>]*>\s*(\d+)\s*<\/TD>/i);
    if (!placeMatch) continue;
    const placement = parseInt(placeMatch[1], 10);
    if (isNaN(placement) || placement < 1) continue;

    // Extract name cell — contains "Name1, Club1<BR>Name2, Club2" for teams
    const nameMatch = row.match(/<TD[^>]*class=name[^>]*>([\s\S]*?)<\/TD>/i);
    if (!nameMatch) continue;
    const nameCell = nameMatch[1];

    // Split on <BR> to get individual skater entries
    const entries = nameCell.split(/<BR\s*\/?>/i).map((e) => stripHtml(e));

    // Each entry: "First Last, Club Name"
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

    // Extract score
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

  if (best && best.confidence >= MATCH_THRESHOLD) {
    return best;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DB insert
// ---------------------------------------------------------------------------

async function insertResult(record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_results`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
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

async function main() {
  console.log(`Loading athletes from Supabase...`);
  const athletes = await loadAthletes();
  console.log(`Loaded ${athletes.length} active athletes for matching`);

  let totalInserted = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  const unmatched = [];

  for (const event of EVENT_IDS) {
    console.log(`\nEvent: ${event.event_name} (${event.year}/${event.event_id})`);

    const segments = await getSegmentLinks(event.year, event.event_id);
    console.log(`  Found ${segments.length} pairs/dance segment(s)`);

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

      const rows = parseSegmentHtml(html);
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
          try {
            await insertResult(record);
            totalInserted++;
          } catch (err) {
            // ON CONFLICT DO NOTHING — duplicates are expected on re-runs
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
  console.log(`Results inserted:  ${totalInserted}${DRY_RUN ? ' (dry run)' : ''}`);
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
