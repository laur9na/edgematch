# EdgeMatch — Build Plan
> Claude Code reads CLAUDE.md automatically. Read this file at the start of every session.

---

## What we're building
AI-powered partner matching for competitive pairs and ice dance skaters.
Stack: React + Vite · Supabase · OpenAI · Resend · noUiSlider

## Scope rules
- Pairs and ice dance ONLY. No synchro.
- No em dashes. No raw DB values in UI. No snake_case visible to users.
- After every change: npm run build. Fix before moving on.
- Commit after every step. git push origin main. Append to AGENT_STATUS.md.

---

## [DONE] Everything completed so far
- Full data pipeline: 207 athletes, 12,331 scores, 295 competition results
- Daily cron scrape, Instagram enrichment, competition results scraper
- All pages built: Landing, Matches, Tryouts, About, Profile, SkaterProfile, Admin
- Clubs table + seed + enrichment scripts
- Vercel deployment prep (vercel.json, .env.local.example)
- Sidebar filters with noUiSlider
- QA: zero console.logs, zero em dashes, zero synchro refs

---

## Design system

### Colors
```
--navy:   #1a3a6b   nav
--blue:   #1a56db   primary
--bg:     #f4f7fb   page background
--border: #d4e0f5   cards/inputs
--text:   #0f2a5e   primary text
--muted:  #7a8aaa   secondary text
```

### Display value maps
```js
const DISCIPLINE_LABEL = { pairs:'Pairs', ice_dance:'Ice dance' }
const LEVEL_LABEL = { pre_juvenile:'Pre-Juvenile', juvenile:'Juvenile',
  intermediate:'Intermediate', novice:'Novice', junior:'Junior',
  senior:'Senior', adult:'Adult' }
const ROLE_LABEL = { lady:'Skates as lady', man:'Skates as man', either:'Either role' }
```

---

## Phase 15 — Active fixes (priority order)

### 15.1 — Matches page cleanup (Agent 1)

Remove from the matches page header:
- The skater count ("50 skaters") — delete entirely
- The sort dropdown next to the title — delete entirely
- The title should just be "Your matches" with nothing next to it

### 15.2 — Sidebar: Apple-style sliders (Agent 1)

Replace current noUiSlider implementation with a custom React slider component
that matches Apple's exact style. Do NOT use any noUiSlider CSS classes.

Apple-style slider spec:
```
Track: height 3px, border-radius 99px, background #e2e8f0
Fill:  background #1a56db, same height + border-radius
Knob:  width/height 15px, border-radius 50%, background #fff
       box-shadow: 0 0.5px 3px rgba(0,0,0,0.15), 0 1px 6px rgba(0,0,0,0.08),
                   0 0 0 0.5px rgba(0,0,0,0.06)
       NO colored ring, NO border. White only with shadow.
       cursor: pointer
```

For the dual-handle (match strength):
- Two knobs on one track
- Fill between the two knobs only
- State: [minVal, maxVal], default [40, 100]
- Label shows "[min]% to [max]%" in color #1a56db, font-size 11px

For the single-handle (distance):
- One knob, fill from 0 to knob
- State: maxKm, default 500
- Label shows "Within [N] km" in #1a56db, font-size 11px

Slider must NOT glitch when user navigates away and back. Fix by:
- Storing slider state in React useState (not noUiSlider internal state)
- Using onMouseMove + onMouseUp on document (not slider element) for drag
- Cleaning up event listeners in useEffect return

### 15.3 — Sidebar: left-align checkboxes (Agent 1)

Discipline and Role sections: checkbox on LEFT, label on right, gap 8px.
Currently they are misaligned. Fix:
```jsx
<label style={{ display:'flex', alignItems:'center', gap:8 }}>
  <input type="checkbox" checked={...} onChange={...} />
  <span>Ice dance</span>
</label>
```

### 15.4 — Remove photo upload (Agent 1)

Remove the Upload photo button and all associated storage code from Profile.jsx
and the signup form. Delete any Supabase Storage calls for photos.
Show initials avatar only. "Bucket not found" error goes away with this.

### 15.5 — Supabase Storage bucket for media (Agent 2)

Create a Supabase Storage bucket for the 3x3 media grid (separate from photos).

Using the service role key from .env.local, create via Supabase JS client:
```js
const { data, error } = await supabase.storage.createBucket('athlete-media', {
  public: false,
  fileSizeLimit: 52428800,  // 50MB per file
  allowedMimeTypes: ['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
})
```

Per-user folder structure: athlete-media/[athlete_id]/[filename]
Max 9 files per athlete. Enforce in upload handler.

File: scripts/create_storage_bucket.js — run once: node scripts/create_storage_bucket.js

### 15.6 — SkaterProfile: full data + club contact (Agent 1)

SkaterProfile.jsx at /matches/[id] must show:

Left column (full width card, no max-width):
  1. Header: avatar (initials), full name, discipline/level/role, city/height/weight, Instagram
  2. Media grid: 3x3, shows uploaded media if any
  3. About section: Goals / Training / Coach
  4. Club section (NEW):
     ```
     Heading: "Club" (muted uppercase label)
     Club name — 14px font-weight 700
     Website link — "Visit website" or show URL, color #1a56db
     Email link — mailto: link, color #1a56db
     Phone — plain text, color #4a5a7a
     Only show fields that have data. Never show empty labels.
     ```
  5. Competition results table — full width, no overflow hidden
     Columns: Event | Level | Segment | Place | Score
     Place badges: gold/silver/bronze/gray circles

NO right sidebar. Remove entirely.

The page is now single-column, full width.
"Request try-out" button sits inline next to the skater name in the header.
Match score, component dots, and key stats move INTO the header section below the name.

Header layout:
  Row 1: [Avatar] [Full name] ["Request try-out" button — right aligned]
  Row 2: discipline / level / role / city / height
  Row 3: match strength bar + percentage inline
  Row 4: Height ●●●●● Level ●●●●● Role fit ●●●●● Distance ●●●○○  (component dots)

Everything below header fills full width:
  Media grid, About, Club, Competition results — all full page width.

Data loading:
```js
// Athlete + club
supabase.from('athletes').select('*, clubs(*)').eq('id', id).single()

// Competition results
supabase.from('competition_results').select('*').eq('athlete_id', id).order('event_year', { ascending: false })

// Match score (handle both column orderings)
supabase.from('compatibility_scores').select('*')
  .or(`and(athlete_a_id.eq.${myId},athlete_b_id.eq.${id}),and(athlete_a_id.eq.${id},athlete_b_id.eq.${myId})`)
  .single()
```

### 15.7 — Club contact on own Profile page (Agent 1)

On the logged-in user's own Profile view (not edit form), add a Club section
below About, same style as SkaterProfile club section. Show website, email, phone
if the athlete has a club_id with contact info.

The point: even if a match target isn't on the platform, the user can still
reach out to that skater's club directly to find them.

---

## Phase 16 — Vercel deployment (Agent 2)

Already done: vercel.json, .env.local.example, vite.config.js correct.

Remaining:
1. Verify git remote is set to https://github.com/laur9na/edgematch
2. Ensure all latest commits are pushed: git push origin main
3. Append to AGENT_STATUS.md the 4 manual Vercel steps the user needs to do:
   a. vercel.com → Add New Project → import laur9na/edgematch
   b. Root directory: inner edgematch/ folder (with Vite logo)
   c. Add env vars from .env.local
   d. Deploy

---

## Decisions made
- Pairs and ice dance only. No synchro.
- Vite + React. Supabase. No Firebase.
- Pre-computed score matrix.
- No video analysis until after pilot.
- No payments until product-market fit.
- USFS IJS results are public HTML. No login needed.
- Fuzzy match threshold 0.75.
- Custom React slider (no noUiSlider CSS) to avoid tab-switch glitch.
- No profile photo upload — initials avatar only for now.
- Club contact info shown on SkaterProfile so users can reach non-platform skaters.

---

## Phase 17 — UI fixes from screenshot (do now)

### 17.1 — AthleteCard dot indicators: horizontal single row

Currently Height/Level/Distance dots are stacking vertically.
Fix: all three in one flex row, no wrapping.

```jsx
// Replace current sub-scores section with:
<div style={{ display:'flex', gap:12, marginTop:8, flexWrap:'nowrap' }}>
  <span style={{ fontSize:10, color:'#7a8aaa', display:'flex', alignItems:'center', gap:3 }}>
    Height {dots(heightScore)}
  </span>
  <span style={{ fontSize:10, color:'#7a8aaa', display:'flex', alignItems:'center', gap:3 }}>
    Level {dots(levelScore)}
  </span>
  <span style={{ fontSize:10, color:'#7a8aaa', display:'flex', alignItems:'center', gap:3 }}>
    Distance {dots(distanceScore)}
  </span>
</div>

// dots helper:
const dots = (score) => {
  const filled = Math.round((score ?? 0) * 5)
  return Array.from({length:5}, (_,i) => (
    <span key={i} style={{
      width:6, height:6, borderRadius:'50%',
      background: i < filled ? '#1a56db' : '#d4e0f5',
      display:'inline-block'
    }}/>
  ))
}
```

### 17.2 — Sidebar checkboxes: left-align with exact JSX

Replace ALL checkbox rows in sidebar with this pattern:

```jsx
<label style={{
  display:'flex', alignItems:'center', gap:8,
  fontSize:12, color:'#4a5a7a', cursor:'pointer',
  marginBottom:6
}}>
  <input
    type="checkbox"
    checked={disciplines.includes('ice_dance')}
    onChange={() => toggleDiscipline('ice_dance')}
    style={{ accentColor:'#1a56db', width:13, height:13, flexShrink:0, margin:0 }}
  />
  <span>Ice dance</span>
</label>
```

The key fix: `margin:0` on the input, `flexShrink:0`, no extra divs between checkbox and label.

### 17.3 — Card grid: ensure 2 columns always

The card grid must always be 2 columns regardless of content width:

```jsx
<div style={{
  display:'grid',
  gridTemplateColumns:'repeat(2, minmax(0, 1fr))',
  gap:12
}}>
```

`minmax(0, 1fr)` prevents cards from overflowing their column.

### 17.4 — AthleteCard name overflow

Long names like "Kirill Aksenov" must not wrap awkwardly. Fix:

```jsx
<div style={{
  fontSize:13, fontWeight:700, color:'#0f2a5e',
  lineHeight:1.3, wordBreak:'break-word'
}}>
  {athlete.name} <span style={{...badgeStyle}}>{LEVEL_LABEL[athlete.skating_level]}</span>
</div>
```

Put the level badge on its own line if name is long — use `display:'block'` on the badge span
and `marginTop:3`.

### 17.5 — Sidebar slider glitch fix

The noUiSlider loses state on tab navigate. Replace with native HTML range inputs
styled to look Apple-like. No library needed.

```jsx
// DualRangeSlider component
function DualRangeSlider({ min, max, value, onChange }) {
  const [lo, hi] = value
  return (
    <div style={{ position:'relative', height:20 }}>
      <div style={{
        position:'absolute', top:'50%', transform:'translateY(-50%)',
        left:0, right:0, height:3, background:'#e2e8f0', borderRadius:99
      }}>
        <div style={{
          position:'absolute', height:'100%', background:'#1a56db', borderRadius:99,
          left:`${((lo-min)/(max-min))*100}%`,
          right:`${((max-hi)/(max-min))*100}%`
        }}/>
      </div>
      <input type="range" min={min} max={max} value={lo}
        onChange={e => onChange([+e.target.value, hi])}
        style={{ position:'absolute', width:'100%', opacity:0, cursor:'pointer', height:20 }}
      />
      <input type="range" min={min} max={max} value={hi}
        onChange={e => onChange([lo, +e.target.value])}
        style={{ position:'absolute', width:'100%', opacity:0, cursor:'pointer', height:20 }}
      />
    </div>
  )
}
```

This uses two overlapping transparent native range inputs. No drag handlers needed,
no glitch on tab switch, works on mobile too. Style the visible track/fill with a div behind them.