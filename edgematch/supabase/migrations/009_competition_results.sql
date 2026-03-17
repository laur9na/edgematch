-- 009_competition_results.sql — Phase 11 competition results pipeline

CREATE TABLE IF NOT EXISTS competition_results (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id   uuid REFERENCES athletes(id) ON DELETE SET NULL,
  event_name   text NOT NULL,
  event_year   int  NOT NULL,
  event_id     text NOT NULL,
  segment_url  text NOT NULL,
  discipline   text NOT NULL,
  level        text NOT NULL,
  segment      text NOT NULL,
  skater_name  text NOT NULL,
  partner_name text,
  club_name    text,
  placement    int,
  total_score  numeric(6,2),
  scraped_at   timestamptz DEFAULT now(),
  UNIQUE(event_id, segment, skater_name)
);

CREATE INDEX IF NOT EXISTS idx_results_athlete ON competition_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_results_name    ON competition_results(skater_name);
