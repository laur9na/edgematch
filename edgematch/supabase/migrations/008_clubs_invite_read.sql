-- 008_clubs_invite_read.sql
-- The invite-code gate in ClubAccessGate.jsx needs to look up a club
-- by invite_code before the user is a member, so they can't rely on the
-- club_members_read_own_club policy. Allow any authenticated user to read
-- clubs rows : the invite_code itself acts as the secret.
DROP POLICY IF EXISTS "clubs_authenticated_read" ON clubs;
CREATE POLICY "clubs_authenticated_read"
  ON clubs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Drop the old member-only policy (superseded by above)
DROP POLICY IF EXISTS "club_members_read_own_club" ON clubs;
