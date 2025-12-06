import Screen from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Animated, FlatList, StyleSheet, Text, View } from "react-native";

import { useReservations } from "@/hooks/useReservations";
export default function ReservationsScreen() {
  const { reservations, loading, refetch } = useReservations();
  const scaleAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (reservations.length === 0 && !loading) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [reservations.length, loading, scaleAnim]);

  // reservations now represent guests
  return (
    <Screen style={styles.container}>
      {loading ? (
        <Text style={{ padding: 16 }}>Loading guests...</Text>
      ) : reservations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="calendar-outline" size={80} color="#d1d5db" />
          </Animated.View>
          <Text style={styles.emptyText}>No reservations</Text>
          <Text style={styles.emptySubtext}>All guests are seated</Text>
        </View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.guest_name || 'Unnamed Guest'}</Text>
              <Text style={styles.phone}>Table: {item.table_id} | Seat: {item.seat_number}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 8,
    minWidth: 80,
    backgroundColor: "#fff",
  },
  addBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    color: "#fff",
    fontWeight: "700",
  },
  removeBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  removeText: {
    color: "#fff",
    fontWeight: "700",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  phone: {
    fontSize: 14,
    color: "#6b7280",
  },
  status: {
    fontSize: 14,
    color: "#3b82f6",
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrapper: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
