import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useClubs(page = 0) {
  return useQuery({
    queryKey: ['clubs', page],
    queryFn: async () => {
      const from = page * 20;
      const to = from + 19;
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, city, state, country, website, federation, plan, athletes(count)')
        .order('name')
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []).map(c => ({
        ...c,
        athlete_count: c.athletes?.[0]?.count ?? 0,
      }));
      return { rows, hasMore: rows.length === 20 };
    },
    staleTime: 5 * 60 * 1000,
  });
}
