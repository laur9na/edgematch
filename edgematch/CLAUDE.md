# CLAUDE.md — EdgeMatch
> Read this every session before touching anything.

---

## What this is

Two products, one codebase:

**edgematch.co** — public landing page. Converts skating Instagram visitors into waitlist signups. Laurena personally does the matching. No login required. One job: email capture.

**app.edgematch.co** — the internal matching tool. Laurena uses this to browse athletes, view competition results, and find compatible partners. Eventually becomes the self-serve product.

Never mix their concerns. Landing page code lives in `src/pages/Landing.jsx` and `src/pages/Signup.jsx`. App code lives in `src/features/`.

---

## Stack
React + Vite · Supabase · TailwindCSS · Resend · React Query

---

## Rules
- Enums display as human-readable labels — import from `src/lib/labels.js`
- Last names shown as initial only on cards and browse views
- `npm run build` passes after every change — fix before moving on
- Commit after every step, push immediately: `git push origin main`
- Log every commit: `[AGENT-N] [DONE] description` in AGENT_STATUS.md
- Rewrite any sentence containing an em dash

---

## Design system

**Landing page:** luxury editorial. Great Vibes logo, Nunito body, midnight navy + champagne gold + white. Reference `src/pages/Landing.jsx`.

**App:** same tokens, denser layout. Cards, tables, filters. Reference browse and club pages.

### Colors
```
--navy:         #0d1b2e    page background
--navy-mid:     #142236    card background
--navy-light:   #1c3050    inputs, elevated surfaces
--gold:         #c9a96e    primary accent
--gold-light:   #e2c97e    hover
--gold-pale:    #f0e4c4    muted gold text
--white:        #fdfcf8    primary text
--white-dim:    rgba(253,252,248,0.65)   secondary text
--border:       rgba(201,169,110,0.12)   default
--border-hover: rgba(201,169,110,0.35)   hover
--red:          #dc2626    errors
--green:        #16a34a    success
```

### Fonts
Logo only: Great Vibes · Everything else: Nunito · Both in index.html

### Components
```
Card:           bg --navy-mid   border 1px --border   border-radius 4px   padding 28px
Card hover:     translateY(-4px)   border-color --border-hover   transition 250ms
Input:          bg --navy-light   border 1px --border   border-radius 2px   padding 10px 14px
Button primary: bg --gold   color --navy   border-radius 2px   padding 12px 32px   weight 700   uppercase
Button ghost:   bg transparent   border 1px --border   color --gold   same padding
Nav:            bg #1a3a6b   height 52px
```

### Animations
Cards lift on hover. Score bars animate in on scroll. Sections fade up on scroll. Restraint over flash.

---

## Display labels — src/lib/labels.js
```js
DISCIPLINE: { pairs: 'Pairs', ice_dance: 'Ice dance' }
LEVEL:      { pre_juvenile: 'Pre-Juvenile', juvenile: 'Juvenile',
              intermediate: 'Intermediate', novice: 'Novice',
              junior: 'Junior', senior: 'Senior', adult: 'Adult' }
ROLE:       { lady: 'Skates as lady', man: 'Skates as man', either: 'Either role' }
STATUS:     { active: 'Actively searching', matched: 'Matched',
              paused: 'Paused', inactive: 'Inactive' }
```

---

## Visual verification — before every UI commit
```
1. npm run dev (port 5173)
2. Puppeteer MCP: screenshot route at 1280px
3. Puppeteer MCP: screenshot at 375px — mobile is 83% of traffic
4. Fix anything broken, screenshot again
5. npm run build
6. Commit and push
```

---

## Agent coordination
Read AGENT_STATUS.md before starting. Touch only files named in your task.
Mark [BLOCKED] if stuck. Mark [READY FOR AGENT-X] when a dependency is done.