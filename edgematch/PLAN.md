# EdgeMatch — Build Plan
> Feed this file to Claude Code at the start of every session: "Read PLAN.md and continue where we left off."

---

## What we're building
AI-powered partner matching for competitive figure skaters (pairs + ice dance, ages 13–25).
Athletes upload profiles → algorithm scores compatibility → ranked matches returned → tryout scheduled.

Stack: React + Vite · Supabase (Postgres + Auth + Storage) · OpenAI (embeddings, later vision) · Resend (email)

---

## Project structure

```
edgematch/
├── PLAN.md                   ← this file, always in root
├── .env.local                ← never commit
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Signup.jsx
│   │   ├── Profile.jsx       ← athlete builds their profile
│   │   ├── Matches.jsx       ← ranked match results
│   │   ├── Tryouts.jsx       ← schedule + manage tryouts
│   │   └── Admin.jsx         ← coach/club dashboard
│   ├── components/
│   │   ├── AthleteCard.jsx
│   │   ├── CompatibilityBar.jsx
│   │   ├── TryoutModal.jsx
│   │   └── Nav.jsx
│   ├── lib/
│   │   ├── supabase.js       ← supabase client
│   │   ├── scorer.js         ← compatibility algorithm (pure JS)
│   │   └── email.js          ← resend helpers
│   └── hooks/
│       ├── useAuth.js
│       ├── useAthletes.js
│       └── useMatches.js
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql    ← all tables
│   │   ├── 002_seed.sql      ← seeded athlete data
│   │   └── 003_functions.sql ← scoring stored procedure
│   └── seed/
│       └── athletes.csv      ← scraped + normalized data
└── scripts/
    ├── scrape.js             ← IcePartnerSearch scraper (Node)
    ├── normalize.js          ← raw → staging → athletes table
    └── score_all.js          ← batch-compute compatibility matrix
```

---

## Phase 0 — Data pipeline (do this FIRST, before any UI)

### Step 0.1 — Scrape IcePartnerSearch.com

File: `scripts/scrape.js`

```
Target URL: https://icepartnersearch.com
Method: fetch HTML → parse with cheerio
Extract per listing:
  - name (first name only if full name present)
  - discipline: "pairs" | "ice_dance" | "synchro"
  - skating_level: map their labels → our enum
  - height_cm: convert ft/in → cm
  - weight_kg: convert lbs → kg if needed
  - location_city, location_state, location_country
  - age (if listed) or age_range
  - contact_email or contact_note
  - source_url (the listing URL)
  - scraped_at: now()

Output: JSON array → write to supabase/seed/raw_icepartnersearch.json
```

Rules for the scraper:
- Respect robots.txt — check it first
- Add 1.5s delay between requests
- If a field is missing, store null (never guess)
- Log every listing that fails to parse

### Step 0.2 — Normalize into staging

File: `scripts/normalize.js`

Reads raw JSON → applies rules → inserts into `raw_athletes` table:

Height normalization:
```
5'2" → 157cm
5'2 → 157cm
62" → 157cm
157cm → 157cm
```

Skating level mapping (IPS uses various labels):
```
"pre-juvenile" → pre_juvenile
"juvenile"     → juvenile
"intermediate" → intermediate
"novice"       → novice
"junior"       → junior
"senior"       → senior
"adult"        → adult
```

Discipline mapping:
```
"pairs skating" → pairs
"ice dancing"   → ice_dance
"ice dance"     → ice_dance
"synchronized"  → synchro
"synchro"       → synchro
```

Deduplication logic:
- Match on (name_normalized + location_state + discipline)
- If duplicate found, keep most recently scraped, log the merge

### Step 0.3 — Promote staging → athletes table

After normalization, run:
```sql
INSERT INTO athletes (name, discipline, skating_level, height_cm, weight_kg,
  location_city, location_state, location_country, source, source_url, verified)
SELECT name, discipline, skating_level, height_cm, weight_kg,
  location_city, location_state, location_country, source, source_url, false
FROM raw_athletes
WHERE review_flag = false
ON CONFLICT (source_url) DO NOTHING;
```

---

## Database schema (Supabase / Postgres)

### Table: raw_athletes (staging)

```sql
CREATE TABLE raw_athletes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text,
  discipline      text,
  skating_level   text,
  height_cm       numeric(5,1),
  weight_kg       numeric(5,1),
  location_city   text,
  location_state  text,
  location_country text DEFAULT 'US',
  age             int,
  contact_note    text,
  source          text NOT NULL,           -- 'icepartnersearch' | 'facebook' | 'manual' | 'self'
  source_url      text UNIQUE,
  review_flag     boolean DEFAULT false,   -- flag anything parser wasn't confident about
  scraped_at      timestamptz DEFAULT now(),
  promoted        boolean DEFAULT false
);
```

### Table: athletes (core)

```sql
CREATE TYPE discipline_type AS ENUM ('pairs', 'ice_dance', 'synchro', 'singles');
CREATE TYPE skating_level AS ENUM (
  'pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'
);
CREATE TYPE partner_role AS ENUM ('lady', 'man', 'either');
CREATE TYPE search_status AS ENUM ('active', 'matched', 'paused', 'inactive');

CREATE TABLE athletes (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- identity
  name                text NOT NULL,
  email               text,
  age                 int,
  -- physical
  height_cm           numeric(5,1) NOT NULL,
  weight_kg           numeric(5,1),
  -- skating
  discipline          discipline_type NOT NULL,
  skating_level       skating_level NOT NULL,
  partner_role        partner_role NOT NULL DEFAULT 'either',
  -- location
  location_city       text,
  location_state      text,
  location_country    text DEFAULT 'US',
  location_lat        numeric(9,6),
  location_lng        numeric(9,6),
  -- goals & preferences
  goals               text,                -- free text: "compete at nationals by 2027"
  training_hours_wk   int,                 -- hours per week currently training
  preferred_level_min skating_level,       -- partner level range
  preferred_level_max skating_level,
  max_distance_km     int DEFAULT 500,     -- willing to relocate/travel radius
  -- status
  search_status       search_status DEFAULT 'active',
  verified            boolean DEFAULT false,
  coach_name          text,
  club_name           text,
  -- source tracking
  source              text DEFAULT 'self', -- 'icepartnersearch' | 'facebook' | 'manual' | 'self'
  source_url          text,
  -- timestamps
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  last_active_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_athletes_discipline ON athletes(discipline);
CREATE INDEX idx_athletes_level ON athletes(skating_level);
CREATE INDEX idx_athletes_status ON athletes(search_status);
CREATE INDEX idx_athletes_location ON athletes(location_state, location_country);
```

### Table: compatibility_scores (pre-computed match matrix)

```sql
CREATE TABLE compatibility_scores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_a_id    uuid REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_b_id    uuid REFERENCES athletes(id) ON DELETE CASCADE,
  -- component scores (0.0 – 1.0 each)
  height_score    numeric(4,3),            -- height ratio compatibility
  level_score     numeric(4,3),            -- skating level delta
  role_score      numeric(4,3),            -- role compatibility (lady/man/either)
  location_score  numeric(4,3),            -- distance-based score
  goals_score     numeric(4,3),            -- embedding similarity (phase 2)
  -- composite
  total_score     numeric(4,3) NOT NULL,   -- weighted sum
  score_version   int DEFAULT 1,           -- bump when algorithm changes
  computed_at     timestamptz DEFAULT now(),
  UNIQUE(athlete_a_id, athlete_b_id),
  CHECK(athlete_a_id < athlete_b_id)       -- canonical ordering prevents duplicates
);

CREATE INDEX idx_scores_a ON compatibility_scores(athlete_a_id, total_score DESC);
CREATE INDEX idx_scores_b ON compatibility_scores(athlete_b_id, total_score DESC);
```

### Table: tryouts

```sql
CREATE TYPE tryout_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE outcome_rating AS ENUM ('great_fit', 'possible', 'not_a_fit');

CREATE TABLE tryouts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id    uuid REFERENCES athletes(id),
  recipient_id    uuid REFERENCES athletes(id),
  score_id        uuid REFERENCES compatibility_scores(id),
  -- scheduling
  proposed_date   date,
  proposed_time   time,
  location_note   text,                    -- "Peninsula Skating Club, Rink 2"
  -- status
  status          tryout_status DEFAULT 'requested',
  -- outcome (filled after tryout)
  outcome         outcome_rating,
  outcome_note    text,
  partnership_formed boolean,              -- did this become an actual partnership?
  -- timestamps
  requested_at    timestamptz DEFAULT now(),
  confirmed_at    timestamptz,
  completed_at    timestamptz
);
```

### Table: clubs

```sql
CREATE TABLE clubs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  city            text,
  state           text,
  country         text DEFAULT 'US',
  contact_email   text,
  plan            text DEFAULT 'free',     -- 'free' | 'enterprise'
  plan_started_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE athletes ADD COLUMN club_id uuid REFERENCES clubs(id);
```

---

## Compatibility scoring algorithm

File: `src/lib/scorer.js`

All scores return 0.0–1.0. Final score = weighted sum.

### Weights (v1)
```js
const WEIGHTS = {
  height:   0.35,   // most important for pairs — physical requirement
  level:    0.30,   // skill alignment
  role:     0.15,   // lady/man/either compatibility
  location: 0.15,   // distance
  goals:    0.05    // free text similarity (phase 2, use 0 for now)
};
```

### Height score
```js
// Pairs: ideal man is 15–25cm taller than lady
// Ice dance: ideal man is 8–18cm taller
// Synchro: height similarity preferred (delta < 5cm ideal)
function heightScore(a, b, discipline) {
  const taller = a.height_cm > b.height_cm ? a : b;
  const shorter = a.height_cm > b.height_cm ? b : a;
  const delta = taller.height_cm - shorter.height_cm;

  if (discipline === 'pairs') {
    // ideal: 15–25cm delta. penalty outside range.
    if (delta >= 15 && delta <= 25) return 1.0;
    if (delta < 15) return Math.max(0, 1 - (15 - delta) / 15);
    if (delta > 25) return Math.max(0, 1 - (delta - 25) / 20);
  }
  if (discipline === 'ice_dance') {
    if (delta >= 8 && delta <= 18) return 1.0;
    if (delta < 8)  return Math.max(0, 1 - (8 - delta) / 10);
    if (delta > 18) return Math.max(0, 1 - (delta - 18) / 15);
  }
  if (discipline === 'synchro') {
    return Math.max(0, 1 - delta / 15);
  }
  return 0.5; // fallback
}
```

### Level score
```js
const LEVEL_ORDER = ['pre_juvenile','juvenile','intermediate','novice','junior','senior','adult'];
function levelScore(a, b) {
  const ia = LEVEL_ORDER.indexOf(a.skating_level);
  const ib = LEVEL_ORDER.indexOf(b.skating_level);
  const delta = Math.abs(ia - ib);
  // same level = 1.0, 1 apart = 0.7, 2 apart = 0.4, 3+ = 0
  return [1.0, 0.7, 0.4, 0.15, 0][Math.min(delta, 4)];
}
```

### Role score
```js
function roleScore(a, b) {
  const roles = [a.partner_role, b.partner_role].sort().join('-');
  const map = {
    'lady-man':    1.0,
    'either-man':  0.9,
    'either-lady': 0.9,
    'either-either': 0.7,
    'lady-lady':   0.0,
    'man-man':     0.0,
  };
  return map[roles] ?? 0.5;
}
```

### Location score
```js
// Haversine distance → score
// 0km = 1.0, 500km = 0.5, 2000km+ = 0.1 (but still shown — they may relocate)
function locationScore(a, b) {
  if (!a.location_lat || !b.location_lat) return 0.5; // unknown = neutral
  const dist = haversineKm(a.location_lat, a.location_lng, b.location_lat, b.location_lng);
  const willing = Math.min(a.max_distance_km ?? 500, b.max_distance_km ?? 500);
  if (dist <= willing) return Math.max(0.5, 1 - dist / (willing * 2));
  return Math.max(0.1, 0.5 - (dist - willing) / 2000);
}
```

### Composite score
```js
export function computeScore(a, b) {
  if (a.discipline !== b.discipline) return null; // never match across disciplines
  if (a.search_status !== 'active' || b.search_status !== 'active') return null;

  const scores = {
    height:   heightScore(a, b, a.discipline),
    level:    levelScore(a, b),
    role:     roleScore(a, b),
    location: locationScore(a, b),
    goals:    0.5 // placeholder until embeddings
  };

  const total = Object.entries(WEIGHTS).reduce(
    (sum, [k, w]) => sum + (scores[k] * w), 0
  );

  return { ...scores, total: Math.round(total * 1000) / 1000 };
}
```

---

## Batch scoring script

File: `scripts/score_all.js`

Run this after seeding athletes. Computes the full N×N upper triangle.

```
1. SELECT all active athletes
2. For each pair (i, j) where i < j and same discipline:
   a. computeScore(athletes[i], athletes[j])
   b. If score != null, upsert into compatibility_scores
3. Log: X pairs scored, Y skipped (different discipline), Z errors
4. Print top 10 scores as sanity check
```

Run via: `node scripts/score_all.js`
Re-run whenever: new athletes added, algorithm version bumped.

---

## API layer (Supabase Edge Functions or Next.js API routes)

Keep it simple — use Supabase RLS + direct client queries where possible.
Only create Edge Functions for:

`GET /api/matches?athlete_id=X&limit=20`
```sql
SELECT
  cs.*,
  CASE WHEN cs.athlete_a_id = $1 THEN a2.* ELSE a1.* END as partner
FROM compatibility_scores cs
JOIN athletes a1 ON a1.id = cs.athlete_a_id
JOIN athletes a2 ON a2.id = cs.athlete_b_id
WHERE ($1 IN (cs.athlete_a_id, cs.athlete_b_id))
  AND cs.total_score >= 0.3
ORDER BY cs.total_score DESC
LIMIT $2;
```

`POST /api/tryouts` — create tryout request, send email via Resend

`PATCH /api/tryouts/:id` — confirm, complete, or cancel

---

## UI — pages and what each does

### Landing.jsx
- Headline: "The right partner changes everything."
- Two CTAs: "Find a partner" (→ /signup) and "I'm a coach" (→ /admin)
- No login wall — show the concept first

### Signup.jsx / Profile.jsx
Multi-step form. Steps:
1. Basics: name, email, age, discipline, partner role
2. Physical: height (ft/in or cm toggle), weight (optional)
3. Skating: level, club, coach, training hours/week
4. Goals: free text + preferred partner level range + max travel distance
5. Location: city/state (auto-geocode with Mapbox or Google)
6. Review + submit

On submit:
- Create Supabase auth user
- Insert into athletes table
- Trigger score_all for this new athlete only (incremental, not full recompute)
- Redirect to /matches

### Matches.jsx
- Shows ranked list of compatible athletes
- Each card: name, level, location, height, compatibility score bar (color: green > 0.8, yellow > 0.6, orange > 0.4)
- "Request tryout" button → opens TryoutModal
- Filter sidebar: discipline (locked to user's), level range, distance, role

### Tryouts.jsx
- Two tabs: Sent requests / Received requests
- Each row: partner name, proposed date, status badge
- On "Confirmed": show location note and date
- On "Completed": prompt for outcome rating → updates compatibility_scores feedback field (phase 2 flywheel)

### Admin.jsx (clubs)
- Requires club plan = 'enterprise'
- Table of all athletes from their club
- Sort by level, last active, match count
- Export CSV button
- Endorse athlete button (sets athlete.verified = true)

---

## Environment variables (.env.local)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-side scripts only, never expose to browser
RESEND_API_KEY=
OPENAI_API_KEY=                # phase 2
```

---

## Build order — strict sequence

Claude Code should always work in this order. Do not skip phases.

```
Phase 0 — Data pipeline
  [done] 0.1 scrape.js — IcePartnerSearch scraper
  [done] 0.2 normalize.js — raw → staging
  [done] 0.3 001_schema.sql — all tables
  [done] 0.4 002_seed.sql — insert normalized data
  [done] 0.5 score_all.js — compute full matrix
  [done] 0.6 Verify: run SELECT COUNT(*) on all tables, print top 10 scores

Phase 1 — Auth + Profile
  [done] 1.1 Supabase auth setup (email + password, no OAuth yet)
  [done] 1.2 Multi-step signup form (Profile.jsx)
  [done] 1.3 useAuth.js hook
  [done] 1.4 RLS policies: athletes can only read/write their own row

Phase 2 — Matching UI
  [done] 2.1 /api/matches query
  [done] 2.2 Matches.jsx + AthleteCard.jsx + CompatibilityBar.jsx
  [done] 2.3 Filter sidebar (client-side filtering, no new queries)

Phase 3 — Tryouts
  [ ] 3.1 TryoutModal.jsx
  [ ] 3.2 /api/tryouts POST + email via Resend
  [ ] 3.3 Tryouts.jsx (sent + received tabs)

Phase 4 — Admin
  [ ] 4.1 Club auth (separate invite flow)
  [ ] 4.2 Admin.jsx dashboard
  [ ] 4.3 Endorse + CSV export

Phase 5 — Polish for pilot
  [ ] 5.1 Landing.jsx
  [ ] 5.2 Mobile responsive
  [ ] 5.3 Empty states + loading skeletons
  [ ] 5.4 Error handling + form validation
```

---

## What to tell Claude Code at the start of each session

```
Read PLAN.md. 
Current phase: [X.Y].
Last completed: [describe what's done].
Continue from: [next checkbox].
Do not ask me questions — make reasonable decisions and note them in comments.
Commit after each checkbox is complete.
```

---

## Decisions made (no need to re-litigate)

- Vite + React (not Next.js) — simpler for MVP, no SSR needed yet
- Supabase (not Firebase) — Postgres is essential for the scoring queries
- Pre-computed scores (not real-time) — N athletes = N²/2 pairs, pre-compute on insert is fast enough until 10k+ athletes
- No video analysis in Phase 1 — add after pilot validation
- No payments in Phase 1 — free pilot, monetize after product-market fit confirmed
- Scoring algorithm is pure JS (not SQL stored proc) for now — easier to iterate, migrate to Postgres function in Phase 2
- athlete_a_id < athlete_b_id constraint — canonical ordering prevents duplicate score rows
- score_version field — allows algorithm updates without deleting historical data