# PLAN.md — EdgeMatch
> Read every session. Source of truth for what we're building and what's next.

---

## Two products

### Product 1 — edgematch.co (landing page)
Goal: convert Instagram visitors into waitlist signups.
Laurena personally emails matches back within 48h.
Success metric: waitlist signups per week.

### Product 2 — app.edgematch.co (matching tool)
Goal: Laurena uses this internally to find compatible partners for signups.
Eventually becomes the self-serve product skaters pay for.
Success metric: how fast Laurena can find a good match for a signup.

---

## Current priorities in order

1. Landing page converts on mobile (Instagram traffic is mobile)
2. Waitlist signup captures name + email + basics, Laurena gets notified
3. App shows competition results on athlete profiles (Laurena needs this to do matching)
4. App shows club card on athlete profiles (context for reaching out)
5. Athlete data is accurate — linked to clubs and results

---

## Routes

### Public (no auth)
```
/          Landing page
/signup    Waitlist intake form
/login     Login
```

### App (requires auth)
```
/browse         Club browser with filters
/matches        Athlete match feed
/clubs/:id      Club page with athlete roster
/athletes/:id   Full athlete profile with results and club
/tryouts        Tryout requests
/profile        Own profile
/admin          Laurena only
```

---

## Landing page spec

### What makes it convert
- 75% of visitors decide in 3 seconds — hero is everything
- Forms with 5 or fewer fields convert 120% better
- Named social proof beats generic quotes
- Mobile-first — 83% of traffic is mobile
- First-person CTAs convert better ("Get me matched")
- Showing the product (screenshot/demo) builds more trust than describing it

### Hero section
Headline (large, Great Vibes or Nunito bold):
"Find your skating partner."

Subheadline (small, white-dim):
"I'm a 3x National finalist who built a data-driven way to find compatible pairs and ice dance partners. Tell me what you're looking for — I'll find your matches personally."

CTA button (gold, full width on mobile):
"Get me matched"

This is the entire above-the-fold. Nothing else.

### Why us section (3 columns)
Differentiates from IcePartnerSearch explicitly:

Column 1 — "Not just a listing board"
IcePartnerSearch shows you a list. EdgeMatch scores compatibility by level, height ratio, role, jump direction, and location — then I personally review your matches before sending them.

Column 2 — "Competition data built in"
Your matches come with their actual competition history — events, placements, levels. No guessing whether someone is actually at your level.

Column 3 — "Club context included"
Every match shows their training club, coach, and contact info. You know exactly who to reach out to and how.

### Social proof section
One real quote, named and attributed:
"I found my partner in 2 weeks. I'd been searching for 8 months."
— Emma R., Junior ice dance, Detroit SC

One number:
"713 competitive skaters in the database. Growing daily."

### Demo section
Screenshot of the actual app — athlete profile showing competition results and club card.
Caption: "This is what your matches look like."
This is the single biggest trust builder. Show the product.

### Second CTA
"Ready to find your partner?"
Same gold button: "Get me matched" → /signup

### Signup form (/signup)
Five fields maximum:
1. First name
2. Email
3. Discipline (Ice dance / Pairs — pill select)
4. Level (pill select)
5. Role (pill select)

Submit: "Submit my matching request"

On submit:
- Insert to waitlist table
- Fire-and-forget email to user: "Hi [name], I got your info and I'll be in touch soon. — Laurena"
- Fire-and-forget email to laurenaletter@gmail.com with all fields
- Show confirmation: "You're on the list. I'll be in touch soon. — Laurena"

---

## App spec

### Athlete profile — two broken things to fix

**Competition results**
Query by athlete_id first, fall back to name ilike match:
```js
supabase.from('competition_results')
  .select('event_name, event_year, skating_level, segment, place, score')
  .or(`athlete_id.eq.${athlete.id},skater_name.ilike.%${athlete.name}%`)
  .order('event_year', { ascending: false })
  .limit(10)
```
Display as table: Event | Year | Level | Segment | Place
Place formatted as: 1st, 2nd, 3rd etc.
Empty state: "No competition results on record."

**Club card**
Athlete query must join clubs:
```js
supabase.from('athletes')
  .select('*, clubs(*)')
  .eq('id', id)
  .single()
```
Show below header: club name, city, country, website link, email link, phone.
If no club_id: show nothing.

### Data accuracy

**Priority: USA first, then international.**

USFS IJS results are the most reliable source. Every skater who has competed at a USFS event has a name and level in the results. These are the athletes most likely to use the platform.

For each US athlete:
1. competition_results linked via athlete_id (run link_all_results.js)
2. club_id linked via fuzzy club_name match (run link_athletes_and_results.js)
3. Club has real contact info (run enrich_clubs_contact.js)

For international athletes:
- Linked to national federation record as fallback club
- Results linked where ISU data exists
- Lower priority than US accuracy

**Run order for data fixes:**
```
node scripts/link_all_results.js
node scripts/link_athletes_and_results.js
node scripts/seed_world_clubs.js
node scripts/enrich_clubs_contact.js
node scripts/verify_club_websites.js
```

---

## Database

### waitlist (new — for landing page signups)
```sql
id, first_name, last_name, email,
discipline, skating_level, partner_role,
location, created_at
```

### athletes (existing)
Key fields for the app to work:
- athlete_id on competition_results rows
- club_id FK populated
- search_status = 'active' for skaters actually searching

### clubs (existing)
Key fields for contact flow:
- website, contact_email, phone populated
- federation set for international clubs

---

## Architecture

### Data fetching
All Supabase queries in React Query hooks in `src/hooks/` or `src/features/*/hooks/`.
No direct supabase calls inside components.

### Auth
AuthContext.jsx is the single source of truth.
ProtectedRoute, PublicRoute, OnboardingRoute handle all redirects.
No other component makes routing decisions based on auth state.

### Error handling
Every app route wrapped in ErrorBoundary.
Every hook returns { data, isLoading, error }.
Empty states always shown — never a blank screen.

---

## What's done
- AuthContext centralized, race condition fixed
- React Query installed, four data hooks migrated
- Error boundaries on all app routes
- Lazy loading on all pages
- Waitlist signup form with Resend emails
- Club and athlete data pipeline scripts
- 278 clubs, 713 athletes, 1232 results in DB
- Landing page luxury design

## What's still broken
- Competition results not showing on athlete profiles (query mismatch)
- Club card not showing on athlete profiles (join missing)
- Duplicate level pills in filter sidebar
- Some club websites inaccurate (verify script partially run)
- International athletes (543) not linked to clubs
- IPS login pending approval — cross-reference blocked