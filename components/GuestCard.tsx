import { useTheme } from '@/context/ThemeContext';
import { GuestWithOrders } from '@/hooks/useGuestsWithOrders';
import { mapGuestStatusToBadge } from '@/lib/statusMap';
import { GuestOrder } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import StatusBadge from './StatusBadge';

interface Props {
  guest: GuestWithOrders;
  orders?: GuestOrder[];
}

export default function GuestCard({ guest, orders = [] }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hasOrders = orders.length > 0;
  const totalAmount = orders.reduce((sum, order) => sum + (order.price_snapshot * order.quantity), 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.guestInfo}>
          <Text style={styles.guestName}>{guest.guest_name || 'Unnamed Guest'}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>Seat {guest.seat_number}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{guest.table_name || guest.table_id}</Text>
            {guest.waiter_name && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>Waiter: {guest.waiter_name}</Text>
              </>
            )}
          </View>
        </View>
        <StatusBadge status={mapGuestStatusToBadge(guest.status)} label={guest.status} />
      </View>

      {/* Always show orders section */}
      <View style={styles.ordersSection}>
        {hasOrders ? (
          <View style={styles.ordersList}>
            {orders.map((order, idx) => (
              <View key={order.id || idx} style={styles.orderItem}>
                <Text style={styles.orderItemName}>
                  {order.quantity}x {order.menu_item_name}
                </Text>
                <Text style={styles.orderItemPrice}>
                  KSh {(order.price_snapshot * order.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.orderTotal}>
              <Text style={styles.orderTotalLabel}>Total:</Text>
              <Text style={styles.orderTotalAmount}>KSh {totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noOrdersContainer}>
            <Ionicons name="document-text-outline" size={32} color={styles.noOrdersIcon.color} />
            <Text style={styles.noOrdersText}>No items ordered yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  },
  guestInfo: {
    flex: 1,
    marginRight: 12,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
  },
  ordersSection: {
    marginTop: 12,
  },
  ordersList: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 13,
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  orderTotalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  noOrdersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  noOrdersText: {
    fontSize: 14,
    marginTop: 8,
  },
});

function createStyles(theme: any) {
  const c = theme.colors;

  return StyleSheet.create({
    ...baseStyles,
    card: {
      ...baseStyles.card,
      backgroundColor: c.card,
      borderColor: c.border,
    },
    header: {
      ...baseStyles.header,
      borderBottomColor: c.border,
    },
    guestInfo: baseStyles.guestInfo,
    guestName: {
      ...baseStyles.guestName,
      color: c.text,
    },
    meta: baseStyles.meta,
    metaText: {
      ...baseStyles.metaText,
      color: c.subtext,
    },
    metaDot: {
      ...baseStyles.metaDot,
      color: c.border,
    },
    ordersSection: baseStyles.ordersSection,
    ordersList: {
      ...baseStyles.ordersList,
      backgroundColor: c.input,
      borderColor: c.border,
    },
    orderItem: baseStyles.orderItem,
    orderItemName: {
      ...baseStyles.orderItemName,
      color: c.text,
    },
    orderItemPrice: {
      ...baseStyles.orderItemPrice,
      color: c.text,
    },
    orderTotal: {
      ...baseStyles.orderTotal,
      borderTopColor: c.border,
    },
    orderTotalLabel: {
      ...baseStyles.orderTotalLabel,
      color: c.text,
    },
    orderTotalAmount: {
      ...baseStyles.orderTotalAmount,
      color: c.success,
    },
    noOrdersContainer: baseStyles.noOrdersContainer,
    noOrdersText: {
      ...baseStyles.noOrdersText,
      color: c.subtext,
    },
    noOrdersIcon: {
      color: c.muted,
    },
  });
}
