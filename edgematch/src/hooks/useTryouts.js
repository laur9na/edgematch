import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Fetches tryouts where the athlete is either requester or recipient.
 * Returns { sent, received, loading, error, refetch }
 */
export function useTryouts(athleteId) {
  const [sent, setSent]         = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    setError(null);

    const cols = `
      *,
      requester:athletes!requester_id(id, name, skating_level, partner_role, location_city, location_state),
      recipient:athletes!recipient_id(id, name, skating_level, partner_role, location_city, location_state)
    `;

    const [sentRes, receivedRes] = await Promise.all([
      supabase
        .from('tryouts')
        .select(cols)
        .eq('requester_id', athleteId)
        .order('requested_at', { ascending: false }),
      supabase
        .from('tryouts')
        .select(cols)
        .eq('recipient_id', athleteId)
        .order('requested_at', { ascending: false }),
    ]);

    if (sentRes.error)     setError(sentRes.error.message);
    if (receivedRes.error) setError(receivedRes.error.message);

    setSent(sentRes.data ?? []);
    setReceived(receivedRes.data ?? []);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { sent, received, loading, error, refetch: fetch };
}
