import GuestCard from '@/components/GuestCard';
import Screen from '@/components/Screen';
import { useGuestsWithOrders } from "@/hooks/useGuestsWithOrders";
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
  const { guests, loading, refetch } = useGuestsWithOrders();
  const scaleAnim = useMemo(() => new Animated.Value(0), []);
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [filterTable, setFilterTable] = useState<string | null>(null);

  useEffect(() => {
    if (guests.length === 0 && !loading) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [guests.length, loading, scaleAnim]);

  // Get unique tables for filter dropdown
  const uniqueTables = useMemo(() => {
    return Array.from(new Set(guests.map(g => g.table_id))).sort();
  }, [guests]);

  // Filter guests based on selected filters
  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const statusMatch = filterStatus === 'all' || guest.status === filterStatus;
      const tableMatch = filterTable === null || guest.table_id === filterTable;
      return statusMatch && tableMatch;
    });
  }, [guests, filterStatus, filterTable]);

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Guests</Text>
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
                filterStatus === option.value && styles.filterBtnActive
              ]}
              onPress={() => setFilterStatus(option.value)}
            >
              <Text style={[
                styles.filterText,
                filterStatus === option.value && styles.filterTextActive
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Table Filter */}
      {uniqueTables.length > 1 && (
        <View style={styles.tableFilterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Pressable
              style={[
                styles.tableFilterBtn,
                filterTable === null && styles.tableFilterBtnActive
              ]}
              onPress={() => setFilterTable(null)}
            >
              <Text style={[
                styles.tableFilterText,
                filterTable === null && styles.tableFilterTextActive
              ]}>
                All Tables
              </Text>
            </Pressable>
            {uniqueTables.map(tableId => (
              <Pressable
                key={tableId}
                style={[
                  styles.tableFilterBtn,
                  filterTable === tableId && styles.tableFilterBtnActive
                ]}
                onPress={() => setFilterTable(tableId)}
              >
                <Text style={[
                  styles.tableFilterText,
                  filterTable === tableId && styles.tableFilterTextActive
                ]}>
                  {tableId}
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
  tableFilterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableFilterBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  tableFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tableFilterTextActive: {
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
