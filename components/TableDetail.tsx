import { mapGuestStatusToBadge } from '@/lib/statusMap';
import { Guest, GuestStatus, Table } from '@/lib/types';
import { useState } from 'react';
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
}

const STATUS_ORDER: GuestStatus[] = ['pending', 'ordered', 'served', 'cleared', 'pending_payment', 'paid'];

export default function TableDetail({ table, guests, onClose, onAddGuest, onUpdateGuestStatus, onOpenGuestOrder, onTriggerPayment }: Props) {
  const [addingSeat, setAddingSeat] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');

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

  // When guests exist, show guest action cards; otherwise show seat list for adding
  const hasGuests = guests.length > 0;
  
  // Only count guests who haven't paid (paid guests have left)
  const activeGuests = guests.filter(g => g.status !== 'paid');
  
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
      {/* Show guest action cards if active guests exist */}
      {activeGuests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Seated Guests</Text>
          <View style={styles.actionButtons}>
            {activeGuests.map((guest) => (
              <View key={guest.id} style={styles.guestActionGroup}>
                <View style={styles.guestHeader}>
                  <View style={styles.guestInfo}>
                    <Text style={styles.guestActionName}>{guest.guest_name}</Text>
                    <Text style={styles.seatLabel}>Seat {guest.seat_number}</Text>
                  </View>
                  <StatusBadge status={mapGuestStatusToBadge(guest.status)} label={guest.status} />
                </View>
                <View style={styles.buttonRow}>
                  <Pressable 
                    style={[styles.smallBtn, styles.smallBtnPrimary]} 
                    onPress={() => onOpenGuestOrder(guest.id)}
                  >
                    <Text style={styles.smallBtnText}>Order</Text>
                  </Pressable>
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
            ))}
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

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionWithDivider: {
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#e2e8f0',
  },
  seatsSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 14,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  seatRowOccupied: {
    backgroundColor: '#fef5f5',
    borderColor: '#fecaca',
  },
  seatRowAdding: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  guestInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#10b981',
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
    backgroundColor: '#fee2e2',
  },
  miniBtnCancelText: {
    color: '#991b1b',
    fontSize: 18,
    fontWeight: '700',
  },
  miniBtnConfirm: {
    backgroundColor: '#10b981',
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
    backgroundColor: '#0ea5e9',
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
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    color: '#94a3b8',
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
    borderTopColor: '#e2e8f0',
    paddingTop: 20,
  },
  actionButtons: {
    gap: 16,
  },
  guestActionGroup: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  guestActionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
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
    backgroundColor: '#0ea5e9',
  },
  smallBtnSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  smallBtnSuccess: {
    backgroundColor: '#10b981',
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  smallBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
