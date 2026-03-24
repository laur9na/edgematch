/**
 * scripts/pipeline/03_scrape_clubs.js
 *
 * For each club in DB with a website URL, Puppeteer navigates to the site,
 * finds roster/team/athletes/skaters pages, and extracts:
 *   - athlete names
 *   - coach names
 *   - email addresses
 *   - phone numbers
 * Upserts athletes with source='club_website', is_claimed=false.
 * Logs rows_affected to pipeline_runs.
 *
 * Requires puppeteer: npm install puppeteer
 * Usage: node scripts/pipeline/03_scrape_clubs.js [--dry-run]
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
try {
  const env = readFileSync(join(__dirname, '../../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { /* rely on environment */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN      = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Roster-related keywords for nav/page discovery
const ROSTER_KEYWORDS = ['roster', 'team', 'athletes', 'skaters', 'members', 'club-team'];

function normalizeName(name) {
  return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function extractEmails(text) {
  return [...new Set((text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [])
    .filter(e => !e.match(/\.(png|jpg|gif|css|js|ts|json)$/i))
  )];
}

function extractPhones(text) {
  return [...new Set((text.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g) ?? []))];
}

async function scrapeClub(browser, club) {
  const baseUrl = club.website.replace(/\/$/, '');
  const results = { names: [], coaches: [], emails: [], phones: [] };

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('EdgeMatch/0.1 (partner-matching research)');
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // Find roster/team links
    const links = await page.evaluate((keywords) => {
      const anchors = [...document.querySelectorAll('a[href]')];
      return anchors
        .filter(a => keywords.some(k => (a.href + a.textContent).toLowerCase().includes(k)))
        .map(a => a.href)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 5);
    }, ROSTER_KEYWORDS);

    const pagesToVisit = links.length > 0 ? links : [baseUrl];

    for (const url of pagesToVisit) {
      try {
        if (url !== baseUrl) await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        const html = await page.evaluate(() => document.body.innerHTML);

        // Extract emails from mailto links (most reliable)
        const mailtos = await page.evaluate(() =>
          [...document.querySelectorAll('a[href^="mailto:"]')]
            .map(a => a.href.replace('mailto:', '').split('?')[0].trim())
        );
        results.emails.push(...mailtos);

        // Also extract from body text
        results.emails.push(...extractEmails(text));
        results.phones.push(...extractPhones(text));

        // Look for name-like patterns in roster tables/lists
        const nameMatches = html.match(/<(?:td|li|span|p)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/(?:td|li|span|p)>/g) ?? [];
        for (const m of nameMatches) {
          const name = m.replace(/<[^>]+>/g, '').trim();
          if (name.split(' ').length >= 2) results.names.push(name);
        }

        // Coach patterns
        const coachMatches = text.match(/(?:coach|instructor|director)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/gi) ?? [];
        for (const m of coachMatches) {
          const name = m.replace(/^[^:]+:\s*/i, '').trim();
          results.coaches.push(name);
        }
      } catch (err) {
        console.warn(`    Page fetch failed: ${url} : ${err.message}`);
      }
    }
  } finally {
    if (page) await page.close().catch(() => {});
  }

  // Deduplicate
  results.emails = [...new Set(results.emails)].filter(Boolean);
  results.phones = [...new Set(results.phones)].filter(Boolean);
  results.names  = [...new Set(results.names)].filter(Boolean);
  results.coaches = [...new Set(results.coaches)].filter(Boolean);

  return results;
}

async function run() {
  // Dynamically import puppeteer : exit gracefully if not installed
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.error('Puppeteer not installed. Run: npm install puppeteer');
    console.error('Skipping club roster scraping.');
    process.exit(0);
  }

  // Load clubs with website URLs
  const { data: clubs, error: clubErr } = await supabase
    .from('clubs')
    .select('id, name, website')
    .not('website', 'is', null);

  if (clubErr) { console.error('Failed to load clubs:', clubErr.message); process.exit(1); }
  console.log(`Found ${clubs.length} clubs with website URLs.`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let totalRows = 0;
  const runId = !DRY_RUN ? await logStart() : null;

  try {
    for (const club of clubs) {
      console.log(`\nClub: ${club.name} (${club.website})`);
      let scraped;
      try {
        scraped = await scrapeClub(browser, club);
      } catch (err) {
        console.warn(`  Scrape failed: ${err.message}`);
        continue;
      }
      console.log(`  Found: ${scraped.names.length} names, ${scraped.emails.length} emails, ${scraped.phones.length} phones`);

      if (DRY_RUN) continue;

      // Update club contact info if found
      if (scraped.emails[0] || scraped.phones[0]) {
        const update = {};
        if (scraped.emails[0] && !club.contact_email) update.contact_email = scraped.emails[0];
        if (Object.keys(update).length > 0) {
          await supabase.from('clubs').update(update).eq('id', club.id);
        }
      }

      // Upsert discovered athlete names
      for (const rawName of scraped.names) {
        const name = normalizeName(rawName);
        const coachName = scraped.coaches[0] ?? null;
        const { error } = await supabase.from('athletes').upsert({
          name,
          club_id: club.id,
          club_name: club.name,
          coach_name: coachName,
          source: 'club_website',
          is_claimed: false,
          height_cm: 0,
          discipline: 'pairs',
          skating_level: 'senior',
          partner_role: 'either',
          search_status: 'active',
        }, { onConflict: 'name', ignoreDuplicates: true });
        if (!error) totalRows++;
      }
    }
  } finally {
    await browser.close();
  }

  if (!DRY_RUN && runId) await logFinish(runId, totalRows);
  console.log(`\nDone. Athletes upserted: ${totalRows}`);
}

async function logStart() {
  const { data } = await supabase.from('pipeline_runs')
    .insert({ step: '03_scrape_clubs', status: 'running' }).select('id').single();
  return data?.id ?? null;
}

async function logFinish(runId, rows) {
  await supabase.from('pipeline_runs')
    .update({ finished_at: new Date().toISOString(), rows_affected: rows, status: 'ok' })
    .eq('id', runId);
}

run().catch(err => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
