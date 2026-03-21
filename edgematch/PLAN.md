# PLAN.md — EdgeMatch
> Read this every session. Source of truth for what we're building and what's next.

---

## Product
B2B skating partner platform. Clubs are the top-level entity.
Skater browses clubs, clicks into one, sees athletes with compatibility scores, requests a tryout.
Clubs pay. Athletes use it free through their club.

## Core loop
1. Sign up and complete 5-step onboarding profile
2. System matches to an existing scraped athlete card, or creates one
3. Browse clubs filtered by role, level, distance, country
4. Click a club, see its athletes with compatibility scores
5. Request a tryout — recipient gets an email

---

## Routes
```
/               Landing page (built — src/pages/Landing.jsx)
/login          Email + password, persistent session
/signup         Create account
/onboarding     5-step profile wizard
/browse         Filters left panel, club cards right panel
/clubs/[id]     Club info card + athlete roster
/athletes/[id]  Full athlete profile + tryout button
/tryouts        Sent and received tryout requests
/profile        Own profile view and edit
/admin          Laurena only
```

---

## Database schema

### clubs
```sql
id, name, city, state, country, federation,
website, phone, contact_email,
rink_name, rink_address,
plan (free | pro), plan_started_at,
invite_code, created_at
```

### athletes
```sql
id, user_id,
first_name, last_name, normalized_name,
email, age, height_cm, weight_kg,
discipline, skating_level, partner_role,
location_city, location_state, location_country, location_lat, location_lng,
coach_name, club_id, club_name,
goals, training_hours_wk,
preferred_level_min, preferred_level_max, max_distance_km,
instagram_handle, profile_photo_url, media_urls,
search_status, is_claimed,
source, created_at, updated_at
```

### competition_results
```sql
id, athlete_id, skater_name, normalized_name,
event_name, event_year, discipline, skating_level,
segment, place, score, source_url
```

### compatibility_scores
```sql
id, athlete_a_id, athlete_b_id,
height_score, level_score, role_score, location_score, total_score,
computed_at
```

### tryouts
```sql
id, requester_id, recipient_id, score_id,
proposed_date, proposed_time, location_note,
status (requested | confirmed | completed | cancelled),
outcome (great_fit | possible | not_a_fit),
requested_at, confirmed_at, completed_at
```

---

## Scraping pipeline
Daily cron via Supabase Edge Function. Scripts in `scripts/pipeline/`.

```
01_scrape_usfs.js     USFS IJS public results — names, levels, placements, event years
02_scrape_isu.js      ISU international results
03_scrape_clubs.js    Puppeteer loads each club website, extracts roster + contact info
04_deduplicate.js     Levenshtein 0.82 threshold — merge duplicate athlete rows
05_score.js           Compatibility scores for all new athlete pairs
run_pipeline.js       Runs 01-05 in order, logs each step to pipeline_runs table
```

### Name deduplication logic
- `normalized_name` = lowercase, strip punctuation, trim whitespace
- Two rows within Levenshtein 0.18 = same person; keep the row with more competition_results, merge, delete the other
- User claiming a card: name + coach match required. On mismatch, create new card.

---

## Phase 1 — UI tasks (Agent 1)

### 1.1 Audit
List every file in `src/`. For each page: open it, run `npm run dev`, take a Puppeteer screenshot.
Delete: unused components, console.logs, any sentence with an em dash.
Log findings to AGENT_STATUS.md before making any changes.

### 1.2 Global design system
- `src/index.css`: body background `#0d1b2e`, color `#fdfcf8`, font-family Nunito
- `index.html`: Great Vibes and Nunito loaded from Google Fonts
- Nav: `#1a3a6b` background, Great Vibes logo in `--gold`, Nunito links, ghost CTA
- Puppeteer: screenshot `/` before and after

### 1.3 Browse page
Two-panel layout. Left 240px fixed, right flex.

Left panel:
- Background `--navy`, sections separated by gold labels (`--gold`, 0.65rem, uppercase)
- Sliders: 3px track `#e2e8f0`, gold fill, 14px white knob with shadow (existing component)
- Level pills: border `--border`, active state `--gold` bg `--navy` text
- Discipline and Role: checkbox left, label right, `accent-color: --gold`

Right panel:
- Club cards, 2-column grid
- Each card: `--navy-mid` bg, `--border` border, `border-radius 4px`, lifts on hover
- Card content: name (weight 600), location (weight 300 `--white-dim`), federation badge, discipline tags, pastel avatar circles, active skater count, "View club" in `--gold`
- Puppeteer: screenshot at 1280px and 375px

### 1.4 Club page
Top card: club name, rink, city, country. Contact links right-aligned (website, maps, email, phone) in `--gold`.
Roster below: filter pills (discipline, level), then athlete cards in 2-column grid.
Athlete cards: match the partner cards on `Landing.jsx` — avatar, name, level badge, score bar in gold, competition results, coach, tryout button.
Puppeteer: screenshot before and after.

### 1.5 Athlete profile
Single column, full width.
Header: avatar, name, level badge, discipline / role / city / height, coach. Tryout button right-aligned.
Score bar gold fill, component dot indicators below.
Sections below: media grid (3x3), about, club contact, competition results table.
Puppeteer: screenshot before and after.

### 1.6 Onboarding wizard
5-step progress bar: gold active node, `--border` inactive.
Each step is a card (`--navy-mid`) on `--navy` background.
Step 2: discipline pills, level pills, role pills, height + weight inputs with in/cm and lb/kg toggle.
Back / step count / Continue footer on every step.
Puppeteer: screenshot each step.

### 1.7 QA
Puppeteer: screenshot every route in order.
Fix all overflow, blank states, color mismatches, font fallbacks.
`npm run build` passes.
Commit: `UI: design system applied and verified across all pages`.

---

## Phase 2 — Backend tasks (Agent 2)

### 2.1 Audit
List every file in `scripts/`. For each: describe what it does and whether it runs cleanly.
List every migration and confirm which are applied in the live DB.
Delete broken, duplicated, or unreferenced scripts.
Log findings to AGENT_STATUS.md before making any changes.

### 2.2 Schema migrations
Write `supabase/migrations/012_athletes_extend.sql`:
```sql
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS is_claimed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS federation text;

ALTER TABLE competition_results
  ADD COLUMN IF NOT EXISTS normalized_name text;
```
Log `[READY] paste 012 in Supabase SQL editor` in AGENT_STATUS.md.

### 2.3 Auth
After login: check if `athletes` row exists for `user_id`.
- Row exists and `onboarding_complete = true`: redirect to `/browse`
- Otherwise: redirect to `/onboarding`
Protected route wrapper redirects to `/login` when session is absent.
Session persists on refresh via Supabase's built-in session handling.

### 2.4 Queries
Every Supabase query in the codebase must be correct. Fix these patterns:

```js
// Athletes always load with club
supabase.from('athletes').select('*, clubs(*)').eq('id', id).single()

// Compatibility score — handles both orderings
supabase.from('compatibility_scores').select('*')
  .or(`and(athlete_a_id.eq.${myId},athlete_b_id.eq.${id}),and(athlete_a_id.eq.${id},athlete_b_id.eq.${myId})`)
  .single()

// Competition results — match by normalized_name
supabase.from('competition_results').select('*')
  .eq('normalized_name', normalizedName)
  .order('event_year', { ascending: false })

// Browse — clubs with active athlete count
supabase.from('clubs').select('*, athletes(count)')
  .eq('athletes.search_status', 'active')
```

### 2.5 Scraping pipeline
Reorganize into `scripts/pipeline/` if not already there.
Confirm `01_scrape_usfs.js` and `02_scrape_isu.js` run cleanly end to end.

Write `03_scrape_clubs.js`:
- For each club in DB with a website URL
- Puppeteer navigates to the site, finds pages with "roster", "team", "athletes", or "skaters" in href or nav text
- Extracts: athlete names, coach names, email addresses, phone numbers
- Upserts to `athletes` table: `source = 'club_website'`, `is_claimed = false`
- Logs `rows_affected` to `pipeline_runs` table

Write `04_deduplicate.js`:
- For all athletes where `normalized_name` is null: compute and save it
- Find athlete pairs with Levenshtein distance below 0.18
- For each pair: keep the row with more `competition_results`, copy missing fields from the other, delete the duplicate

Confirm `05_score.js` scores only athletes with no existing scores.

Write `run_pipeline.js`: runs 01 through 05 in sequence, logs start/end/error per step.

### 2.6 Tryout emails
Trigger on `tryouts.status` change using a Supabase database webhook or Edge Function.
- `requested`: email the recipient — skater name, link to requester's profile, proposed date
- `confirmed`: email the requester — confirmation and proposed date
Resend is already configured. Keep templates to plain text with one CTA.

### 2.7 Athlete claiming
Supabase Edge Function at `supabase/functions/claim-athlete/index.ts`.

Logic:
1. Receive `{ userId, name, coachName }` from onboarding step 5
2. Compute `normalized_name` from `name`
3. Query `athletes` where `normalized_name` fuzzy matches and `is_claimed = false`
4. Return match (if found) to frontend for user confirmation
5. On confirm: `UPDATE athletes SET is_claimed = true, user_id = $userId`
6. On deny: `INSERT` new athlete row from onboarding data

### 2.8 Final check
`npm run build` passes.
`node scripts/pipeline/run_pipeline.js` runs without crashing.
All migrations written and noted in AGENT_STATUS.md.
Push to main.