import { showToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { GuestOrder } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface Guest {
  id: string;
  guest_name: string;
  seat_number: number;
  status: string;
}

interface OrderManagementScreenProps {
  guestId: string;
  guestName: string;
  tableId: string;
  onClose: () => void;
  onOrdersUpdated: () => void;
}

export default function OrderManagementScreen({
  guestId,
  guestName,
  tableId,
  onClose,
  onOrdersUpdated,
}: OrderManagementScreenProps) {
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [guestId]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('guest_orders')
        .select('*')
        .eq('guest_id', guestId);

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  async function handleDeleteOrder(orderId: string, itemName: string) {
    Alert.alert('Delete Order', `Remove ${itemName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('guest_orders')
              .delete()
              .eq('id', orderId);

            if (error) throw error;

            showToast('Order removed successfully', 'success', 3500, 'card');
            await fetchOrders();
            onOrdersUpdated();
          } catch (err) {
            console.error('Failed to delete order:', err);
            showToast('Failed to remove order', 'error', 3500, 'card');
          }
        },
      },
    ]);
  }

  async function handleQuantityChange(
    orderId: string,
    currentQuantity: number,
    itemName: string
  ) {
    const newQuantity = currentQuantity === 1 ? 0 : currentQuantity - 1;

    if (newQuantity === 0) {
      handleDeleteOrder(orderId, itemName);
      return;
    }

    try {
      const { error } = await supabase
        .from('guest_orders')
        .update({ quantity: newQuantity })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
      onOrdersUpdated();
    } catch (err) {
      console.error('Failed to update quantity:', err);
      Alert.alert('Error', 'Failed to update quantity');
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  }

  function calculateTotal() {
    return orders.reduce((sum, order) => sum + order.price_snapshot * order.quantity, 0);
  }

  function renderOrderItem({ item }: { item: GuestOrder }) {
    const subtotal = item.price_snapshot * item.quantity;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.itemName}>{item.menu_item_name}</Text>
            <Text style={styles.itemPrice}>{formatCurrency(item.price_snapshot)} each</Text>
          </View>
          {editMode ? (
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeleteOrder(item.id, item.menu_item_name)}
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.orderFooter}>
          {editMode && item.quantity > 0 ? (
            <Pressable
              style={styles.quantityControl}
              onPress={() =>
                handleQuantityChange(
                  item.id,
                  item.quantity,
                  item.menu_item_name
                )
              }
            >
              <Ionicons name="remove-circle-outline" size={18} color="#f59e0b" />
              <Text style={styles.quantityText}>{item.quantity}</Text>
            </Pressable>
          ) : (
            <Text style={styles.quantityBadge}>Qty: {item.quantity}</Text>
          )}
          <Text style={styles.subtotal}>{formatCurrency(subtotal)}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{guestName}'s Orders</Text>
            <Text style={styles.headerSubtitle}>{orders.length} item(s)</Text>
          </View>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </Pressable>
        </View>

        {orders.length > 0 && (
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.actionButton, editMode && styles.actionButtonActive]}
              onPress={() => setEditMode(!editMode)}
            >
              <Ionicons name={editMode ? 'checkmark' : 'pencil'} size={18} color="#0ea5e9" />
              <Text style={styles.actionButtonText}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Orders List */}
      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubtext}>Orders will appear here</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />

          {/* Summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(calculateTotal())}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    gap: 6,
  },
  actionButtonActive: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 120,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
    color: '#64748b',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  quantityBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  subtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
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
  summary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e7ff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
});
