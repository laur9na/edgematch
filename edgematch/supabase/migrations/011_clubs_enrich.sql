-- 011_clubs_enrich.sql — Phase 12.1
-- Adds website, phone, name_aliases to clubs table for contact enrichment.

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS name_aliases text[];
