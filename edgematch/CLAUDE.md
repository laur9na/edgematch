# CLAUDE.md — EdgeMatch
> Claude Code reads this file automatically every session. No need to reference it in prompts.

---

## Who I am
I'm Laurena. I'm a 3x National Solo Dance competitor and a UCSC student (Cognitive Science + Economics, CS minor).
I built EdgeMatch because I lived this problem. I know the skating world personally.
Every decision in this codebase should reflect that I am a skater first, a builder second.

## What we're building
EdgeMatch matches competitive pairs and ice dance skaters with compatible partners.
It replaces Facebook posts and coaching favors with data.
Disciplines: pairs and ice dance ONLY. No synchro. No singles. Ever.

## How I think about building

**Simple over clever.**
If there are two ways to do something, pick the one a skater could understand.
Don't add abstractions, layers, or patterns that don't serve the product right now.
We are pre-launch. Every line of code that doesn't need to exist is a liability.

**Ship, then improve.**
A working feature with rough edges beats a perfect feature that doesn't exist.
Get it on screen. Fix it after.

**Skater-first language always.**
These are real athletes, many of them teenagers. The product should feel like it was made
for them, not built by an engineer who googled figure skating once.
Never use: em dashes, raw DB column names, snake_case in UI, technical jargon.
Always use: plain English, capitalized level names, full club names.

**No bloat.**
Do not add features not in PLAN.md.
Do not add copy, tooltips, or UI elements not explicitly specified.
Do not add dependencies unless absolutely necessary.
If something can be done in 10 lines, do not write 50.

**Decisions without asking.**
Make reasonable decisions independently. Note them in a comment.
Do not stop and ask me questions mid-task. I am busy. Keep moving.

---

## Hard rules (never violate)

- Pairs and ice dance only. Delete any synchro reference found anywhere.
- No em dashes in any string, comment, or UI copy. Rewrite the sentence.
- No raw DB values visible to users. All enums display as capitalized human labels.
- Last names shown as initial only across all UI surfaces (many users are minors).
- After every change: run `npm run build`. If it fails, fix it before moving on.
- Commit after every completed step with a descriptive message.
- Write status to AGENT_STATUS.md after each commit (one line: [DONE] what you did).

---

## Stack and conventions

- React + Vite. No Next.js. No SSR.
- Supabase for DB, auth, storage, and cron. No Firebase.
- Resend for email. No SendGrid.
- TailwindCSS for styling. No inline styles except where unavoidable.
- No new npm packages without a strong reason. Note it in AGENT_STATUS.md if you add one.
- All Supabase migrations go in supabase/migrations/ with sequential naming (004_, 005_, etc).
- Scripts go in scripts/. They are Node.js, not bundled with Vite.

---

## Brand

- Primary color: ice blue (#1a56db or close)
- Background: dark navy on nav, light gray on content
- No random accent colors. No gradients unless already in the design.
- Cards always have a visible border. Hover states on interactive cards.
- Font: system sans-serif. No Google Fonts imports.

---

## What good looks like

A good session ends with:
- `npm run build` passing
- A clean git log with descriptive commits
- AGENT_STATUS.md updated
- No new console.logs
- No em dashes
- No synchro
- The feature actually working at localhost:5173