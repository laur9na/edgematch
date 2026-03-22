import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useAthletes(clubId) {
  return useQuery({
    queryKey: ['athletes', { clubId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athletes')
        .select('*')
        .eq('club_id', clubId)
        .eq('search_status', 'active');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
    staleTime: 5 * 60 * 1000,
  });
}
