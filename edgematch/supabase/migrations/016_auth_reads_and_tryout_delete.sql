-- 016_auth_reads_and_tryout_delete.sql
-- 1. Allow authenticated users to read all athlete profiles.
--    The existing athletes_public_read policy only returns search_status='active' rows,
--    which causes partner athlete joins in useMatches to return null for non-active athletes,
--    filtering out all matches. Authenticated users (logged-in skaters) need to read
--    any athlete to see their match partner's data.
-- 2. Allow requester to delete their own sent tryout requests.

DROP POLICY IF EXISTS "athletes_auth_read_all" ON athletes;
CREATE POLICY "athletes_auth_read_all"
  ON athletes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow the requester to delete their own tryout request
DROP POLICY IF EXISTS "tryouts_requester_delete" ON tryouts;
CREATE POLICY "tryouts_requester_delete"
  ON tryouts FOR DELETE
  USING (
    requester_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );
