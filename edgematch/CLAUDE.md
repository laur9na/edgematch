# CLAUDE.md — EdgeMatch
> Read this every session before touching anything.

## What this is
B2B partner-matching platform for competitive pairs and ice dance skaters.
Clubs are the top-level entity. Athletes live inside clubs.
Disciplines: pairs and ice dance only.

## Stack
React + Vite · Supabase · TailwindCSS · Resend

---

## Rules
- Enums display as human-readable labels (see `src/lib/labels.js`)
- Last names shown as initial only on cards and browse views
- `npm run build` passes after every change — fix it before moving on
- Commit after every step, push immediately: `git push origin main`
- Log every commit to AGENT_STATUS.md: `[AGENT-N] [DONE] description`
- Rewrite any sentence containing an em dash

---

## Design system

The look: luxury editorial. Midnight navy, champagne gold, crisp white.
Reference the landing page (`src/pages/Landing.jsx`) for tone and execution.

### Colors
```
--navy:         #0d1b2e    page background
--navy-mid:     #142236    card background
--navy-light:   #1c3050    elevated surfaces, inputs
--gold:         #c9a96e    primary accent
--gold-light:   #e2c97e    gold hover
--gold-pale:    #f0e4c4    muted gold text
--white:        #fdfcf8    primary text
--white-dim:    rgba(253,252,248,0.65)   secondary text
--border:       rgba(201,169,110,0.12)   default border
--border-hover: rgba(201,169,110,0.35)   hover border
--red:          #dc2626    error states
--green:        #16a34a    success states
```

### Fonts
- Logo: Great Vibes (cursive) — loaded in index.html
- Everything else: Nunito — loaded in index.html

### Type scale
```
Page title:     1.8rem  weight 300
Section header: 1.1rem  weight 600
Card label:     0.65rem weight 600  letter-spacing 0.14em  uppercase  color --gold
Card value:     0.85rem weight 500
Body:           0.85rem weight 300  line-height 1.7
```

### Component patterns
```
Card:           bg --navy-mid   border 1px --border   border-radius 4px   padding 28px
Card hover:     translateY(-4px)   border-color --border-hover   transition 250ms
Input:          bg --navy-light   border 1px --border   border-radius 2px   padding 10px 14px
Button primary: bg --gold   color --navy   border-radius 2px   padding 12px 32px   weight 700   letter-spacing 0.12em   uppercase
Button ghost:   bg transparent   border 1px --border   color --gold   same padding
Nav:            bg #1a3a6b   height 52px
```

### Animations
- Card hover: `translateY(-4px)` over 250ms
- Score bars: `scaleX(0 → fill)` triggered on scroll entry
- Content sections: `opacity 0 → 1`, `translateY(24px → 0)` on scroll entry
Restraint over flash. Every animation serves the layout.

---

## Display labels
```js
// src/lib/labels.js
DISCIPLINE: { pairs: 'Pairs', ice_dance: 'Ice dance' }
LEVEL:      { pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile', intermediate: 'Intermediate',
              novice: 'Novice', junior: 'Junior', senior: 'Senior', adult: 'Adult' }
ROLE:       { lady: 'Skates as lady', man: 'Skates as man', either: 'Either role' }
STATUS:     { active: 'Actively searching', matched: 'Matched', paused: 'Paused', inactive: 'Inactive' }
```

---

## Visual verification — before every UI commit

```
1. npm run dev (port 5173)
2. Puppeteer MCP: screenshot localhost:5173/[route]
3. Verify layout, colors, overflow, empty states
4. Fix issues
5. Puppeteer MCP: screenshot again to confirm
6. npm run build
7. Commit and push
```
If Puppeteer MCP is unavailable, note `[UNVERIFIED]` in AGENT_STATUS.md.

---

## Working with other agents
- Read AGENT_STATUS.md before starting
- Touch only files named in your current task
- Edit only what the task requires — leave working code alone
- Mark yourself `[BLOCKED: reason]` in AGENT_STATUS.md if you need the other agent
- Mark `[READY FOR AGENT-X: what's ready]` when you finish something they depend on