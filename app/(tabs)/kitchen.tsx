import Screen from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
  category?: string;
  guest?: {
    guest_name: string;
    seat_number: number;
    table_id: string;
    tables?: {
      name: string;
    };
  };
}

interface GroupedOrder {
  guest_id: string;
  guest_name: string;
  table_name: string;
  seat_number: number;
  waiter_id?: string;
  waiter_name?: string;
  items: KitchenOrder[];
}

const KITCHEN_ORDERS_CACHE_KEY = 'kitchen-orders-cache-v1';

export default function KitchenScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'all'>('all');
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<string | 'all'>('all');
  const scaleAnimation = React.useRef(new Animated.Value(1)).current;

  const fetchOrders = useCallback(async () => {
    try {
      // Only show loading spinner if we have nothing in state yet
      setLoading((prev) => (orders.length === 0 ? true : prev));
      
      // Fetch guest orders
      const { data: ordersData, error: ordersError } = await supabase
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
            status,
            tables:table_id (
              name,
              waiter_id
            )
          )
        `)
        .neq('status', 'served');

      if (ordersError) throw ordersError;

      // Fetch all menu items to get categories
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, category');

      if (menuError) throw menuError;

      // Create a map of menu_item_id to category
      const categoryMap = new Map();
      (menuData || []).forEach((item: any) => {
        categoryMap.set(item.id, item.category);
      });

      const waiterMap = new Map(waiters.map((w) => [w.id, w.name]));

      // Transform and enrich the orders with category
      const transformedData = (ordersData || []).map((order: any) => {
        const guest = Array.isArray(order.guests) ? order.guests[0] : order.guests;
        const waiterId = guest?.tables?.waiter_id;
        return {
          ...order,
          guest,
          waiter_id: waiterId,
          waiter_name: waiterId ? waiterMap.get(waiterId) : undefined,
          category: categoryMap.get(order.menu_item_id),
        };
      });

      // Filter out orders for guests who are already done/paid
      const activeOrders = transformedData.filter((order: any) => {
        const gStatus = order.guest?.status;
        return !['paid', 'pending_payment', 'served', 'cleared'].includes(gStatus as string);
      });

      setOrders(activeOrders);
      await AsyncStorage.setItem(KITCHEN_ORDERS_CACHE_KEY, JSON.stringify(activeOrders));
    } catch (err) {
      console.warn('Failed to fetch kitchen orders, using existing data', err);
      // On failure, try to reuse cached data if available
      try {
        const cached = await AsyncStorage.getItem(KITCHEN_ORDERS_CACHE_KEY);
        if (cached) {
          setOrders(JSON.parse(cached));
        }
      } catch (cacheErr) {
        console.warn('Failed to load cached kitchen orders after fetch error', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, [orders.length]);

  useEffect(() => {
    // Start breathing animation
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    if (loading) {
      scaleAnim.start();
    }

    return () => {
      scaleAnim.stop();
    };
  }, [loading]);

  useEffect(() => {
    hydrateFromCache();
    fetchOrders();

    supabase
      .from('staff_profiles')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setWaiters(data);
      });

    // Subscribe to real-time updates from guest_orders
    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_orders' },
        () => {
          // Refetch when new orders arrive or statuses change
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  useEffect(() => {
    const id = setInterval(() => {
      fetchOrders();
    }, 60000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  async function hydrateFromCache() {
    try {
      const cached = await AsyncStorage.getItem(KITCHEN_ORDERS_CACHE_KEY);
      if (cached) {
        setOrders(JSON.parse(cached));
        setLoading(false);
      }
    } catch (err) {
      console.warn('Failed to hydrate kitchen cache', err);
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

  function getFilteredOrders(): GroupedOrder[] {
    // Group orders by guest_id
    const grouped: { [key: string]: KitchenOrder[] } = {};
    
    orders.forEach((order) => {
      if (!grouped[order.guest_id]) {
        grouped[order.guest_id] = [];
      }
      grouped[order.guest_id].push(order);
    });

    // Convert to array of GroupedOrder
    const groupedArray: GroupedOrder[] = Object.entries(grouped).map(([guestId, items]) => {
      const firstItem = items[0];
      return {
        guest_id: guestId,
        guest_name: firstItem.guest?.guest_name || 'Unknown Guest',
        table_name: firstItem.guest?.tables?.name || 'Unknown Table',
        seat_number: firstItem.guest?.seat_number || 0,
        waiter_id: firstItem.waiter_id,
        waiter_name: firstItem.waiter_name,
        items,
      };
    });

    // Apply filter
    const statusFiltered = selectedFilter === 'all'
      ? groupedArray
      : groupedArray.filter((order) => order.items.some((item) => item.status === selectedFilter));

    if (selectedWaiter === 'all') return statusFiltered;
    return statusFiltered.filter((order) => order.waiter_id === selectedWaiter);
  }

  function getCourseColor(category: string | undefined) {
    switch (category) {
      case 'STARTER':
        return '#f59e0b';
      case 'MAIN_MEAL':
        return '#ef4444';
      case 'DESSERT':
        return '#a855f7';
      case 'DRINKS':
        return '#3b82f6';
      default:
        return '#94a3b8';
    }
  }

  function getCourseIcon(category: string | undefined) {
    switch (category) {
      case 'STARTER':
        return 'leaf-outline';
      case 'MAIN_MEAL':
        return 'pizza-outline';
      case 'DESSERT':
        return 'ice-cream-outline';
      case 'DRINKS':
        return 'beer-outline';
      default:
        return 'restaurant-outline';
    }
  }

  function getCourseName(category: string | undefined) {
    switch (category) {
      case 'STARTER':
        return 'Starter';
      case 'MAIN_MEAL':
        return 'Main';
      case 'DESSERT':
        return 'Dessert';
      case 'DRINKS':
        return 'Drink';
      default:
        return 'Item';
    }
  }

  function renderOrderCard({ item }: { item: GroupedOrder }) {
    // Group items by category within this guest's order
    const itemsByCategory: { [key: string]: KitchenOrder[] } = {};
    
    item.items.forEach((order) => {
      const category = order.category || 'OTHER';
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
      }
      itemsByCategory[category].push(order);
    });

    // Define course order
    const courseOrder = ['STARTER', 'MAIN_MEAL', 'DESSERT', 'DRINKS'];
    const sortedCategories = courseOrder.filter((cat) => itemsByCategory[cat]);

    const getNextStatus = (current: OrderStatus): OrderStatus | null => {
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
    };

    const handleCoursePress = (category: string) => {
      const categoryItems = itemsByCategory[category];
      const courseStatus = categoryItems[0]?.status || 'pending';
      const nextStatus = getNextStatus(courseStatus);

      if (nextStatus) {
        // Update all items in this course to the next status
        categoryItems.forEach((item) => {
          handleUpdateStatus(item.id, nextStatus);
        });
      }
    };

    return (
      <View style={styles.orderCard}>
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.tableInfo}>
            <Text style={styles.tableName}>{item.table_name}</Text>
            <Text style={styles.seatNumber}>Seat {item.seat_number} • {item.guest_name}</Text>
          </View>
          {item.waiter_name && (
            <View style={styles.waiterPill}>
              <Ionicons name="person" size={14} color="#0ea5e9" />
              <Text style={styles.waiterPillText}>{item.waiter_name}</Text>
            </View>
          )}
        </View>

        {/* Grouped Course Items */}
        <View style={styles.coursesContainer}>
          {sortedCategories.map((category) => {
            const categoryItems = itemsByCategory[category];
            const courseStatus = categoryItems[0]?.status || 'pending';
            const nextStatus = getNextStatus(courseStatus);
            const canAdvance = nextStatus !== null;

            return (
              <Pressable
                key={category}
                onPress={() => handleCoursePress(category)}
                disabled={!canAdvance}
              >
                <View style={[styles.courseItem, !canAdvance && styles.courseItemDisabled]}>
                  {/* Course Header */}
                  <View style={styles.courseHeader}>
                    <View style={styles.courseInfo}>
                      <View
                        style={[
                          styles.courseBadge,
                          { backgroundColor: getCourseColor(category) },
                        ]}
                      >
                        <Ionicons
                          name={getCourseIcon(category)}
                          size={14}
                          color="#fff"
                        />
                      </View>
                      <View style={styles.courseDetails}>
                        <Text style={styles.courseName}>{getCourseName(category)}</Text>
                        <Text style={styles.courseStatus}>
                          {courseStatus === 'pending'
                            ? 'Tap to start'
                            : courseStatus === 'preparing'
                              ? 'Tap when ready'
                              : 'Ready to serve'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusContainer,
                        {
                          backgroundColor:
                            courseStatus === 'ready'
                              ? '#dcfce7'
                              : courseStatus === 'preparing'
                                ? '#fef3c7'
                                : '#fee2e2',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              courseStatus === 'ready'
                                ? '#10b981'
                                : courseStatus === 'preparing'
                                  ? '#f59e0b'
                                  : '#ef4444',
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusLabel,
                          {
                            color:
                              courseStatus === 'ready'
                                ? '#10b981'
                                : courseStatus === 'preparing'
                                  ? '#f59e0b'
                                  : '#ef4444',
                          },
                        ]}
                      >
                        {courseStatus.charAt(0).toUpperCase() + courseStatus.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Dishes in this course */}
                  <View style={styles.dishesContainer}>
                    {categoryItems.map((courseItem) => (
                      <View key={courseItem.id} style={styles.dishItem}>
                        <Text style={styles.dishQuantity}>{courseItem.quantity}x</Text>
                        <Text style={styles.dishName}>{courseItem.menu_item_name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  if (loading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingIconWrapper,
              {
                transform: [
                  { scale: scaleAnimation },
                ],
              },
            ]}
          >
            <Ionicons name="flame" size={80} color="#fca5a5" />
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

      {/* Waiter Filter */}
      {waiters.length > 0 && (
        <View style={styles.waiterFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.waiterScroll}
          >
            <Pressable
              style={[styles.waiterChip, selectedWaiter === 'all' && styles.waiterChipActive]}
              onPress={() => setSelectedWaiter('all')}
            >
              <Text style={[styles.waiterChipText, selectedWaiter === 'all' && styles.waiterChipTextActive]}>
                All Waiters
              </Text>
            </Pressable>
            {waiters.map((waiter) => (
              <Pressable
                key={waiter.id}
                style={[styles.waiterChip, selectedWaiter === waiter.id && styles.waiterChipActive]}
                onPress={() => setSelectedWaiter(waiter.id)}
              >
                <Text style={[styles.waiterChipText, selectedWaiter === waiter.id && styles.waiterChipTextActive]}>
                  {waiter.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

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
          keyExtractor={(item) => item.guest_id}
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
      color: c.muted,
    },
    header: {
      backgroundColor: c.card,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: c.muted,
      fontWeight: '500',
    },
    filterContainer: {
      flexDirection: 'row',
      backgroundColor: c.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: c.input,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: c.primary,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.muted,
    },
    filterTextActive: {
      color: '#fff',
    },
    waiterFilterContainer: {
      backgroundColor: c.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    waiterScroll: {
      gap: 8,
    },
    waiterChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 8,
    },
    waiterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    waiterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.text,
    },
    waiterChipTextActive: {
      color: '#fff',
    },
    waiterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.input,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    waiterPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.primary,
    },
    listContent: {
      padding: 12,
      paddingBottom: 24,
    },
    orderCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: theme.isDark ? 0.1 : 0.05,
      shadowRadius: 2,
      elevation: theme.isDark ? 0 : 2,
    },
    orderHeader: {
      marginBottom: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tableInfo: {
      flex: 1,
    },
    tableName: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 2,
    },
    seatNumber: {
      fontSize: 12,
      color: c.muted,
    },
    coursesContainer: {
      gap: 10,
      marginBottom: 12,
    },
    courseItem: {
      backgroundColor: c.input,
      borderRadius: 10,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: c.border,
    },
    courseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    courseInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    courseBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    courseDetails: {
      flex: 1,
    },
    courseName: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginBottom: 2,
    },
    courseStatus: {
      fontSize: 11,
      color: c.muted,
      fontStyle: 'italic',
    },
    courseItemDisabled: {
      opacity: 0.6,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      gap: 6,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: c.text,
    },
    dishesContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 8,
    },
    dishItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dishQuantity: {
      fontSize: 12,
      fontWeight: '700',
      color: c.primary,
      minWidth: 32,
    },
    dishName: {
      fontSize: 12,
      color: c.subtext,
      flex: 1,
    },
    itemName: {
      fontSize: 12,
      color: c.muted,
    },
    orderFooter: {
      gap: 8,
    },
    courseActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      gap: 6,
    },
    courseActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
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
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemQuantity: {
      fontSize: 18,
      fontWeight: '800',
      color: c.primary,
      minWidth: 40,
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
      color: c.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: c.muted,
      marginTop: 8,
      textAlign: 'center',
    },
  });
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
  waiterFilterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  waiterScroll: {
    gap: 8,
  },
  waiterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  waiterChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  waiterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  waiterChipTextActive: {
    color: '#fff',
  },
  waiterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  waiterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0ea5e9',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  coursesContainer: {
    gap: 10,
    marginBottom: 12,
  },
  courseItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e2e8f0',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  courseBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseDetails: {
    flex: 1,
  },
  courseName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  courseStatus: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  courseItemDisabled: {
    opacity: 0.6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dishesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  dishItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dishQuantity: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0ea5e9',
    minWidth: 32,
  },
  dishName: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  itemName: {
    fontSize: 12,
    color: '#64748b',
  },
  orderFooter: {
    gap: 8,
  },
  courseActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  courseActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
