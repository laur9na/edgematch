/**
 * scripts/pipeline/06_mirror_partner_results.js
 *
 * The scraper only inserted one row per ice dance/pairs team (the first
 * skater — almost always the lady). This script generates the mirror row
 * for the partner (man), then links both rows to athlete IDs.
 *
 * Usage: node scripts/pipeline/06_mirror_partner_results.js [--dry-run]
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = readFileSync(join(__dirname, '../../.env.local'), 'utf8');
const get = k => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim();

const sb = createClient(get('VITE_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name) {
  return name?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
}

function nameSimilarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Check first+last overlap
  const partsA = a.trim().split(/\s+/).map(p => p.toLowerCase());
  const partsB = b.trim().split(/\s+/).map(p => p.toLowerCase());
  const shared = partsA.filter(p => partsB.some(q => q.startsWith(p) || p.startsWith(q))).length;
  return shared / Math.max(partsA.length, partsB.length);
}

function findBestAthlete(name, athletes) {
  let best = null, bestScore = 0;
  for (const a of athletes) {
    const score = nameSimilarity(name, a.name);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 0.7 ? best : null;
}

async function run() {
  // Load all existing rows that have a partner_name (paginated)
  console.log('Loading competition results with partner names...');
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('competition_results')
      .select('*')
      .not('partner_name', 'is', null)
      .range(offset, offset + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`Loaded ${rows.length} rows with partner_name`);

  // Load all athletes for name matching
  const { data: athletes } = await sb.from('athletes').select('id, name');
  console.log(`Loaded ${athletes.length} athletes for matching`);

  // Build mirror rows (swap skater_name <-> partner_name)
  const mirrors = [];
  const skipped = [];

  for (const r of rows) {
    // The mirror row key: same event_id + segment, but skater_name = r.partner_name
    mirrors.push({
      athlete_id:    null, // will be filled below
      event_name:    r.event_name,
      event_year:    r.event_year,
      event_id:      r.event_id,
      segment_url:   r.segment_url,
      discipline:    r.discipline,
      level:         r.level,
      segment:       r.segment,
      skater_name:   r.partner_name,
      partner_name:  r.skater_name,
      club_name:     null,
      placement:     r.placement,
      total_score:   r.total_score,
      scraped_at:    r.scraped_at,
    });
  }

  // Link athlete IDs to mirror rows
  let linked = 0;
  for (const m of mirrors) {
    const match = findBestAthlete(m.skater_name, athletes);
    if (match) { m.athlete_id = match.id; linked++; }
  }

  console.log(`\nMirror rows: ${mirrors.length}`);
  console.log(`Linked to athletes: ${linked}`);
  console.log(`Unlinked: ${mirrors.length - linked}`);

  if (DRY_RUN) {
    console.log('\nDry run — no writes.');
    console.log('Sample linked:', JSON.stringify(mirrors.filter(m => m.athlete_id).slice(0, 3).map(m => ({
      skater: m.skater_name, athlete_id: m.athlete_id, event: m.event_name,
    }))));
    return;
  }

  // Upsert in batches (on_conflict: event_id, segment, skater_name)
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < mirrors.length; i += BATCH) {
    const batch = mirrors.slice(i, i + BATCH);
    const { error: err } = await sb.from('competition_results')
      .upsert(batch, { onConflict: 'event_id,segment,skater_name', ignoreDuplicates: true });
    if (err) console.error(`Batch error: ${err.message}`);
    else inserted += batch.length;
    process.stdout.write(`  Upserted ${Math.min(inserted, mirrors.length)}/${mirrors.length}\r`);
  }
  console.log(`\nDone. ${inserted} mirror rows upserted.`);
}

run().catch(err => { console.error(err.message); process.exit(1); });
