import { supabase } from '@/lib/supabase';
import { Reservation } from '@/lib/types';
import { useEffect, useState } from 'react';

export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
    const channel = supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchReservations() {
    const { data } = await supabase
      .from('guests')
      .select('*')
      .order('created_at');
    if (data) setReservations(data);
    setLoading(false);
  }

  return { reservations, loading, refetch: fetchReservations };
}
