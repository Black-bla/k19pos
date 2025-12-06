# Upgraded Tables Screen

Replace your entire `index.tsx` with this cleaner, enhanced version:

```typescript
import Screen from '@/components/Screen';
import TableCard from "@/components/TableCard";
import TableDetail from '@/components/TableDetail';
import { useTables } from "@/hooks/useTables";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from "react-native";

export default function TablesScreen() {
  const { tables, guestsByTable, loading, refetch } = useTables();
  
  // Add table modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newSeatCount, setNewSeatCount] = useState("4");
  
  // Seating modal
  const [seatingModal, setSeatingModal] = useState<{ open: boolean; tableId: string | null }>({ open: false, tableId: null });
  const [selectedSeatsMap, setSelectedSeatsMap] = useState<Record<number, string>>({});
  
  // Waiters
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<string>("");
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);
  
  // Table detail modal
  const [tableDetail, setTableDetail] = useState<{ open: boolean; tableId: string | null }>({ open: false, tableId: null });
  
  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ 
    open: boolean; 
    guestId?: string; 
    guestName?: string;
    amount?: number;
  }>({ open: false });

  useEffect(() => {
    fetchWaiters();
  }, []);

  useEffect(() => {
    if (addModalOpen) {
      setNewTableName(`Table ${tables.length + 1}`);
    }
  }, [addModalOpen, tables.length]);

  async function fetchWaiters() {
    const { data } = await supabase
      .from('staff_profiles')
      .select('id, name')
      .order('name');
    if (data) setWaiters(data);
  }

  // ========== TABLE MANAGEMENT ==========
  
  async function handleAddTable() {
    const seatCount = parseInt(newSeatCount);
    if (!newTableName.trim()) {
      Alert.alert('Error', 'Please enter a table name');
      return;
    }
    if (isNaN(seatCount) || seatCount < 1 || seatCount > 20) {
      Alert.alert('Error', 'Seat count must be between 1 and 20');
      return;
    }

    try {
      await supabase.from('tables').insert({ 
        name: newTableName.trim(), 
        seat_count: seatCount,
        status: 'available'
      });
      setAddModalOpen(false);
      setNewTableName("");
      setNewSeatCount("4");
      refetch();
    } catch (err) {
      console.error('Add table failed', err);
      Alert.alert('Error', 'Failed to add table');
    }
  }

  function handleRemoveTable(id: string, tableName: string) {
    Alert.alert(
      'Remove Table', 
      `Are you sure you want to remove ${tableName}?`, 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Check if table has active guests
              const guests = guestsByTable[id] || [];
              const activeGuests = guests.filter(g => g.status !== 'paid');
              
              if (activeGuests.length > 0) {
                Alert.alert('Cannot Remove', 'This table has active guests. Please clear all guests first.');
                return;
              }
              
              await supabase.from('tables').delete().eq('id', id);
              refetch();
            } catch (err) {
              console.error('Remove failed', err);
              Alert.alert('Error', 'Failed to remove table');
            }
          }
        }
      ]
    );
  }

  // ========== SEATING MANAGEMENT ==========

  async function handleTablePress(tableId: string, status: string) {
    if (status === "available") {
      setSeatingModal({ open: true, tableId });
      setSelectedSeatsMap({});
      setSelectedWaiter('');
      setShowWaiterDropdown(false);
    } else {
      setTableDetail({ open: true, tableId });
    }
  }

  async function handleSeatGuests() {
    const tableId = seatingModal.tableId;
    if (!tableId) return;

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const seatNumbers = Object.keys(selectedSeatsMap)
      .map(k => Number(k))
      .filter(n => selectedSeatsMap[n]?.trim())
      .sort((a, b) => a - b);

    // Validations
    if (seatNumbers.length === 0) {
      Alert.alert('No Guests', 'Please select at least one seat and enter guest name');
      return;
    }

    if (!selectedWaiter) {
      Alert.alert('Select Waiter', 'Please assign a waiter for this table');
      return;
    }

    // Check for empty names
    for (const seatNum of seatNumbers) {
      if (!selectedSeatsMap[seatNum]?.trim()) {
        Alert.alert('Missing Name', `Please enter a name for Seat ${seatNum}`);
        return;
      }
    }

    try {
      // Create guest records
      const guestInserts = seatNumbers.map(seatNum => ({
        table_id: tableId,
        seat_number: seatNum,
        guest_name: selectedSeatsMap[seatNum].trim(),
        waiter_id: selectedWaiter,
        status: 'pending',
      }));

      await supabase.from('guests').insert(guestInserts);
      
      // Update table status
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
      
      // Create an order for this table
      await supabase.from('orders').insert({
        table_id: tableId,
        status: 'open',
        total: 0
      });

      setSeatingModal({ open: false, tableId: null });
      setSelectedSeatsMap({});
      setSelectedWaiter('');
      refetch();
    } catch (err) {
      console.error('Seating failed', err);
      Alert.alert('Error', 'Failed to seat guests. Please try again.');
    }
  }

  function toggleSeatSelection(seatNum: number) {
    setSelectedSeatsMap(prev => {
      const next = { ...prev };
      if (next[seatNum] !== undefined) {
        delete next[seatNum];
      } else {
        next[seatNum] = '';
      }
      return next;
    });
  }

  // ========== GUEST MANAGEMENT ==========

  async function handleUpdateGuestStatus(guestId: string, newStatus: string) {
    try {
      await supabase.from('guests').update({ status: newStatus }).eq('id', guestId);
      
      // Check if all guests at table are paid
      const tableId = tableDetail.tableId;
      if (tableId && newStatus === 'paid') {
        const allGuests = guestsByTable[tableId] || [];
        const { data: updatedGuests } = await supabase
          .from('guests')
          .select('status')
          .eq('table_id', tableId);
        
        if (updatedGuests && updatedGuests.every(g => g.status === 'paid')) {
          // All paid, mark table as available
          await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
          setTableDetail({ open: false, tableId: null });
        }
      }
      
      refetch();
    } catch (err) {
      console.error('Update guest status failed', err);
      Alert.alert('Error', 'Failed to update guest status');
    }
  }

  async function handleOpenGuestOrder(guestId: string) {
    try {
      const { data: guest } = await supabase
        .from('guests')
        .select('table_id')
        .eq('id', guestId)
        .single();
      
      if (!guest) {
        Alert.alert('Error', 'Guest not found');
        return;
      }

      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', guest.table_id)
        .eq('status', 'open')
        .single();

      if (order) {
        router.push(`/order/${order.id}?guestId=${guestId}`);
      } else {
        Alert.alert('No Order', 'No active order found for this table');
      }
    } catch (err) {
      console.error('Open guest order failed', err);
      Alert.alert('Error', 'Failed to open order');
    }
  }

  // ========== PAYMENT ==========

  function handleTriggerPayment(guestId: string) {
    const tableId = tableDetail.tableId;
    if (!tableId) return;

    const guest = (guestsByTable[tableId] || []).find(g => g.id === guestId);
    if (!guest) return;

    // Calculate guest's order total (you'll need to implement this based on your order items)
    setPaymentModal({ 
      open: true, 
      guestId, 
      guestName: guest.guest_name,
      amount: 0 // TODO: Calculate from guest_orders
    });
  }

  async function handleConfirmPayment() {
    const { guestId } = paymentModal;
    if (!guestId) return;

    try {
      // TODO: Implement actual M-Pesa STK Push here
      // For now, just mark as paid
      await supabase.from('guests').update({ status: 'paid' }).eq('id', guestId);
      
      setPaymentModal({ open: false });
      
      // Check if all guests are paid
      const tableId = tableDetail.tableId;
      if (tableId) {
        const { data: allGuests } = await supabase
          .from('guests')
          .select('status')
          .eq('table_id', tableId);
        
        if (allGuests && allGuests.every(g => g.status === 'paid')) {
          await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
          setTableDetail({ open: false, tableId: null });
          Alert.alert('Success', 'All guests paid. Table is now available.');
        }
      }
      
      refetch();
    } catch (err) {
      console.error('Payment failed', err);
      Alert.alert('Error', 'Payment failed. Please try again.');
    }
  }

  // ========== RENDER ==========

  if (loading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading tables...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tables</Text>
        <Pressable style={styles.addHeaderBtn} onPress={() => setAddModalOpen(true)}>
          <Text style={styles.addHeaderBtnText}>+ Add Table</Text>
        </Pressable>
      </View>

      {/* Tables Grid */}
      {tables.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No tables yet</Text>
          <Text style={styles.emptySubtext}>Tap "Add Table" to get started</Text>
        </View>
      ) : (
        <FlatList
          data={tables}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const occupancy = (guestsByTable[item.id] || []).length;
            return (
              <View style={styles.cardWrapper}>
                <TableCard
                  table={item}
                  occupancy={occupancy}
                  onPress={() => handleTablePress(item.id, item.status)}
                />
                <Pressable 
                  style={styles.removeBtn} 
                  onPress={() => handleRemoveTable(item.id, item.name)}
                >
                  <Text style={styles.removeBtnText}>✕ Remove</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {/* ========== MODALS ========== */}

      {/* Add Table Modal */}
      {addModalOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add New Table</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Table Name</Text>
              <TextInput
                style={styles.input}
                value={newTableName}
                onChangeText={setNewTableName}
                placeholder="e.g., Table 1, VIP Table"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Seats</Text>
              <TextInput
                style={styles.input}
                value={newSeatCount}
                onChangeText={setNewSeatCount}
                keyboardType="number-pad"
                placeholder="4"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => {
                  setAddModalOpen(false);
                  setNewTableName("");
                  setNewSeatCount("4");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleAddTable}
              >
                <Text style={styles.confirmBtnText}>Add Table</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Seating Modal */}
      {seatingModal.open && seatingModal.tableId && (() => {
        const table = tables.find(t => t.id === seatingModal.tableId);
        if (!table) return null;

        return (
          <View style={styles.modalOverlay}>
            <ScrollView 
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.modalBox, styles.seatingModalBox]}>
                <Text style={styles.modalTitle}>Seat Guests at {table.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {table.seat_count} seats available
                </Text>

                {/* Seat Selection */}
                <View style={styles.seatsContainer}>
                  <Text style={styles.sectionLabel}>Select Seats & Enter Names</Text>
                  {Array.from({ length: table.seat_count }, (_, i) => i + 1).map(seatNum => {
                    const isSelected = selectedSeatsMap[seatNum] !== undefined;
                    return (
                      <View key={seatNum} style={styles.seatRow}>
                        <Pressable
                          style={[styles.seatCheckbox, isSelected && styles.seatCheckboxSelected]}
                          onPress={() => toggleSeatSelection(seatNum)}
                        >
                          <Text style={[styles.seatNumber, isSelected && styles.seatNumberSelected]}>
                            {isSelected ? '✓' : seatNum}
                          </Text>
                        </Pressable>
                        
                        {isSelected && (
                          <TextInput
                            style={styles.guestNameInput}
                            placeholder={`Guest name for Seat ${seatNum}`}
                            value={selectedSeatsMap[seatNum]}
                            onChangeText={(v) => 
                              setSelectedSeatsMap(prev => ({ ...prev, [seatNum]: v }))
                            }
                          />
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Waiter Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.sectionLabel}>Assign Waiter</Text>
                  {waiters.length === 0 ? (
                    <Text style={styles.noWaitersText}>No waiters available</Text>
                  ) : (
                    <View style={styles.waiterDropdown}>
                      <Pressable
                        style={styles.dropdownBtn}
                        onPress={() => setShowWaiterDropdown(!showWaiterDropdown)}
                      >
                        <Text style={styles.dropdownBtnText}>
                          {selectedWaiter 
                            ? waiters.find(w => w.id === selectedWaiter)?.name 
                            : 'Select a waiter'}
                        </Text>
                        <Text style={styles.dropdownArrow}>▼</Text>
                      </Pressable>
                      
                      {showWaiterDropdown && (
                        <View style={styles.dropdownList}>
                          <ScrollView style={styles.dropdownScroll}>
                            {waiters.map(waiter => (
                              <Pressable
                                key={waiter.id}
                                style={[
                                  styles.dropdownItem,
                                  selectedWaiter === waiter.id && styles.dropdownItemSelected
                                ]}
                                onPress={() => {
                                  setSelectedWaiter(waiter.id);
                                  setShowWaiterDropdown(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{waiter.name}</Text>
                                {selectedWaiter === waiter.id && (
                                  <Text style={styles.dropdownCheckmark}>✓</Text>
                                )}
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <Pressable 
                    style={[styles.modalBtn, styles.cancelBtn]} 
                    onPress={() => {
                      setSeatingModal({ open: false, tableId: null });
                      setSelectedSeatsMap({});
                      setSelectedWaiter('');
                      setShowWaiterDropdown(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.modalBtn, styles.confirmBtn]} 
                    onPress={handleSeatGuests}
                  >
                    <Text style={styles.confirmBtnText}>Seat Guests</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        );
      })()}

      {/* Table Detail Modal */}
      {tableDetail.open && tableDetail.tableId && (
        <TableDetail
          table={tables.find(t => t.id === tableDetail.tableId)!}
          guests={guestsByTable[tableDetail.tableId] || []}
          onClose={() => setTableDetail({ open: false, tableId: null })}
          onUpdateGuestStatus={handleUpdateGuestStatus}
          onOpenGuestOrder={handleOpenGuestOrder}
          onTriggerPayment={handleTriggerPayment}
        />
      )}

      {/* Payment Modal */}
      {paymentModal.open && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Process Payment</Text>
            <Text style={styles.modalSubtitle}>
              Guest: {paymentModal.guestName}
            </Text>
            
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentLabel}>Amount Due:</Text>
              <Text style={styles.paymentAmount}>
                KES {paymentModal.amount?.toFixed(2) || '0.00'}
              </Text>
            </View>

            <Text style={styles.paymentNote}>
              M-Pesa STK Push will be implemented here
            </Text>

            <View style={styles.modalActions}>
              <Pressable 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setPaymentModal({ open: false })}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleConfirmPayment}
              >
                <Text style={styles.confirmBtnText}>Mark as Paid</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  addHeaderBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addHeaderBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    padding: 16,
  },
  row: {
    gap: 16,
  },
  cardWrapper: {
    flex: 1,
  },
  removeBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  seatingModalBox: {
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  
  // Seating modal
  seatsContainer: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  seatCheckbox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatCheckboxSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  seatNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  seatNumberSelected: {
    color: '#fff',
  },
  guestNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  
  // Waiter dropdown
  waiterDropdown: {
    position: 'relative',
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dropdownBtnText: {
    fontSize: 16,
    color: '#111827',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  dropdownList: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    maxHeight: 200,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    zIndex: 1000,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#111827',
  },
  dropdownCheckmark: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  noWaitersText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  
  // Payment modal
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  paymentNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  
  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#10b981',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## **Key Improvements:**

1. **Cleaner Structure**: Better organized into logical sections
2. **Better Validation**: Proper input validation with user-friendly error messages
3. **Improved UX**: 
   - Header with inline "Add Table" button
   - Better modal designs with clear hierarchy
   - Scrollable seating modal for tables with many seats
   - Empty state when no tables exist
4. **Enhanced Seating Flow**:
   - Visual seat checkboxes
   - Inline name entry per seat
   - Better waiter dropdown with checkmarks
5. **Safety Checks**: Can't remove tables with active guests
6. **Auto Order Creation**: Creates order when guests are seated
7. **Proper Status Management**: Auto-updates table to available when all guests paid

**Next: Tell me which screen to implement next (Menu, Order, or TableDetail component)?**