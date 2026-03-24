-- 004_rls_policies.sql : Row-Level Security for Phase 1
-- Run AFTER 001_schema.sql.
-- Idempotent: uses CREATE POLICY IF NOT EXISTS / OR REPLACE.

-- ---------------------------------------------------------------------------
-- athletes
-- ---------------------------------------------------------------------------

-- Anyone can read active athletes (for match browsing, no login required)
DROP POLICY IF EXISTS "athletes_public_read" ON athletes;
CREATE POLICY "athletes_public_read"
  ON athletes FOR SELECT
  USING (search_status = 'active');

-- Authenticated users can insert their own row (sign-up flow)
DROP POLICY IF EXISTS "athletes_insert_own" ON athletes;
CREATE POLICY "athletes_insert_own"
  ON athletes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Athletes can only update their own row
DROP POLICY IF EXISTS "athletes_update_own" ON athletes;
CREATE POLICY "athletes_update_own"
  ON athletes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Athletes can delete (deactivate) their own row
DROP POLICY IF EXISTS "athletes_delete_own" ON athletes;
CREATE POLICY "athletes_delete_own"
  ON athletes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- compatibility_scores
-- ---------------------------------------------------------------------------

-- Scores are readable by either athlete in the pair
DROP POLICY IF EXISTS "scores_read_by_participant" ON compatibility_scores;
CREATE POLICY "scores_read_by_participant"
  ON compatibility_scores FOR SELECT
  USING (
    athlete_a_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    OR
    athlete_b_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Service role can insert/update scores (batch scorer uses service key)
-- No INSERT policy needed for anon/authenticated users : only service role writes scores.

-- ---------------------------------------------------------------------------
-- tryouts
-- ---------------------------------------------------------------------------

-- Either party in a tryout can read it
DROP POLICY IF EXISTS "tryouts_participant_read" ON tryouts;
CREATE POLICY "tryouts_participant_read"
  ON tryouts FOR SELECT
  USING (
    requester_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    OR
    recipient_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Requester can create tryout requests
DROP POLICY IF EXISTS "tryouts_requester_insert" ON tryouts;
CREATE POLICY "tryouts_requester_insert"
  ON tryouts FOR INSERT
  WITH CHECK (
    requester_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Either party can update status (confirm, complete, cancel)
DROP POLICY IF EXISTS "tryouts_participant_update" ON tryouts;
CREATE POLICY "tryouts_participant_update"
  ON tryouts FOR UPDATE
  USING (
    requester_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    OR
    recipient_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Service-role bypass (used by Node scripts; no RLS applied to service key)
-- Nothing to add here : Supabase service key bypasses RLS by design.
-- ---------------------------------------------------------------------------
