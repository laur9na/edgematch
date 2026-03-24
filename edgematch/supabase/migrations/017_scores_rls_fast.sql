-- Migration 017: replace per-row RLS subquery on compatibility_scores with a
-- STABLE security-definer function so Postgres resolves the athlete ID once
-- per query instead of once per row.
--
-- Apply via Supabase dashboard > SQL editor.

-- 1. Stable helper: looks up the current user's athlete ID once per query.
CREATE OR REPLACE FUNCTION get_my_athlete_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM athletes WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Replace the slow policy with one that calls the helper.
DROP POLICY IF EXISTS "scores_read_by_participant" ON compatibility_scores;
CREATE POLICY "scores_read_by_participant"
  ON compatibility_scores FOR SELECT
  USING (
    athlete_a_id = get_my_athlete_id()
    OR athlete_b_id = get_my_athlete_id()
  );
