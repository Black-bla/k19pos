import { supabase } from '@/lib/supabase';
import { Reservation } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const RESERVATIONS_CACHE_KEY = 'reservations-cache-v1';

export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateFromCache();
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
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('time', { ascending: true });

      if (error) throw error;
      if (data) {
        setReservations(data as Reservation[]);
        await AsyncStorage.setItem(RESERVATIONS_CACHE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('fetchReservations failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(RESERVATIONS_CACHE_KEY);
        if (cached) {
          setReservations(JSON.parse(cached));
        }
      } catch (cacheErr) {
        console.warn('failed to load cached reservations after fetch error', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }

  async function hydrateFromCache() {
    try {
      const cached = await AsyncStorage.getItem(RESERVATIONS_CACHE_KEY);
      if (cached) {
        setReservations(JSON.parse(cached));
        setLoading(false);
      }
    } catch (err) {
      console.warn('hydrateFromCache failed', err);
    }
  }

  return { reservations, loading, refetch: fetchReservations };
}
