import Screen from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served';

interface KitchenOrder {
  id: string;
  guest_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  price_snapshot: number;
  status: OrderStatus;
  guest?: {
    guest_name: string;
    seat_number: number;
    table_id: string;
    tables?: {
      name: string;
    };
  };
}

export default function KitchenScreen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'all'>('all');
  const scaleAnimation = React.useRef(new Animated.Value(1)).current;
  const rotateAnimation = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations when loading
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    const rotateAnim = Animated.loop(
      Animated.timing(rotateAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    if (loading) {
      scaleAnim.start();
      rotateAnim.start();
    }

    return () => {
      scaleAnim.stop();
      rotateAnim.stop();
    };
  }, [loading]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('guest_orders')
        .select(`
          id,
          guest_id,
          menu_item_id,
          menu_item_name,
          quantity,
          price_snapshot,
          status,
          guests:guest_id (
            guest_name,
            seat_number,
            table_id,
            tables:table_id (
              name
            )
          )
        `)
        .neq('status', 'served');

      if (error) throw error;

      // Transform the data to handle the nested structure
      const transformedData = (data || []).map((order: any) => ({
        ...order,
        guest: Array.isArray(order.guests) ? order.guests[0] : order.guests,
      }));

      setOrders(transformedData);
    } catch (err) {
      console.error('Failed to fetch kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  async function handleUpdateStatus(orderId: string, newStatus: OrderStatus) {
    try {
      const { error } = await supabase
        .from('guest_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
    } catch (err) {
      console.error('Failed to update order status:', err);
      Alert.alert('Error', 'Failed to update order status');
    }
  }

  function getStatusColor(status: OrderStatus) {
    switch (status) {
      case 'pending':
        return '#ef4444';
      case 'preparing':
        return '#f59e0b';
      case 'ready':
        return '#10b981';
      case 'served':
        return '#6b7280';
      default:
        return '#94a3b8';
    }
  }

  function getStatusIcon(status: OrderStatus) {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'preparing':
        return 'flame-outline';
      case 'ready':
        return 'checkmark-circle-outline';
      case 'served':
        return 'checkmark-done-circle';
      default:
        return 'help-circle-outline';
    }
  }

  function getNextStatus(current: OrderStatus): OrderStatus | null {
    switch (current) {
      case 'pending':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'served';
      default:
        return null;
    }
  }

  function getNextStatusLabel(current: OrderStatus): string {
    switch (current) {
      case 'pending':
        return 'Start';
      case 'preparing':
        return 'Ready';
      case 'ready':
        return 'Served';
      default:
        return '';
    }
  }

  function getFilteredOrders() {
    if (selectedFilter === 'all') return orders;
    return orders.filter((order) => order.status === selectedFilter);
  }

  function renderOrderCard({ item }: { item: KitchenOrder }) {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const nextStatus = getNextStatus(item.status);
    const nextLabel = getNextStatusLabel(item.status);
    const tableName = item.guest?.tables?.name || 'Unknown Table';

    return (
      <View style={[styles.orderCard, { borderLeftColor: statusColor }]}>
        <View style={styles.orderHeader}>
          <View style={styles.tableInfo}>
            <Text style={styles.tableName}>{tableName}</Text>
            <Text style={styles.seatNumber}>Seat {item.guest?.seat_number || '?'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Ionicons name={statusIcon} size={16} color="#fff" />
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          <Text style={styles.guestName}>{item.guest?.guest_name || 'Unknown Guest'}</Text>
          <View style={styles.itemRow}>
            <Text style={styles.itemQuantity}>{item.quantity}x</Text>
            <Text style={styles.itemName}>{item.menu_item_name}</Text>
          </View>
        </View>

        {nextStatus && (
          <View style={styles.orderFooter}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: getStatusColor(nextStatus) }]}
              onPress={() => handleUpdateStatus(item.id, nextStatus)}
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>{nextLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  if (loading) {
    const rotate = rotateAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingIconWrapper,
              {
                transform: [
                  { scale: scaleAnimation },
                  { rotate: rotate },
                ],
              },
            ]}
          >
            <Ionicons name="flame" size={80} color="#ef4444" />
          </Animated.View>
          <Text style={styles.loadingText}>Loading kitchen orders...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kitchen Orders</Text>
        <Text style={styles.headerSubtitle}>{filteredOrders.length} active orders</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Pressable
          style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All ({orders.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, selectedFilter === 'pending' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('pending')}
        >
          <Text style={[styles.filterText, selectedFilter === 'pending' && styles.filterTextActive]}>
            Pending ({pendingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, selectedFilter === 'preparing' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('preparing')}
        >
          <Text style={[styles.filterText, selectedFilter === 'preparing' && styles.filterTextActive]}>
            Preparing ({preparingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, selectedFilter === 'ready' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('ready')}
        >
          <Text style={[styles.filterText, selectedFilter === 'ready' && styles.filterTextActive]}>
            Ready ({readyCount})
          </Text>
        </Pressable>
      </View>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No orders</Text>
          <Text style={styles.emptySubtext}>
            {selectedFilter === 'all'
              ? 'Orders will appear here when guests place them'
              : `No ${selectedFilter} orders at the moment`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconWrapper: {
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#0ea5e9',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  seatNumber: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  orderBody: {
    marginBottom: 12,
  },
  guestName: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0ea5e9',
    minWidth: 40,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
});
