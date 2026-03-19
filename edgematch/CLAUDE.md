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

Before starting any task, read AGENT_STATUS.md fully.
If you see a [BLOCKED] entry from another agent, check if you can unblock it.
If you finish something another agent depends on, write [READY FOR AGENT-X] in AGENT_STATUS.md.
If you need something from another agent, write [WAITING ON AGENT-X: what you need] and pause that task.

After every commit, immediately run: git push origin main


---
## UI/UX Rules (read before touching any component)

### Component discipline
- Before creating any new component, check /src/components/ for an existing one to extend.
- Never rewrite a working component. If something needs to change, edit only the lines that need to change.
- Never touch a component file that is not named in the task.
- One component per file. No exceptions.

### Layout rules
- Page max-width: 1024px, centered, px-4 on mobile.
- All pages use the same top-level layout wrapper. Do not invent new wrappers.
- Cards: white background, 1px border (#e5e7eb), rounded-lg, p-4 or p-6 only.
- Hover state on all interactive cards: border color shifts to #1a56db, cursor-pointer.
- No floating elements, tooltips, or popovers unless explicitly in PLAN.md.

### Spacing scale (Tailwind only, no arbitrary values)
- Section gaps: gap-6 or gap-8
- Card internal padding: p-4 (compact) or p-6 (default)
- Form field spacing: space-y-4
- Button padding: px-4 py-2 (default), px-6 py-3 (primary CTA)
- Never use arbitrary Tailwind values like p-[13px]. Round to the nearest scale value.

### Color rules (no exceptions)
- Primary action / links: #1a56db
- Primary button hover: darken 10%, no other color
- Destructive actions: red-600 only
- Success states: green-600 only
- Text primary: gray-900
- Text secondary: gray-500
- Borders: gray-200 default, #1a56db on focus/hover
- Background: gray-50 for page, white for cards
- Nav background: #0f172a (dark navy)
- No other colors introduced without explicit instruction.

### Typography
- Page titles: text-2xl font-semibold text-gray-900
- Section headers: text-lg font-medium text-gray-900
- Card labels (e.g. "Discipline", "Level"): text-sm font-medium text-gray-500
- Card values: text-sm text-gray-900
- All caps labels: never. Use sentence case or Title Case only.
- No text-xs except for badges or legal copy.

### Forms
- All inputs: border border-gray-200 rounded-md px-3 py-2 text-sm w-full
- Focus ring: focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
- Labels above inputs always. No placeholder-as-label.
- Error messages: text-sm text-red-600 mt-1, always below the field.
- Submit button always at the bottom, full-width on mobile.

### Buttons
- Primary: bg-[#1a56db] text-white rounded-md font-medium — used for one action per screen max.
- Secondary: border border-gray-300 text-gray-700 bg-white rounded-md — for cancel / secondary actions.
- Destructive: border border-red-300 text-red-600 bg-white rounded-md
- Disabled state: opacity-50 cursor-not-allowed — always applied when action is unavailable.
- Never use multiple primary buttons on the same screen.

### Loading and empty states
- Loading: show a subtle spinner or skeleton, never a blank screen.
- Empty state: centered text-gray-500 message + one CTA if applicable. No big illustrations.
- Error state: red-50 bg with red-600 text, one retry action if applicable.

### Mobile
- All layouts are single-column on mobile (< 640px).
- No horizontal scroll ever. If something overflows, fix it.
- Touch targets minimum 44px height.
- Test every new screen at 375px width before committing.

### What Claude Code must NOT do to UI
- Do not add animations or transitions not already in the codebase.
- Do not add icons not already imported.
- Do not change font sizes outside the scale above.
- Do not add shadows (box-shadow) unless a card already uses one.
- Do not introduce a new layout pattern without it being in PLAN.md.
- Do not "improve" a screen that isn't part of the current task.