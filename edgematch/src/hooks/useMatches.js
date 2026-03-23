import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Fetches ranked compatibility matches for the given athlete.
 * Returns { matches, loading, error } where each match is:
 *   { ...score_row, partner: athlete_row }
 *
 * Uses the same query structure as the plan's /api/matches spec
 * implemented as a direct Supabase client join since we don't have
 * Edge Functions yet. RLS ensures only the participant can see their scores.
 */
export function useMatches(athleteId, { minScore = 0.3, limit = 20 } = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!athleteId) return;

    setLoading(true);
    setError(null);

    supabase
      .from('compatibility_scores')
      .select(`
        *,
        athlete_a:athletes!athlete_a_id(
          id, name, discipline, skating_level, partner_role,
          height_cm, weight_kg, age,
          location_city, location_state, location_country,
          club_name, coach_name, search_status, verified
        ),
        athlete_b:athletes!athlete_b_id(
          id, name, discipline, skating_level, partner_role,
          height_cm, weight_kg, age,
          location_city, location_state, location_country,
          club_name, coach_name, search_status, verified
        )
      `)
      .or(`athlete_a_id.eq.${athleteId},athlete_b_id.eq.${athleteId}`)
      .gte('total_score', minScore)
      .order('total_score', { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        // Resolve "partner" = the other athlete in the pair
        const resolved = (data ?? []).map(row => ({
          ...row,
          partner: row.athlete_a_id === athleteId ? row.athlete_b : row.athlete_a,
        }));
        setMatches(resolved);
        setLoading(false);
      });
  }, [athleteId, minScore, limit]);

  return { matches, loading, error };
}
