import { supabase } from '@/lib/supabase';
import { Guest, GuestOrder } from '@/lib/types';
import { useEffect, useState } from 'react';

export interface GuestWithOrders extends Guest {
  orders: GuestOrder[];
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
      // Fetch all guests
      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });

      if (guestsError) throw guestsError;

      if (!guestsData) {
        setGuests([]);
        setLoading(false);
        return;
      }

      // Fetch all guest orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('guest_orders')
        .select('*');

      if (ordersError) throw ordersError;

      // Map orders to guests
      const guestsWithOrders: GuestWithOrders[] = guestsData.map(guest => ({
        ...guest,
        orders: ordersData?.filter(o => o.guest_id === guest.id) || [],
      }));

      setGuests(guestsWithOrders);
    } catch (err) {
      console.error('Error fetching guests with orders:', err);
    } finally {
      setLoading(false);
    }
  }

  return { guests, loading, refetch: fetchGuests };
}
