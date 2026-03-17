-- 005_security_definer_scorer.sql
-- score_new_athlete must run as a privileged role so it can INSERT into
-- compatibility_scores (which has no RLS INSERT policy for regular users).
-- SECURITY DEFINER means the function executes with the permissions of the
-- role that OWNS the function (postgres / service role), not the calling user.

CREATE OR REPLACE FUNCTION score_new_athlete(new_athlete_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a            athletes%ROWTYPE;
  b            athletes%ROWTYPE;
  id_a         uuid;
  id_b         uuid;
  delta        numeric;
  h_score      numeric;
  l_score      numeric;
  r_score      numeric;
  total        numeric;
  level_idx_a  int;
  level_idx_b  int;
  ldelta       int;
  levels       text[] := ARRAY['pre_juvenile','juvenile','intermediate','novice','junior','senior','adult'];
BEGIN
  SELECT * INTO a FROM athletes WHERE id = new_athlete_id;

  FOR b IN
    SELECT * FROM athletes
    WHERE id <> new_athlete_id
      AND discipline = a.discipline
      AND search_status = 'active'
  LOOP
    IF a.id < b.id THEN
      id_a := a.id; id_b := b.id;
    ELSE
      id_a := b.id; id_b := a.id;
    END IF;

    delta := ABS(a.height_cm - b.height_cm);

    IF a.discipline = 'pairs' THEN
      IF delta BETWEEN 15 AND 25 THEN h_score := 1.0;
      ELSIF delta < 15 THEN h_score := GREATEST(0.0, 1.0 - (15.0 - delta) / 15.0);
      ELSE h_score := GREATEST(0.0, 1.0 - (delta - 25.0) / 20.0);
      END IF;
    ELSIF a.discipline = 'ice_dance' THEN
      IF delta BETWEEN 8 AND 18 THEN h_score := 1.0;
      ELSIF delta < 8 THEN h_score := GREATEST(0.0, 1.0 - (8.0 - delta) / 10.0);
      ELSE h_score := GREATEST(0.0, 1.0 - (delta - 18.0) / 15.0);
      END IF;
    ELSE
      h_score := GREATEST(0.0, 1.0 - delta / 15.0);
    END IF;

    level_idx_a := array_position(levels, a.skating_level::text);
    level_idx_b := array_position(levels, b.skating_level::text);
    ldelta := ABS(level_idx_a - level_idx_b);
    l_score := CASE ldelta WHEN 0 THEN 1.0 WHEN 1 THEN 0.7 WHEN 2 THEN 0.4 WHEN 3 THEN 0.15 ELSE 0.0 END;

    IF (a.partner_role = 'lady' AND b.partner_role = 'man')
       OR (a.partner_role = 'man' AND b.partner_role = 'lady') THEN
      r_score := 1.0;
    ELSIF (a.partner_role = 'either' AND b.partner_role IN ('man','lady'))
       OR (b.partner_role = 'either' AND a.partner_role IN ('man','lady')) THEN
      r_score := 0.9;
    ELSIF a.partner_role = 'either' AND b.partner_role = 'either' THEN
      r_score := 0.7;
    ELSIF (a.partner_role = 'lady' AND b.partner_role = 'lady')
       OR (a.partner_role = 'man'  AND b.partner_role = 'man') THEN
      r_score := 0.0;
    ELSE
      r_score := 0.5;
    END IF;

    total := ROUND((h_score * 0.35 + l_score * 0.30 + r_score * 0.15 + 0.5 * 0.15 + 0.5 * 0.05)::numeric, 3);

    INSERT INTO compatibility_scores
      (athlete_a_id, athlete_b_id, height_score, level_score, role_score,
       location_score, goals_score, total_score, score_version)
    VALUES
      (id_a, id_b, h_score, l_score, r_score, 0.5, 0.5, total, 1)
    ON CONFLICT (athlete_a_id, athlete_b_id) DO UPDATE SET
      height_score  = EXCLUDED.height_score,
      level_score   = EXCLUDED.level_score,
      role_score    = EXCLUDED.role_score,
      total_score   = EXCLUDED.total_score,
      score_version = EXCLUDED.score_version,
      computed_at   = now();
  END LOOP;
END;
$$;
