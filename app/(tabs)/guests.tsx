import GuestCard from '@/components/GuestCard';
import Screen from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';
import { useGuestsWithOrders } from "@/hooks/useGuestsWithOrders";
import { supabase } from '@/lib/supabase';
import { GuestStatus } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";

type FilterType = 'all' | GuestStatus;

const STATUS_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Served', value: 'served' },
  { label: 'Cleared', value: 'cleared' },
  { label: 'Payment', value: 'pending_payment' },
  { label: 'Paid', value: 'paid' },
];

export default function GuestsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { guests, loading, refetch } = useGuestsWithOrders();
  const scaleAnim = useMemo(() => new Animated.Value(0), []);
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([]);
  const [filterWaiter, setFilterWaiter] = useState<string | null>(null);

  useEffect(() => {
    if (guests.length === 0 && !loading) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [guests.length, loading, scaleAnim]);

  useEffect(() => {
    supabase
      .from('staff_profiles')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setWaiters(data);
      });
  }, []);

  const uniqueWaiters = useMemo(() => {
    const ids = new Set<string>();
    guests.forEach(g => { if (g.waiter_id) ids.add(g.waiter_id); });
    return waiters.filter(w => ids.has(w.id));
  }, [guests, waiters]);

  // Filter guests based on selected filters
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const statusMatch = filterStatus === 'all' || guest.status === filterStatus;
      const waiterMatch = filterWaiter === null || guest.waiter_id === filterWaiter;
      return statusMatch && waiterMatch;
    });
  }, [guests, filterStatus, filterWaiter]);

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Guests</Text>
          <Text style={styles.guestCount}>{guests.length} {guests.length === 1 ? 'guest' : 'guests'}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={refetch}>
          <Ionicons name="refresh" size={20} color="#0ea5e9" />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              style={[
                styles.filterBtn,
                filterStatus === option.value && styles.filterBtnActive,
              ]}
              onPress={() => setFilterStatus(option.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterStatus === option.value && styles.filterTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Waiter Filter */}
      {uniqueWaiters.length > 0 && (
        <View style={styles.waiterFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Pressable
              style={[styles.waiterChip, filterWaiter === null && styles.waiterChipActive]}
              onPress={() => setFilterWaiter(null)}
            >
              <Text style={[styles.waiterChipText, filterWaiter === null && styles.waiterChipTextActive]}>
                All Waiters
              </Text>
            </Pressable>
            {uniqueWaiters.map(waiter => (
              <Pressable
                key={waiter.id}
                style={[styles.waiterChip, filterWaiter === waiter.id && styles.waiterChipActive]}
                onPress={() => setFilterWaiter(waiter.id)}
              >
                <Text style={[styles.waiterChipText, filterWaiter === waiter.id && styles.waiterChipTextActive]}>
                  {waiter.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <Text style={styles.loadingText}>Loading guests...</Text>
      ) : filteredGuests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="people-outline" size={80} color="#d1d5db" />
          </Animated.View>
          <Text style={styles.emptyText}>
            {guests.length === 0 ? 'No guests yet' : 'No guests match your filters'}
          </Text>
          <Text style={styles.emptySubtext}>
            {guests.length === 0 ? 'Add guests from the tables screen' : 'Try adjusting your filters'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGuests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GuestCard guest={item} orders={item.orders} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ right: 1 }}
        />
      )}
    </Screen>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
    },
    guestCount: {
      fontSize: 14,
      fontWeight: '600',
      color: c.subtext,
      marginTop: 4,
    },
    refreshBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: c.background,
    },
    filtersContainer: {
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingVertical: 12,
    },
    filterScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
    },
    filterBtnActive: {
      backgroundColor: '#0ea5e9',
      borderColor: '#0ea5e9',
    },
    filterText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.subtext,
    },
    filterTextActive: {
      color: '#fff',
    },
    waiterFilterContainer: {
      backgroundColor: c.card,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    waiterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
    },
    waiterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    waiterChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
    },
    waiterChipTextActive: {
      color: '#fff',
    },
    list: {
      padding: 16,
      paddingBottom: 20,
    },
    loadingText: {
      fontSize: 16,
      color: c.subtext,
      textAlign: 'center',
      marginTop: 20,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconWrapper: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: c.subtext,
      textAlign: 'center',
    },
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterBtnActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  waiterFilterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  waiterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  waiterChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  waiterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  waiterChipTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
