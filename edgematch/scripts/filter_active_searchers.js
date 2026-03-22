/**
 * scripts/filter_active_searchers.js
 *
 * Step 1: Scrape IcePartnerSearch.com for listed skaters
 * Step 2: Classify each athlete's search_status based on:
 *         - IPS presence (active)
 *         - competition_results recency (active / paused / inactive)
 *         - Leaves 'matched' status untouched
 * Step 3: Print summary, ask for confirmation
 * Step 4: Batch UPDATE athletes in groups of 50
 *
 * Run: node scripts/filter_active_searchers.js
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from 'fs';
import readline from 'readline';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => env.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim();

const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

// Levenshtein-based similarity (0 to 1)
function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  const m = na.length, n = nb.length;
  if (!m || !n) return 0;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = na[i-1] === nb[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

function normalize(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// STEP 1: Scrape IcePartnerSearch
async function scrapeIPS() {
  console.log('\n── Step 1: Scraping IcePartnerSearch.com ──');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  const skaters = [];

  try {
    await page.goto('https://www.icepartnersearch.com', { waitUntil: 'networkidle2' });

    // Wait for any listing content to load
    await page.waitForSelector('body', { timeout: 10000 });

    // IPS requires login to see the full skater listing.
    // Try the /search page first, then fall back to scraping visible public listings.
    const pagesToTry = [
      'https://www.icepartnersearch.com/search',
      'https://www.icepartnersearch.com/skaters',
      'https://www.icepartnersearch.com/listings',
      'https://www.icepartnersearch.com',
    ];

    // Words that indicate UI/nav elements rather than real names
    const UI_WORDS = new Set([
      'sign', 'search', 'add', 'get', 'new', 'log', 'login', 'register',
      'home', 'about', 'contact', 'help', 'menu', 'profile', 'settings',
      'alerts', 'skater', 'biography', 'qualities', 'name', 'filter',
    ]);

    function looksLikeName(text) {
      if (!text || text.length < 4 || text.length > 50) return false;
      const words = text.trim().split(/\s+/);
      // Must be 2 or more words
      if (words.length < 2) return false;
      // Each word must start with a capital letter
      if (!words.every(w => /^[A-Z]/.test(w))) return false;
      // First word must not be a known UI term
      if (UI_WORDS.has(words[0].toLowerCase())) return false;
      // No numbers or special chars beyond hyphens
      if (/[^A-Za-z\-\s]/.test(text)) return false;
      return true;
    }

    const seen = new Set();

    for (const url of pagesToTry) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));

        const extracted = await page.evaluate(() => {
          const texts = [];
          // Try skater-specific selectors first
          const specific = document.querySelectorAll(
            '[class*="skater"] [class*="name"], [class*="athlete"] [class*="name"], ' +
            '[class*="card"] h2, [class*="card"] h3, [class*="listing"] h2, ' +
            '[class*="profile"] h2, .skater-name, .athlete-name'
          );
          specific.forEach(el => texts.push(el.textContent?.trim()));

          // General fallback
          if (texts.filter(Boolean).length < 3) {
            document.querySelectorAll('h2, h3, p strong, td, li').forEach(el => {
              const t = el.childNodes[0]?.textContent?.trim() ?? el.textContent?.trim();
              if (t) texts.push(t);
            });
          }
          return texts;
        });

        let found = 0;
        for (const text of extracted) {
          if (looksLikeName(text) && !seen.has(text)) {
            seen.add(text);
            skaters.push(text);
            found++;
          }
        }

        if (found > 5) break; // Good enough — stop trying other pages
      } catch (_) { /* try next */ }
    }

    console.log(`  IPS skaters extracted: ${skaters.length}`);
    if (skaters.length > 0) {
      console.log(`  Sample: ${skaters.slice(0, 5).join(', ')}`);
    }

  } catch (err) {
    console.warn(`  IPS scrape failed: ${err.message}`);
    console.warn('  Continuing without IPS data — classification will rely on competition_results only');
  } finally {
    await browser.close();
  }

  return skaters;
}

// Load all athletes (paginated)
async function loadAllAthletes() {
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('athletes')
      .select('id, name, search_status')
      .range(offset, offset + 999);
    if (error) { console.error('loadAthletes error:', error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// Load all competition_results (paginated)
async function loadAllResults() {
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('competition_results')
      .select('athlete_id, event_year, segment')
      .range(offset, offset + 999);
    if (error) { console.error('loadResults error:', error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// Check if segment name indicates a free skate / free dance (confirmed partnership)
function isPartnershipSegment(seg) {
  if (!seg) return false;
  const s = seg.toLowerCase();
  return s.includes('free dance') || s.includes('fd') ||
         s.includes('free skate') || s.includes('fs') ||
         s.includes('free program');
}

// STEP 2: Classify athletes
function classifyAthletes(athletes, results, ipsNames) {
  console.log('\n── Step 2: Classifying athletes ──');

  // Build per-athlete result index
  const byAthlete = new Map();
  for (const r of results) {
    if (!r.athlete_id) continue;
    if (!byAthlete.has(r.athlete_id)) byAthlete.set(r.athlete_id, []);
    byAthlete.get(r.athlete_id).push(r);
  }

  // Build IPS name lookup for fast fuzzy matching
  const ipsNorm = ipsNames.map(n => ({ raw: n, norm: normalize(n) }));

  const classification = {
    active:   [],
    paused:   [],
    inactive: [],
    skip:     [], // already 'matched'
    unchanged: [], // already correct status, no change needed
  };

  for (const athlete of athletes) {
    // Never touch 'matched' athletes
    if (athlete.search_status === 'matched') {
      classification.skip.push(athlete.id);
      continue;
    }

    const athleteResults = byAthlete.get(athlete.id) ?? [];

    // Check IPS presence (fuzzy name match >= 0.85)
    let onIPS = false;
    if (ipsNorm.length > 0) {
      const aNorm = normalize(athlete.name);
      onIPS = ipsNorm.some(ips => similarity(aNorm, ips.norm) >= 0.85);
    }

    // Determine most recent result year
    const years = athleteResults.map(r => Number(r.event_year)).filter(Boolean);
    const maxYear = years.length ? Math.max(...years) : null;

    // Check for confirmed partnership (FD/FS in 2024-2025)
    const hasRecentPartnership = athleteResults.some(r => {
      const yr = Number(r.event_year);
      return (yr === 2024 || yr === 2025) && isPartnershipSegment(r.segment);
    });

    // Check for results from 2023 or later
    const hasRecentResults = years.some(y => y >= 2023);

    let newStatus;

    if (onIPS) {
      newStatus = 'active';
    } else if (hasRecentResults && !hasRecentPartnership) {
      newStatus = 'active';
    } else if (maxYear !== null && maxYear <= 2022) {
      newStatus = 'paused';
    } else if (athleteResults.length === 0) {
      newStatus = 'inactive';
    } else {
      // Has results 2023+ with confirmed partnership — leave as-is or mark paused
      newStatus = athlete.search_status ?? 'paused';
    }

    if (newStatus === athlete.search_status) {
      classification.unchanged.push(athlete.id);
    } else {
      classification[newStatus]?.push(athlete.id) ?? classification.inactive.push(athlete.id);
    }
  }

  return classification;
}

// STEP 4: Batch update
async function batchUpdate(ids, status) {
  const BATCH = 50;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb
      .from('athletes')
      .update({ search_status: status })
      .in('id', batch);
    if (error) {
      console.error(`  Update error (${status}):`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function main() {
  console.log('=== filter_active_searchers.js ===');

  // Step 1
  const ipsNames = await scrapeIPS();

  // Step 2
  console.log('\n── Loading DB data ──');
  const [athletes, results] = await Promise.all([loadAllAthletes(), loadAllResults()]);
  console.log(`  Athletes loaded: ${athletes.length}`);
  console.log(`  Results loaded:  ${results.length}`);

  const classification = classifyAthletes(athletes, results, ipsNames);

  // Step 3 — Summary
  console.log('\n── Step 3: Summary (no changes made yet) ──');
  console.log(`  Would set active:   ${classification.active.length}`);
  console.log(`  Would set paused:   ${classification.paused.length}`);
  console.log(`  Would set inactive: ${classification.inactive.length}`);
  console.log(`  Already correct:    ${classification.unchanged.length}`);
  console.log(`  Skipped (matched):  ${classification.skip.length}`);
  console.log(`  Total athletes:     ${athletes.length}`);

  const answer = await ask('\nUpdate DB? (y/n): ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted — no changes made.');
    process.exit(0);
  }

  // Step 4 — Run updates
  console.log('\n── Step 4: Updating athletes ──');
  const [ua, up, ui] = await Promise.all([
    batchUpdate(classification.active,   'active'),
    batchUpdate(classification.paused,   'paused'),
    batchUpdate(classification.inactive, 'inactive'),
  ]);

  console.log(`  Updated active:   ${ua}`);
  console.log(`  Updated paused:   ${up}`);
  console.log(`  Updated inactive: ${ui}`);
  console.log(`  Total updated:    ${ua + up + ui}`);
  console.log('\nDone.');

  return { active: ua, paused: up, inactive: ui };
}

main().catch(console.error);
