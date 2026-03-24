import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const ATHLETE_FIELDS = `
  id, name, discipline, skating_level, partner_role,
  height_cm, weight_kg, age,
  location_city, location_state, location_country,
  club_name, coach_name, search_status, verified
`;

/**
 * Fetches ranked compatibility matches for the given athlete.
 * Splits the OR query into two targeted queries (one per index) and
 * merges in JS — avoids the slow OR scan and the per-row RLS subquery.
 * Results are cached for 5 minutes via React Query.
 */
export function useMatches(athleteId, { minScore = 0.3, limit = 20 } = {}) {
  const { data: matches = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['matches', athleteId, minScore, limit],
    queryFn: async () => {
      if (!athleteId) return [];

      // Two focused queries — each can use its dedicated index.
      const [resA, resB] = await Promise.all([
        supabase
          .from('compatibility_scores')
          .select(`*, athlete_b:athletes!athlete_b_id(${ATHLETE_FIELDS})`)
          .eq('athlete_a_id', athleteId)
          .gte('total_score', minScore)
          .order('total_score', { ascending: false })
          .limit(limit),
        supabase
          .from('compatibility_scores')
          .select(`*, athlete_a:athletes!athlete_a_id(${ATHLETE_FIELDS})`)
          .eq('athlete_b_id', athleteId)
          .gte('total_score', minScore)
          .order('total_score', { ascending: false })
          .limit(limit),
      ]);

      if (resA.error) throw resA.error;
      if (resB.error) throw resB.error;

      const rowsA = (resA.data ?? []).map(r => ({ ...r, partner: r.athlete_b }));
      const rowsB = (resB.data ?? []).map(r => ({ ...r, partner: r.athlete_a }));

      // Merge, deduplicate by score id, sort by total_score desc, cap at limit.
      const seen = new Set();
      const merged = [...rowsA, ...rowsB]
        .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, limit);

      return merged;
    },
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });

  return { matches, loading, error: queryError?.message ?? null };
}
