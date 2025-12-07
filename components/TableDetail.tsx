import { useTheme } from '@/context/ThemeContext';
import { mapGuestStatusToBadge } from '@/lib/statusMap';
import { supabase } from '@/lib/supabase';
import { Guest, GuestOrder, GuestStatus, Table } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ModalBox from './ModalBox';
import StatusBadge from './StatusBadge';

interface Props {
  table: Table;
  guests: Guest[];
  onClose: () => void;
  onAddGuest: (seatNumber: number, guestName: string) => Promise<void>;
  onUpdateGuestStatus: (guestId: string, status: GuestStatus) => Promise<void>;
  onOpenGuestOrder: (guestId: string) => void;
  onTriggerPayment: (guestId: string) => void;
  onEditGuestOrders?: (guestId: string, guestName: string) => void;
}

const STATUS_ORDER: GuestStatus[] = ['pending', 'ordered', 'served', 'cleared', 'pending_payment', 'paid'];

export default function TableDetail({ table, guests, onClose, onAddGuest, onUpdateGuestStatus, onOpenGuestOrder, onTriggerPayment, onEditGuestOrders }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [guestOrders, setGuestOrders] = useState<Record<string, GuestOrder[]>>({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [addingSeat, setAddingSeat] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([]);
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);
  const [reassigningWaiter, setReassigningWaiter] = useState(false);

  // Only count guests who haven't paid (paid guests have left)
  const activeGuests = guests.filter(g => g.status !== 'paid');

  useEffect(() => {
    // Fetch waiters
    supabase
      .from('staff_profiles')
      .select('id, name')
      .eq('role', 'staff')
      .order('name')
      .then(({ data }) => {
        if (data) setWaiters(data);
      });

    if (activeGuests.length > 0) {
      fetchGuestOrders();
    }

    // Subscribe to guest_orders changes for real-time updates
    const channel = supabase
      .channel(`table-guest-orders-${table.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'guest_orders' },
        (payload) => {
          // Refetch orders when status changes anywhere
          if (activeGuests.length > 0) {
            fetchGuestOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guests]);

  async function fetchGuestOrders() {
    setLoadingOrders(true);
    try {
      const guestIds = activeGuests.map(g => g.id);
      const { data, error } = await supabase
        .from('guest_orders')
        .select('*')
        .in('guest_id', guestIds);

      if (error) throw error;

      // Group orders by guest_id
      const ordersByGuest: Record<string, GuestOrder[]> = {};
      data?.forEach((order) => {
        if (!ordersByGuest[order.guest_id]) {
          ordersByGuest[order.guest_id] = [];
        }
        ordersByGuest[order.guest_id].push(order);
      });

      setGuestOrders(ordersByGuest);
    } catch (err) {
      console.error('Failed to fetch guest orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }

  function nextStatus(current: GuestStatus) {
    const idx = STATUS_ORDER.indexOf(current);
    return STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
  }

  async function handleAddGuest() {
    if (!guestName.trim()) {
      Alert.alert('Error', 'Please enter guest name');
      return;
    }
    
    try {
      await onAddGuest(addingSeat!, guestName.trim());
      setAddingSeat(null);
      setGuestName('');
    } catch (err) {
      Alert.alert('Error', 'Failed to add guest');
    }
  }

  async function handleReassignWaiter(waiterId: string) {
    setReassigningWaiter(true);
    try {
      const { error } = await supabase
        .from('tables')
        .update({ waiter_id: waiterId })
        .eq('id', table.id);

      if (error) throw error;
      setShowWaiterDropdown(false);
      Alert.alert('Success', 'Waiter reassigned');
    } catch (err) {
      console.error('Failed to reassign waiter:', err);
      Alert.alert('Error', 'Failed to reassign waiter');
    } finally {
      setReassigningWaiter(false);
    }
  }

  // When guests exist, show guest action cards; otherwise show seat list for adding
  const hasGuests = guests.length > 0;
  
  // Empty seats are those without active guests
  const emptySeats = Array.from({ length: table.seat_count }, (_, i) => i + 1).filter(
    seatNum => !activeGuests.find(g => g.seat_number === seatNum)
  );

  return (
    <ModalBox
      title={table.name}
      subtitle={`${guests.length}/${table.seat_count} seats occupied`}
      onClose={onClose}
      showFooter={false}
    >
      {/* Waiter Assignment Section */}
      <View style={styles.waiterSection}>
        <View style={styles.waiterHeader}>
          <Text style={styles.waiterLabel}>Assigned Waiter</Text>
          <Pressable
            style={styles.waiterChangeBtn}
            onPress={() => setShowWaiterDropdown(!showWaiterDropdown)}
            disabled={reassigningWaiter}
          >
            <Text style={styles.waiterChangeBtnText}>
              {table.waiter_id ? 'Change' : 'Assign'}
            </Text>
          </Pressable>
        </View>
        {table.waiter_id ? (
          <Text style={styles.waiterName}>
            {waiters.find(w => w.id === table.waiter_id)?.name || 'Unknown'}
          </Text>
        ) : (
          <Text style={styles.noWaiter}>No waiter assigned</Text>
        )}

        {showWaiterDropdown && (
          <View style={styles.waiterDropdown}>
            {waiters.map((waiter) => (
              <Pressable
                key={waiter.id}
                style={[
                  styles.waiterDropdownItem,
                  table.waiter_id === waiter.id && styles.waiterDropdownItemSelected,
                ]}
                onPress={() => handleReassignWaiter(waiter.id)}
                disabled={reassigningWaiter}
              >
                <Text
                  style={[
                    styles.waiterDropdownItemText,
                    table.waiter_id === waiter.id && styles.waiterDropdownItemTextSelected,
                  ]}
                >
                  {waiter.name}
                </Text>
                {table.waiter_id === waiter.id && (
                  <Text style={styles.waiterDropdownCheckmark}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Show guest action cards if active guests exist */}
      {activeGuests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Seated Guests</Text>
          <View style={styles.actionButtons}>
            {activeGuests.map((guest) => {
              const orders = guestOrders[guest.id] || [];
              const totalAmount = orders.reduce((sum, order) => sum + (order.price_snapshot * order.quantity), 0);
              
              return (
                <View key={guest.id} style={styles.guestActionGroup}>
                  <View style={styles.guestHeader}>
                    <View style={styles.guestInfo}>
                      <Text style={styles.guestActionName}>{guest.guest_name}</Text>
                      <Text style={styles.seatLabel}>Seat {guest.seat_number}</Text>
                    </View>
                    <StatusBadge status={mapGuestStatusToBadge(guest.status)} label={guest.status} />
                  </View>
                  
                  {/* Display orders if any */}
                  {orders.length > 0 && (
                    <View style={styles.ordersList}>
                      {orders.map((order) => (
                        <View key={order.id} style={styles.orderItem}>
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
                  )}
                  
                  <View style={styles.buttonRow}>
                  <Pressable 
                    style={[styles.smallBtn, styles.smallBtnPrimary]} 
                    onPress={() => onOpenGuestOrder(guest.id)}
                  >
                    <Text style={styles.smallBtnText}>Order</Text>
                  </Pressable>
                  {orders.length > 0 && (
                    <Pressable 
                      style={[styles.smallBtn, styles.smallBtnInfo]} 
                      onPress={() => onEditGuestOrders?.(guest.id, guest.guest_name)}
                    >
                      <Text style={styles.smallBtnText}>Edit</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.smallBtn, styles.smallBtnSecondary]}
                    onPress={async () => {
                      const ns = nextStatus(guest.status);
                      try {
                        await onUpdateGuestStatus(guest.id, ns);
                      } catch (err) {
                        Alert.alert('Update failed');
                      }
                    }}
                  >
                    <Text style={styles.smallBtnSecondaryText}>{nextStatus(guest.status).slice(0, 3).toUpperCase()}</Text>
                  </Pressable>
                  {guest.status === 'pending_payment' && (
                    <Pressable 
                      style={[styles.smallBtn, styles.smallBtnSuccess]} 
                      onPress={() => onTriggerPayment(guest.id)}
                    >
                      <Text style={styles.smallBtnText}>Pay</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
            })}
          </View>
        </View>
      )}

      {/* Show available seats for adding more guests */}
      {emptySeats.length > 0 && (
        <View style={[styles.section, activeGuests.length > 0 && styles.sectionWithDivider]}>
          <Text style={styles.sectionLabel}>Add More Guests</Text>
          {emptySeats.map((seatNumber) => {
            const isAdding = addingSeat === seatNumber;

            if (isAdding) {
              return (
                <View key={seatNumber} style={[styles.seatRow, styles.seatRowAdding]}>
                  <View style={styles.seatNumber}>
                    <Text style={styles.seatNumberText}>{seatNumber}</Text>
                  </View>
                  <TextInput
                    style={styles.guestInput}
                    placeholder="Guest name"
                    placeholderTextColor="#cbd5e1"
                    value={guestName}
                    onChangeText={setGuestName}
                    autoFocus
                  />
                  <View style={styles.addButtonsGroup}>
                    <Pressable 
                      style={[styles.miniBtn, styles.miniBtnCancel]}
                      onPress={() => {
                        setAddingSeat(null);
                        setGuestName('');
                      }}
                    >
                      <Text style={styles.miniBtnCancelText}>✕</Text>
                    </Pressable>
                    <Pressable 
                      style={[styles.miniBtn, styles.miniBtnConfirm]}
                      onPress={handleAddGuest}
                    >
                      <Text style={styles.miniBtnText}>✓</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            return (
              <Pressable 
                key={seatNumber}
                style={[styles.seatRow]}
                onPress={() => setAddingSeat(seatNumber)}
              >
                <View style={styles.seatNumber}>
                  <Text style={styles.seatNumberText}>{seatNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestName}>Empty seat</Text>
                  <Text style={styles.seatLabel}>Seat {seatNumber}</Text>
                </View>
                <Text style={styles.emptyText}>Tap to add</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ModalBox>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionWithDivider: {
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: c.border,
  },
  seatsSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 14,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: c.input,
    borderWidth: 1.5,
    borderColor: c.border,
    gap: 12,
  },
  seatRowOccupied: {
    backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef5f5',
    borderColor: theme.isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
  },
  seatRowAdding: {
    backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
    borderColor: c.success,
  },
  guestInput: {
    flex: 1,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.success,
  },
  addButtonsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnCancel: {
    backgroundColor: c.danger,
  },
  miniBtnCancelText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  miniBtnConfirm: {
    backgroundColor: c.success,
  },
  miniBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  seatNumber: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  seatLabel: {
    fontSize: 12,
    color: c.muted,
    fontWeight: '500',
    marginTop: 2,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  emptyText: {
    color: c.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  guestActions: {
    alignItems: 'flex-end',
  },
  guestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guestInfo: {
    flex: 1,
    marginRight: 8,
  },
  actionsSection: {
    borderTopWidth: 1.5,
    borderTopColor: c.border,
    paddingTop: 20,
  },
  actionButtons: {
    gap: 16,
  },
  guestActionGroup: {
    backgroundColor: c.input,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  guestActionName: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    marginBottom: 10,
  },
  ordersList: {
    marginTop: 12,
    padding: 12,
    backgroundColor: c.input,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 13,
    color: c.subtext,
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  orderTotalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: c.success,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPrimary: {
    backgroundColor: c.primary,
  },
  smallBtnInfo: {
    backgroundColor: '#8b5cf6',
  },
  smallBtnSecondary: {
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: c.border,
  },
  smallBtnSuccess: {
    backgroundColor: c.success,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  smallBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
  },
  // Waiter section styles
  waiterSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: c.border,
  },
  waiterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  waiterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: c.muted,
  },
  waiterChangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: c.border,
  },
  waiterChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
  },
  waiterName: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  noWaiter: {
    fontSize: 14,
    color: c.muted,
    fontStyle: 'italic',
  },
  waiterDropdown: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  waiterDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  waiterDropdownItemSelected: {
    backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
  },
  waiterDropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.subtext,
  },
  waiterDropdownItemTextSelected: {
    color: c.success,
    fontWeight: '700',
  },
  waiterDropdownCheckmark: {
    fontSize: 16,
    color: c.success,
    fontWeight: '700',
  },
});
}
