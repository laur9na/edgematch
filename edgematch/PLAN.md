# EdgeMatch — Build Plan
> Claude Code reads CLAUDE.md automatically. Read this file at the start of every session.

---

## What we're building
AI-powered partner matching for competitive pairs and ice dance skaters.
Stack: React + Vite · Supabase · OpenAI · Resend · TailwindCSS

## Scope rules (always enforce)
- Pairs and ice dance ONLY. No synchro, no singles.
- No em dashes anywhere. Rewrite sentences that need one.
- No raw DB values, snake_case, or enum strings visible to users.
- After every change: npm run build. Fix before moving on.
- Commit after every step. Append status to AGENT_STATUS.md.

---

## [DONE] All completed work
- Phases 0-5: scraper, schema, scoring, auth, all core pages
- Phase 7: Nav, Landing, Matches, AthleteCard, Profile, Tryouts, About
- Phase 9.1-9.3: dead code audit, daily cron, Instagram enrichment
- Phase 11: competition_results table + migration, scrape_results.js, event_ids.json
- QA: em dashes, synchro refs, display labels, last-name initials all clean
- 207 athletes seeded, 12,331 pairs scored, 295 competition results scraped

---

## Current file structure
```
edgematch/
├── src/
│   ├── pages/     Landing, Signup, Profile, Matches, Tryouts, About, Admin
│   ├── components/ AthleteCard, CompatibilityBar, TryoutModal, Nav
│   ├── lib/        supabase.js, scorer.js, email.js
│   └── hooks/      useAuth, useAthletes, useMatches
├── supabase/
│   ├── functions/  refresh_athlete_db (daily cron)
│   └── migrations/ 001-009 applied
└── scripts/        scrape.js, normalize.js, score_all.js,
                    scrape_results.js, enrich_instagram.js, event_ids.json
```

---

## Design system (reference for all agents)

### Colors
```
--navy:       #1a3a6b   nav background, headings
--blue:       #1a56db   primary action, links, active states
--blue-light: #eef3fe   selected backgrounds
--bg:         #f4f7fb   page background
--border:     #d4e0f5   all card/input borders
--text-pri:   #0f2a5e
--text-sec:   #4a5a7a
--text-muted: #7a8aaa
green badge:  bg #e1f5ee  text #0f6e56
blue badge:   bg #e6f0ff  text #1a56db
teal badge:   bg #e1f5ee  text #085041
gray badge:   bg #f0f0f0  text #7a8aaa
```

### Display value maps (use everywhere enums appear)
```js
const DISCIPLINE_LABEL = { pairs: 'Pairs', ice_dance: 'Ice dance' }
const LEVEL_LABEL = {
  pre_juvenile:'Pre-Juvenile', juvenile:'Juvenile', intermediate:'Intermediate',
  novice:'Novice', junior:'Junior', senior:'Senior', adult:'Adult'
}
const ROLE_LABEL = { lady:'Skates as lady', man:'Skates as man', either:'Either role' }
```

---

## Phase 8 — In progress: UI changes

### 8.1 — Matches sidebar (Agent 1)

Replace current filter pills with a persistent left sidebar (220px) + main (1fr) layout.

```
Sidebar: bg #fff, border-right 1px solid #d4e0f5, padding 20px 16px
Title: "Filter matches" 13px font-weight 700

Sections separated by hr (border-top 1px solid #f0f4fb, margin 16px 0):

1. Match strength — dual-handle range slider
   Use noUiSlider (npm install nouislider).
   Track between handles: #1a56db. Outside handles: #e8eef7.
   Default: min=40, max=100.
   Label shows "40% to 100%" in blue (#1a56db) below section title.
   Handles: 14px circle, bg #1a56db, white border 2px.

2. Distance — single slider
   noUiSlider, 0-5000km, default 500.
   Filled portion of track: #1a56db. Unfilled: #e8eef7.
   Label: "Within [N] km"

3. Level — multi-select pills
   Pre-Juv | Juvenile | Novice | Junior | Senior | Adult
   Selected: bg #eef3fe, border #1a56db, color #1a56db, font-weight 600
   Unselected: bg #fff, border #d4e0f5, color #4a5a7a

4. Discipline — checkboxes: Ice dance | Pairs

5. Role — checkboxes: Skates as man | Skates as lady | Either role

NO verified-only checkbox.
```

Main area: header + sort dropdown (Match strength | Distance | Level | Recently active) + 2-col card grid.

### 8.2 — AthleteCard: full name, no try-out button (Agent 1)

- Show full name on card. No last-initial truncation on cards.
- Remove "Request try-out" button from AthleteCard entirely.
- Clicking card navigates to /matches/[athlete_id].

### 8.3 — SkaterProfile.jsx at /matches/[id] (Agent 1)

New page. Two-column layout: profile left (1fr) + sticky sidebar right (300px).

```
Back link: "← Back to matches" color #1a56db, margin-bottom 16px

Left column — profile card (bg #fff, border, border-radius 14px, overflow hidden):
  Header (padding 20px, border-bottom):
    Avatar 64px — photo if set, else initials
    Full name — 20px font-weight 800
    Discipline · Level · Role
    City, State · Height · Weight (if set)
    @instagram (linked, if set)

  Media grid: 3x3, same spec as Profile page

  About section (padding 16px, border-top):
    NO max-height. NO overflow hidden. Expands to full natural height.
    Goals, Training hrs/wk, Coach, Club

  Competition results section (padding 16px, border-top):
    NO max-height. NO overflow hidden. All rows visible.
    Table: Event | Level | Segment | Place | Score
    Place badges: 1st=#fef3c7/#92400e, 2nd=#f1f5f9/#475569,
                  3rd=#fce8dc/#9a3412, 4th+=#f0f4fb/#4a5a7a
    Score chip: bg #eef3fe, color #1a56db
    Sort by year desc. Show all rows. "View all" only if >10.

Right sidebar (bg #fff, border, border-radius 14px, padding 20px, sticky top 20px):
  Match score: 40px font-weight 800 color #1a7a3a
  "match strength" label
  Score bar: full width, 8px, green fill
  Breakdown rows: Height | Skill level | Role fit | Distance — each with 5 dots
  Divider
  Key stats: Height | Level | Avg score | Training hrs/wk
  Divider
  "Request try-out" button — full width, primary, font-weight 700
  "Back to matches" — full width, secondary
```

### 8.4 — Profile page fixes (Agent 1)

- Label "Instagram" only (not "Instagram handle")
- Input placeholder "@username"
- Remove ALL text containing "improves your matches" or "improves matches"
- Completeness bar: percentage only, e.g. "92% complete". No other text.
- Full name shown (not last initial)
- Add "Upload photo" button in edit form. Accepts jpg/png/webp <5MB.
  Store in Supabase Storage: athlete-photos/[athlete_id]
  Show photo in avatar if set, else initials.

### 8.5 — Run DB migration (Agent 2)

The instagram_handle, profile_photo_url, media_urls columns may not exist yet.
Agent 2 must apply the migration automatically — never ask user to do it.

```js
// scripts/run_migrations.js
// Read .env.local for VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// Execute this SQL using the service role key:
const sql = `
  ALTER TABLE athletes
    ADD COLUMN IF NOT EXISTS instagram_handle  text,
    ADD COLUMN IF NOT EXISTS profile_photo_url text,
    ADD COLUMN IF NOT EXISTS media_urls        text[] DEFAULT '{}';
`
// Use supabase-js with service role to run rpc or direct query
// Log: "Migration applied" or error details
// Run: node scripts/run_migrations.js
```

After migration: verify columns exist by querying information_schema.columns.

---

## Phase 10 — Launch checklist (not started)
```
[ ] All Phase 8 changes passing npm run build
[ ] Signup flow works end-to-end on mobile
[ ] 30+ athletes visible after fresh signup
[ ] Try-out request sends confirmation email
[ ] Zero raw DB values in UI
[ ] Zero em dashes in UI copy
[ ] App deployed to Vercel with clean URL
[ ] Demo account pre-created
[ ] Screen recording ready
[ ] Daily cron confirmed running in Supabase dashboard
```

---

## Decisions made
- Pairs and ice dance only. No synchro.
- Vite + React. No Next.js. Supabase. No Firebase.
- Pre-computed score matrix. Fast enough until 10k+ athletes.
- No video analysis until after pilot. No payments until product-market fit.
- USFS IJS results are public HTML. No login needed.
- Fuzzy match threshold 0.75.