import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useAthlete(id) {
  return useQuery({
    queryKey: ['athlete', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athletes')
        .select('*, clubs(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
