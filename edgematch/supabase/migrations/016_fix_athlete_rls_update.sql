-- 016_fix_athlete_rls_update.sql
-- Ensure authenticated users can always read and update their own athlete row,
-- regardless of search_status. Idempotent.

-- Ensure the read-own policy exists (was in 015, but may not have been applied)
DROP POLICY IF EXISTS "athletes_read_own" ON athletes;
CREATE POLICY "athletes_read_own"
  ON athletes FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure the update-own policy exists (was in 004, idempotent re-apply)
DROP POLICY IF EXISTS "athletes_update_own" ON athletes;
CREATE POLICY "athletes_update_own"
  ON athletes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
