-- 012_athletes_extend.sql : Phase 2.2
-- Adds normalized_name, is_claimed, first_name, last_name to athletes.
-- Adds federation to clubs.
-- Adds normalized_name to competition_results.
-- Creates pipeline_runs table for scraping step logs.

ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS is_claimed      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_name      text,
  ADD COLUMN IF NOT EXISTS last_name       text;

CREATE INDEX IF NOT EXISTS idx_athletes_normalized ON athletes(normalized_name);

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS federation text;

ALTER TABLE competition_results
  ADD COLUMN IF NOT EXISTS normalized_name text;

CREATE INDEX IF NOT EXISTS idx_results_normalized ON competition_results(normalized_name);

-- ---------------------------------------------------------------------------
-- pipeline_runs : one row per step per run
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  step          text        NOT NULL,   -- '01_scrape_usfs', '02_scrape_isu', etc.
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  rows_affected int,
  status        text        DEFAULT 'running',  -- 'running' | 'ok' | 'error'
  error         text
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_step ON pipeline_runs(step, started_at DESC);
