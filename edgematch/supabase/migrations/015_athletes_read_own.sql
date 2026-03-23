-- 015_athletes_read_own.sql
-- Allow authenticated users to read their own athlete row regardless of search_status.
-- The existing athletes_public_read policy only allows reading active athletes (for browse/matching).
-- Without this policy, a logged-in athlete with status null/inactive cannot read their own row,
-- which breaks profile display, matches, tryouts, and the compatibility_scores subquery.

DROP POLICY IF EXISTS "athletes_read_own" ON athletes;
CREATE POLICY "athletes_read_own"
  ON athletes FOR SELECT
  USING (auth.uid() = user_id);
