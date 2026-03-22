-- 014_athlete_fields.sql
-- Adds jump_direction, willing_to_relocate, partner_qualities to athletes table.
-- Paste in Supabase SQL editor to apply.

ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS jump_direction text,
  ADD COLUMN IF NOT EXISTS willing_to_relocate text,
  ADD COLUMN IF NOT EXISTS partner_qualities text;
