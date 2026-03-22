import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('*, athletes(count)');
      if (error) throw error;
      return (data ?? []).map(c => ({
        ...c,
        athlete_count: c.athletes?.[0]?.count ?? 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
