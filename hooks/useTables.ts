import { supabase } from '@/lib/supabase';
import { Guest, Table } from '@/lib/types';
import { useEffect, useState } from 'react';

export function useTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [guestsByTable, setGuestsByTable] = useState<Record<string, Guest[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTables();
    fetchGuests();

    const tablesChannel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
      .subscribe();

    const guestsChannel = supabase
      .channel('guests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, fetchGuests)
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(guestsChannel);
    };
  }, []);

  async function fetchTables() {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('name');
    if (data) setTables(data);
    setLoading(false);
  }

  async function fetchGuests() {
    const { data } = await supabase
      .from('guests')
      .select('*')
      .order('seat_number');
    const map: Record<string, Guest[]> = {};
    if (data) {
      data.forEach((g: Guest) => {
        if (!map[g.table_id]) map[g.table_id] = [];
        // Only include active guests (not paid) in occupancy count
        if (g.status !== 'paid') {
          map[g.table_id].push(g);
        }
      });
    }
    setGuestsByTable(map);
    setLoading(false);
  }

  return { tables, guestsByTable, loading, refetch: fetchTables };
}
