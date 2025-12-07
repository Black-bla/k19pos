import { supabase } from '@/lib/supabase';
import { Guest, GuestOrder } from '@/lib/types';
import { useEffect, useState } from 'react';

export interface GuestWithOrders extends Guest {
  orders: GuestOrder[];
  table_name?: string;
  waiter_id?: string | null;
  waiter_name?: string;
}

export function useGuestsWithOrders() {
  const [guests, setGuests] = useState<GuestWithOrders[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuests();
    const channel = supabase
      .channel('guests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, fetchGuests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_orders' }, fetchGuests)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchGuests() {
    try {
      const [{ data: guestsData, error: guestsError }, { data: ordersData, error: ordersError }, { data: waitersData, error: waitersError }] = await Promise.all([
        supabase
          .from('guests')
          .select('*, tables(name, waiter_id)')
          .order('created_at', { ascending: false }),
        supabase
          .from('guest_orders')
          .select('*'),
        supabase
          .from('staff_profiles')
          .select('id, name'),
      ]);

      if (guestsError) throw guestsError;
      if (ordersError) throw ordersError;
      if (waitersError) throw waitersError;

      if (!guestsData) {
        setGuests([]);
        setLoading(false);
        return;
      }

      const waiterMap = new Map<string, string>();
      (waitersData || []).forEach((w: any) => waiterMap.set(w.id, w.name));

      const guestsWithOrders: GuestWithOrders[] = guestsData.map((guest: any) => {
        const ordersForGuest = ordersData?.filter((o: any) => o.guest_id === guest.id) || [];
        const waiterId = guest.tables?.waiter_id ?? null;
        const waiterName = waiterId ? waiterMap.get(waiterId) : undefined;

        return {
          ...guest,
          waiter_id: waiterId,
          waiter_name: waiterName,
          table_name: guest.tables?.name || guest.table_id,
          orders: ordersForGuest,
        };
      });

      setGuests(guestsWithOrders);
    } catch (err) {
      console.error('Error fetching guests with orders:', err);
    } finally {
      setLoading(false);
    }
  }

  return { guests, loading, refetch: fetchGuests };
}
