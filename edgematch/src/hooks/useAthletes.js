import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useAthletes(clubId) {
  return useQuery({
    queryKey: ['athletes', { clubId }],
    queryFn: async () => {
      let q = supabase.from('athletes').select('*').order('name', { ascending: true });
      if (clubId) q = q.eq('club_id', clubId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
