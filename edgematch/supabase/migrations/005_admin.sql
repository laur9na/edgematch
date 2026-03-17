-- Phase 4: Admin / Club dashboard support
-- Run after 004_rls_policies.sql

-- Add admin flag and invite code support
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Add invite_code to clubs so coaches can self-onboard
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- RLS: club admins can update athletes in their club (e.g., set verified = true)
-- Postgres OR's multiple permissive policies, so this is additive with the existing "update own" policy.
DROP POLICY IF EXISTS "club_admins_endorse" ON athletes;
CREATE POLICY "club_admins_endorse" ON athletes
  FOR UPDATE
  USING (
    -- requester must be an admin with the same club_id
    EXISTS (
      SELECT 1 FROM athletes me
      WHERE me.user_id = auth.uid()
        AND me.is_admin = true
        AND me.club_id IS NOT NULL
        AND me.club_id = athletes.club_id
    )
  );

-- Club admins can read the clubs row for their club
DROP POLICY IF EXISTS "club_members_read_own_club" ON clubs;
CREATE POLICY "club_members_read_own_club" ON clubs
  FOR SELECT
  USING (
    id IN (
      SELECT club_id FROM athletes
      WHERE user_id = auth.uid()
        AND club_id IS NOT NULL
    )
  );

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
