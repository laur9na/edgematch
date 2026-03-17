-- 001_schema.sql — EdgeMatch database schema
-- Run against Supabase via: supabase db push  OR  paste into SQL editor

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE discipline_type AS ENUM ('pairs', 'ice_dance', 'synchro', 'singles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skating_level AS ENUM (
    'pre_juvenile', 'juvenile', 'intermediate', 'novice', 'junior', 'senior', 'adult'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE partner_role AS ENUM ('lady', 'man', 'either');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE search_status AS ENUM ('active', 'matched', 'paused', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tryout_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outcome_rating AS ENUM ('great_fit', 'possible', 'not_a_fit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- raw_athletes (staging — receives scraper output)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_athletes (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text,
  discipline       text,
  skating_level    text,
  partner_role     text DEFAULT 'either',
  height_cm        numeric(5,1),
  weight_kg        numeric(5,1),
  location_city    text,
  location_state   text,
  location_country text DEFAULT 'US',
  age              int,
  contact_note     text,
  source           text NOT NULL,           -- 'icepartnersearch' | 'facebook' | 'manual' | 'self'
  source_url       text UNIQUE,
  review_flag      boolean DEFAULT false,
  scraped_at       timestamptz DEFAULT now(),
  promoted         boolean DEFAULT false
);

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  city            text,
  state           text,
  country         text DEFAULT 'US',
  contact_email   text,
  plan            text DEFAULT 'free',      -- 'free' | 'enterprise'
  plan_started_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- athletes (core)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athletes (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- identity
  name                 text NOT NULL,
  email                text,
  age                  int,
  -- physical
  height_cm            numeric(5,1) NOT NULL,
  weight_kg            numeric(5,1),
  -- skating
  discipline           discipline_type NOT NULL,
  skating_level        skating_level NOT NULL,
  partner_role         partner_role NOT NULL DEFAULT 'either',
  -- location
  location_city        text,
  location_state       text,
  location_country     text DEFAULT 'US',
  location_lat         numeric(9,6),
  location_lng         numeric(9,6),
  -- goals & preferences
  goals                text,
  training_hours_wk    int,
  preferred_level_min  skating_level,
  preferred_level_max  skating_level,
  max_distance_km      int DEFAULT 500,
  -- status
  search_status        search_status DEFAULT 'active',
  verified             boolean DEFAULT false,
  coach_name           text,
  club_id              uuid REFERENCES clubs(id),
  club_name            text,
  -- source tracking
  source               text DEFAULT 'self',
  source_url           text,
  -- timestamps
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  last_active_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athletes_discipline ON athletes(discipline);
CREATE INDEX IF NOT EXISTS idx_athletes_level      ON athletes(skating_level);
CREATE INDEX IF NOT EXISTS idx_athletes_status     ON athletes(search_status);
CREATE INDEX IF NOT EXISTS idx_athletes_location   ON athletes(location_state, location_country);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_athletes_updated_at ON athletes;
CREATE TRIGGER trg_athletes_updated_at
  BEFORE UPDATE ON athletes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- compatibility_scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compatibility_scores (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_a_id   uuid REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_b_id   uuid REFERENCES athletes(id) ON DELETE CASCADE,
  -- component scores (0.0 – 1.0 each)
  height_score   numeric(4,3),
  level_score    numeric(4,3),
  role_score     numeric(4,3),
  location_score numeric(4,3),
  goals_score    numeric(4,3),
  -- composite
  total_score    numeric(4,3) NOT NULL,
  score_version  int DEFAULT 1,
  computed_at    timestamptz DEFAULT now(),
  UNIQUE(athlete_a_id, athlete_b_id),
  CHECK(athlete_a_id < athlete_b_id)   -- canonical ordering prevents duplicate pairs
);

CREATE INDEX IF NOT EXISTS idx_scores_a ON compatibility_scores(athlete_a_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_b ON compatibility_scores(athlete_b_id, total_score DESC);

-- ---------------------------------------------------------------------------
-- tryouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tryouts (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id       uuid REFERENCES athletes(id),
  recipient_id       uuid REFERENCES athletes(id),
  score_id           uuid REFERENCES compatibility_scores(id),
  proposed_date      date,
  proposed_time      time,
  location_note      text,
  status             tryout_status DEFAULT 'requested',
  outcome            outcome_rating,
  outcome_note       text,
  partnership_formed boolean,
  requested_at       timestamptz DEFAULT now(),
  confirmed_at       timestamptz,
  completed_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- Row-level security (Phase 1 will add policies; enable here so it's ready)
-- ---------------------------------------------------------------------------
ALTER TABLE athletes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE compatibility_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryouts              ENABLE ROW LEVEL SECURITY;

-- Public read of athletes (all active listings are visible without login)
CREATE POLICY IF NOT EXISTS "athletes_public_read"
  ON athletes FOR SELECT
  USING (search_status = 'active');

-- Athletes can update their own row
CREATE POLICY IF NOT EXISTS "athletes_owner_write"
  ON athletes FOR ALL
  USING (auth.uid() = user_id);

-- Scores are readable by either athlete in the pair
CREATE POLICY IF NOT EXISTS "scores_read_by_participant"
  ON compatibility_scores FOR SELECT
  USING (
    athlete_a_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    OR
    athlete_b_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Tryouts: readable/writable by requester or recipient
CREATE POLICY IF NOT EXISTS "tryouts_participant_access"
  ON tryouts FOR ALL
  USING (
    requester_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    OR
    recipient_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );
