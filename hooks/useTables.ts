import { supabase } from '@/lib/supabase';
import { Guest, Reservation, Table } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const TABLES_CACHE_KEY = 'tables-cache-v1';
const GUESTS_CACHE_KEY = 'guests-cache-v1';
const RESERVATIONS_CACHE_KEY = 'table-reservations-cache-v1';

export function useTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [guestsByTable, setGuestsByTable] = useState<Record<string, Guest[]>>({});
  const [reservedTables, setReservedTables] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load cached data first so UI is instantly hydrated
    hydrateFromCache();

    // Then fetch fresh data in background
    fetchTables();
    fetchGuests();
    fetchReservations();

    const tablesChannel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
      .subscribe();

    const guestsChannel = supabase
      .channel('guests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, fetchGuests)
      .subscribe();

    // Keep tables/guests in sync with kitchen order status updates
    const guestOrdersChannel = supabase
      .channel('guest-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_orders' },
        fetchGuests
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('reservations-table-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(guestsChannel);
      supabase.removeChannel(guestOrdersChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) {
        setTables(data);
        await AsyncStorage.setItem(TABLES_CACHE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('fetchTables failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(TABLES_CACHE_KEY);
        if (cached) {
          setTables(JSON.parse(cached));
        }
      } catch (cacheErr) {
        console.warn('failed to load cached tables after fetch error', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('seat_number');

      if (error) throw error;

      const map: Record<string, Guest[]> = {};
      if (data) {
        data.forEach((g: Guest) => {
          if (!map[g.table_id]) map[g.table_id] = [];
          // Only include active guests (not paid) in occupancy count
          if (g.status !== 'paid') {
            map[g.table_id].push(g);
          }
        });

        await AsyncStorage.setItem(GUESTS_CACHE_KEY, JSON.stringify(map));
      }

      setGuestsByTable(map);
    } catch (err) {
      console.warn('fetchGuests failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(GUESTS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, Guest[]>;
          setGuestsByTable(parsed);
        }
      } catch (cacheErr) {
        console.warn('failed to load cached guests after fetch error', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('table_id')
        .eq('status', 'pending')
        .not('table_id', 'is', null);

      if (error) throw error;
      
      const reserved = new Set<string>();
      if (data) {
        data.forEach((r: Partial<Reservation>) => {
          if (r.table_id) reserved.add(r.table_id);
        });
        await AsyncStorage.setItem(RESERVATIONS_CACHE_KEY, JSON.stringify(Array.from(reserved)));
      }
      setReservedTables(reserved);
    } catch (err) {
      console.warn('fetchReservations failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(RESERVATIONS_CACHE_KEY);
        if (cached) {
          setReservedTables(new Set(JSON.parse(cached)));
        }
      } catch (cacheErr) {
        console.warn('failed to load cached reservations', cacheErr);
      }
    }
  }, []);

  const refetchAll = useCallback(async () => {
    await Promise.all([fetchTables(), fetchGuests(), fetchReservations()]);
  }, [fetchTables, fetchGuests, fetchReservations]);

  async function hydrateFromCache() {
    try {
      const [tablesCache, guestsCache] = await Promise.all([
        AsyncStorage.getItem(TABLES_CACHE_KEY),
        AsyncStorage.getItem(GUESTS_CACHE_KEY),
      ]);

      if (tablesCache) {
        setTables(JSON.parse(tablesCache));
      }

      if (guestsCache) {
        const parsed = JSON.parse(guestsCache) as Record<string, Guest[]>;
        setGuestsByTable(parsed);
      }

      // If either cache exists, allow UI to render immediately
      if (tablesCache || guestsCache) {
        setLoading(false);
      }
    } catch (err) {
      console.warn('hydrateFromCache failed', err);
    }
  }

  return { tables, guestsByTable, reservedTables, loading, refetch: fetchTables, refetchAll };
}
