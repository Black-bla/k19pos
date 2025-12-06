import { mapGuestStatusToBadge } from '@/lib/statusMap';
import { Guest, GuestOrder } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import StatusBadge from './StatusBadge';

interface Props {
  guest: Guest;
  orders?: GuestOrder[];
}

export default function GuestCard({ guest, orders = [] }: Props) {
  // Group orders by category
  const ordersByCategory = {
    STARTER: orders.filter(o => {
      // We need to infer category from menu item type
      // For now, we'll check if orders have a category field
      return true; // placeholder
    }),
    MAIN_MEAL: orders.filter(o => true),
    DESSERT: orders.filter(o => true),
    DRINKS: orders.filter(o => true),
  };

  const hasOrders = orders.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.guestInfo}>
          <Text style={styles.guestName}>{guest.guest_name || 'Unnamed Guest'}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>Seat {guest.seat_number}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>Table {guest.table_id}</Text>
          </View>
        </View>
        <StatusBadge status={mapGuestStatusToBadge(guest.status)} label={guest.status} />
      </View>

      {hasOrders && (
        <View style={styles.ordersSection}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          
          {orders.length > 0 && (
            <View style={styles.orderGrid}>
              {orders.map((order, idx) => (
                <View key={order.id || idx} style={styles.orderItem}>
                  <View style={styles.orderItemHeader}>
                    <Text style={styles.orderItemName} numberOfLines={2}>
                      {order.menu_item_name}
                    </Text>
                    {order.quantity > 1 && (
                      <Text style={styles.quantity}>x{order.quantity}</Text>
                    )}
                  </View>
                  <Text style={styles.price}>
                    ${(order.price_snapshot * order.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {orders.length === 0 && (
            <Text style={styles.noOrders}>No items ordered yet</Text>
          )}
        </View>
      )}

      {!hasOrders && (
        <View style={styles.noOrdersContainer}>
          <Ionicons name="document-text-outline" size={32} color="#cbd5e1" />
          <Text style={styles.noOrdersText}>No items ordered</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  guestInfo: {
    flex: 1,
    marginRight: 12,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  ordersSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  orderGrid: {
    gap: 8,
  },
  orderItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  orderItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  quantity: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  noOrders: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  noOrdersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  noOrdersText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
});
