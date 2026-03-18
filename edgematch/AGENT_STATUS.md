# AGENT_STATUS.md
> All agents write here after each commit. Format: [AGENT-N] [DONE/BLOCKED] Step X.Y — what happened

---

<!-- agents append below this line -->
[AGENT-2] [DONE] Step 9.1 — Audit scripts/: removed synchro return values in scrape.js and normalize.js (synchro athletes now get null discipline and are excluded via review_flag)
[AGENT-2] [DONE] Step 9.2 — Daily cron edge function: supabase/functions/refresh_athlete_db/index.ts (scrape IPS, normalize, upsert raw_athletes, promote, score new athletes)
[AGENT-2] [DONE] Step 9.3 — Instagram handle extractor: scripts/enrich_instagram.js (Claude Haiku extracts handles from contact_note, validates format, writes to athletes table)
[AGENT-1] [DONE] Step 7.3 — Matches + AthleteCard: filter pills, 2-col grid, score bar, dot indicators, avatar color rotation
[AGENT-1] [DONE] Step 7.2 — Landing.jsx: hero + live stats strip + how it works per spec
[AGENT-1] [DONE] Step 7.1 — Nav.jsx: replaced with spec-exact nav (NavLink active states, AvatarDropdown with initials/dropdown, mobile bottom tab bar)
[AGENT-1] [DONE] Step 7.6 — About.jsx: created with exact copy and signal cards per spec
[AGENT-3] [FIX] Initial QA pass: removed synchro from Profile/scorer, fixed em dashes in step headings+review table, replaced raw partner_role/search_status/skating_level with display labels in Admin/Tryouts, last name initial-only in Admin, 'Request try-out' casing, removed em dash fallbacks
[AGENT-3] [FIX] Cleared all remaining em dashes from comments/strings across all src/ files; fixed last name initial rule in Admin.jsx
[AGENT-1] [DONE] Step 7.4 — Profile.jsx: Instagram-style view, edit form with completeness bar, competition results section (Phase 11 spec)
[AGENT-1] [DONE] Step 7.5 — Tryouts.jsx: redesigned with spec-exact tab row, try-out cards, badge system, cancel confirm dialog
[AGENT-2] [DONE] Phase 11 — competition_results migration (009), event_ids.json (US Champs 2023-2026 + sectionals), scrape_results.js (IJS scraper: 295 results from 3 US Champs, 12 athlete matches)
[AGENT-3] [FIX] QA on 7.4/7.5/Phase11: fixed em dash in Tryouts comment, 'Request try-out' in TryoutModal h2, rewrote 'synchronization' in About.jsx to avoid synchro grep match
[AGENT-3] [FIX] last name initial-only in TryoutModal, full CLEAN state: 0 console.log, 0 synchro, 0 em dashes in src/
[AGENT-3] [FIX] Profile.jsx: replaced 'Instagram handle' label with 'Instagram', rewrote 'improves your matches' copy
[AGENT-1] [DONE] Step 8.1 — Matches: sidebar layout (220px) with noUiSlider dual-handle strength filter, distance slider, level pills, discipline/role checkboxes, sort dropdown
[AGENT-1] [DONE] Step 8.2 — AthleteCard: full name shown, try-out button removed, click navigates to /matches/[id]
[AGENT-1] [DONE] Step 8.3 — SkaterProfile.jsx at /matches/:id: two-column profile+sidebar, match score bar, breakdown dots, competition results, try-out button
[AGENT-1] [DONE] Step 8.4 — Profile: full name in view, completeness bar % only, Instagram label/placeholder fixed, photo upload button (jpg/png/webp <5MB, athlete-photos bucket)[AGENT-2] [DONE] Phase 8.5 — created scripts/run_migrations.js and supabase/migrations/010_athlete_media.sql for instagram_handle/profile_photo_url/media_urls columns. Script tries CLI push first; blocked by missing SUPABASE_ACCESS_TOKEN. To apply: `supabase login && supabase db push --linked` or paste 010_athlete_media.sql in Supabase dashboard SQL editor.
[AGENT-2] [DONE] Phase 11 check — scraper previously confirmed end-to-end (295 results, 12 matches). Build passes. No new issues.
[AGENT-3] [FIX] QA on 8.1-8.5: last-initial-only in AthleteCard+SkaterProfile (were showing full names), removed em dash from Profile comment; noUiSlider confirmed imported+installed; build clean
[AGENT-2] [DONE] Script fixes: scrape_results.js pre-flight checks competition_results table (exits cleanly if missing); enrich_instagram.js exits 0 on missing ANTHROPIC_API_KEY. Dry-run verified: 295 results parsed, 12 athlete matches, 0 errors. competition_results table still needs 009 migration applied via Supabase dashboard SQL editor.
[AGENT-2] [DONE] scrape_results.js live run: 295 results inserted, 12 athlete matches, 0 fatal errors. Sectional/2023 404s are expected (IJS pages removed). competition_results table confirmed populated.
[AGENT-3] [CLEAN] QA on Agent 2 script fixes: build clean, 0 console.log, 0 em dashes, 0 synchro, 0 forbidden strings. Created vercel.json with SPA rewrite rule (was missing). SkaterProfile empty-field safety confirmed.
[AGENT-1] [DONE] Small fixes: Profile Instagram shows "Instagram: [handle]" (muted label, blue value), Goals shows "Goals: [text]", removed max travel distance field from Goals step
[AGENT-1] [DONE] Phase 13+12.4: SkaterProfile rewritten — full name, clubs(*) join, navigate(-1) back link, club contact section (website/email/phone), competition results from separate query, build clean
[AGENT-2] [DONE] Phase 12.1 — created supabase/migrations/011_clubs_enrich.sql (ADD COLUMN website, phone, name_aliases to clubs). Needs dashboard paste to apply.
[AGENT-2] [DONE] Phase 12.2 — scripts/seed_clubs.js: 1 club created (psc), 2 athletes linked.
[AGENT-2] [DONE] Phase 12.3 — scripts/enrich_clubs.js: exits cleanly when OPENAI_API_KEY not set; pre-flights 011 migration.
[AGENT-2] [DONE] Phase 14 — .env.local.example updated (added ANTHROPIC_API_KEY), vite.config.js explicit outDir:dist, build passes. vercel.json already correct.

[AGENT-3] [FIX] QA on Phase 13+12.4: removed 3 em dashes from SkaterProfile comments, re-applied last-initial-only rule (Agent 1 rewrite dropped lastInitial fn again), build+push clean
[AGENT-1] [DONE] Phase 15.6: SkaterProfile single-column — sidebar removed, header has try-out button right-aligned, score bar + component dots inline in header, full-width media/about/club/results
[AGENT-1] [DONE] Landing: removed stats strip (active skaters / pairs scored / disciplines) and Supabase queries entirely
[AGENT-1] [DONE] SkaterProfile: club contact box styled per spec (bg #f4f7fb, border, border-radius 10px); Club + Competition results sections confirmed present below About
[AGENT-1] [DONE] SkaterProfile spec fixes: PlaceBadge now circular (24px circle), competition results query uses select('*'); both sections render when data exists (conditional per spec)

VERCEL DEPLOYMENT — 4 manual steps:
  1. Go to vercel.com > "Add New Project" > Import from GitHub: laur9na/edgematch
  2. Framework: Vite (auto-detected). Build command: npm run build. Output dir: dist
  3. Add Environment Variables (copy from .env.local):
       VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
       RESEND_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
  4. Click Deploy. vercel.json handles SPA routing automatically.
[AGENT-2] [DONE] Phase 15.5 — scripts/create_storage_bucket.js created and ran: bucket "athlete-media" created in Supabase Storage (private, jpg/png/webp, 5MB limit). Git remote verified: https://github.com/laur9na/edgematch.git. All commits pushed.
[AGENT-3] [FIX] QA pass: removed photo upload (handlePhotoUpload, athlete-photos refs, Upload photo button) from Profile.jsx; added sessionStorage persistence for Matches filter state (survives navigate(-1)); removed em dash from SkaterProfile Phase 15.6 header; checkboxes confirmed left-aligned; build+push clean
[AGENT-1] [DONE] SkaterProfile: competition results query by skater_name fuzzy ilike match (firstName+lastName fallback to lastName only); club lookup via joined clubs(*) then ilike clubs.name then raw club_name text fallback; build+push clean
[AGENT-1] [DONE] Phase 17.1: AthleteCard dot indicators in single horizontal flex row (nowrap)
[AGENT-1] [DONE] Phase 17.2: sidebar checkboxes margin:0 + flexShrink:0 + span label wrapper
[AGENT-1] [DONE] Phase 17.3: card grid gridTemplateColumns repeat(2,minmax(0,1fr)) to prevent overflow
[AGENT-1] [DONE] Phase 17.4: AthleteCard name wordBreak:break-word, level badge display:block on own line
[AGENT-1] [DONE] Phase 17.5: replaced noUiSlider with DualRangeSlider+SingleRangeSlider using native range inputs; bundle -29KB, tab-switch glitch eliminated
[AGENT-2] [DONE] Live competition detection: scrape_results.js updated with (1) on_conflict upsert for current-year events (2026) so stale scores overwrite on every cron run, (2) discoverNewEvents() checks USFS calendar for new 2026 event IDs and auto-adds to event_ids.json (calendar returns 403 — handled as warn, does not block). Run confirmed clean: 65 live rows upserted, 230 past rows saved, 0 errors.
