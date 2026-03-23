import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useAthletes(clubId) {
  return useQuery({
    queryKey: ['athletes', { clubId }],
    queryFn: async () => {
      let q = supabase
        .from('athletes')
        .select('id, name, skating_level, discipline, partner_role, location_city, location_state, height_cm, coach_name, profile_photo_url, club_id, club_name, search_status')
        .order('name', { ascending: true });
      if (clubId) q = q.eq('club_id', clubId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
