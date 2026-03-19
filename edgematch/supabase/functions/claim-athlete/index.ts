/**
 * supabase/functions/claim-athlete/index.ts
 *
 * Athlete profile claiming for onboarding step 5.
 *
 * POST /functions/v1/claim-athlete
 * Body: { action: 'search', userId: string, name: string, coachName?: string }
 *       { action: 'confirm', userId: string, athleteId: string }
 *       { action: 'create',  userId: string, profile: AthleteInsert }
 *
 * 'search':  Returns up to 5 unclaimed athletes whose normalized_name fuzzy-matches the name.
 *            name + coach must both match for confidence = 'high'.
 * 'confirm': Sets is_claimed = true, user_id = userId on the given athlete.
 * 'create':  Inserts a new athlete row from onboarding data (user declined all matches).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Levenshtein distance and normalized name helpers
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(na, nb) / maxLen;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleSearch(userId: string, name: string, coachName?: string) {
  const normalized = normalizeName(name);
  // Load unclaimed athletes; filter by similarity in JS (PostgREST has no fuzzy match)
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select('id, name, normalized_name, coach_name, discipline, skating_level, club_name, source')
    .eq('is_claimed', false)
    .is('user_id', null)
    .order('name');

  if (error) throw new Error(`DB error: ${error.message}`);

  const THRESHOLD = 0.75;
  const matches = (athletes ?? [])
    .map(a => {
      const nameSim = similarity(name, a.name);
      const coachSim = (coachName && a.coach_name)
        ? similarity(coachName, a.coach_name)
        : 0.5;
      const confidence = nameSim >= 0.9 && coachSim >= 0.8 ? 'high'
        : nameSim >= THRESHOLD ? 'medium' : null;
      return { ...a, nameSim, coachSim, confidence };
    })
    .filter(a => a.confidence !== null)
    .sort((a, b) => b.nameSim - a.nameSim)
    .slice(0, 5)
    .map(({ nameSim: _, coachSim: __, ...rest }) => rest);

  return { matches };
}

async function handleConfirm(userId: string, athleteId: string) {
  // Verify the athlete is still unclaimed
  const { data: athlete, error: fetchErr } = await supabase
    .from('athletes')
    .select('id, is_claimed, user_id')
    .eq('id', athleteId)
    .single();

  if (fetchErr) throw new Error(`Athlete not found: ${fetchErr.message}`);
  if (athlete.is_claimed || athlete.user_id) {
    return { error: 'This profile has already been claimed.' };
  }

  const { error } = await supabase
    .from('athletes')
    .update({ is_claimed: true, user_id: userId, search_status: 'active' })
    .eq('id', athleteId);

  if (error) throw new Error(`Claim failed: ${error.message}`);
  return { claimed: true, athleteId };
}

async function handleCreate(userId: string, profile: Record<string, unknown>) {
  const normalized = normalizeName(profile.name as string);

  const { data, error } = await supabase
    .from('athletes')
    .insert({
      ...profile,
      user_id: userId,
      normalized_name: normalized,
      is_claimed: true,
      source: profile.source ?? 'self',
      search_status: 'active',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Insert failed: ${error.message}`);

  // Score the new athlete vs all existing active athletes
  await supabase.rpc('score_new_athlete', { new_athlete_id: data.id });

  return { created: true, athleteId: data.id };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify the request is from an authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { action, userId, name, coachName, athleteId, profile } = body as {
    action: string;
    userId: string;
    name?: string;
    coachName?: string;
    athleteId?: string;
    profile?: Record<string, unknown>;
  };

  if (!userId) return new Response('userId required', { status: 400 });

  try {
    let result: unknown;
    if (action === 'search') {
      if (!name) return new Response('name required for search', { status: 400 });
      result = await handleSearch(userId, name, coachName);
    } else if (action === 'confirm') {
      if (!athleteId) return new Response('athleteId required for confirm', { status: 400 });
      result = await handleConfirm(userId, athleteId);
    } else if (action === 'create') {
      if (!profile) return new Response('profile required for create', { status: 400 });
      result = await handleCreate(userId, profile);
    } else {
      return new Response(`Unknown action: ${action}`, { status: 400 });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('claim-athlete error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
