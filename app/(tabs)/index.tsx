import ModalBox from '@/components/ModalBox';
import Screen from '@/components/Screen';
import TableCard from "@/components/TableCard";
import TableDetail from '@/components/TableDetail';
import { useTables } from "@/hooks/useTables";
import { lipana } from "@/lib/lipana";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function TablesScreen() {
  const { tables, guestsByTable, loading, refetch } = useTables();
  
  // Add table modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newSeatCount, setNewSeatCount] = useState("4");
  const [newTableWaiter, setNewTableWaiter] = useState<string>("");
  const [showTableWaiterDropdown, setShowTableWaiterDropdown] = useState(false);
  
  // Seating modal
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
    phone?: string;
  }>({ open: false });
  const [processingPayment, setProcessingPayment] = useState(false);

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
    if (!newTableWaiter) {
      Alert.alert('Error', 'Please assign a waiter to this table');
      return;
    }

    try {
      await supabase.from('tables').insert({ 
        name: newTableName.trim(), 
        seat_count: seatCount,
        status: 'available',
        waiter_id: newTableWaiter
      });
      setAddModalOpen(false);
      setNewTableName("");
      setNewSeatCount("4");
      setNewTableWaiter("");
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
    // Always allow seating/adding more guests from the seating modal
    // Show table detail to manage existing guests
    setTableDetail({ open: true, tableId });
  }

  async function handleAddTableGuest(seatNumber: number, guestName: string) {
    const tableId = tableDetail.tableId;
    if (!tableId) return;

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const tableWaiterId = table?.waiter_id;
    if (!tableWaiterId) {
      Alert.alert('Error', 'No waiter assigned to this table');
      return;
    }

    try {
      await supabase.from('guests').insert({
        table_id: tableId,
        seat_number: seatNumber,
        guest_name: guestName,
        waiter_id: tableWaiterId,
        status: 'pending',
      });
      
      // Update table status if it's the first guest
      const currentGuests = guestsByTable[tableId] || [];
      if (currentGuests.length === 0) {
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
        
        // Create an order for this table
        await supabase.from('orders').insert({
          table_id: tableId,
          status: 'open',
          total: 0
        });
      }

      refetch();
    } catch (err) {
      console.error('Adding guest failed', err);
      Alert.alert('Error', 'Failed to add guest. Please try again.');
      throw err;
    }
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
    // Navigate directly to order screen with guestId
    // Orders are per-guest, not per-table
    router.push(`/order/${guestId}`);
  }

  // ========== PAYMENT ==========

  async function handleTriggerPayment(guestId: string) {
    const tableId = tableDetail.tableId;
    if (!tableId) return;

    const guest = (guestsByTable[tableId] || []).find(g => g.id === guestId);
    if (!guest) return;

    // Fetch guest's orders and calculate total
    try {
      const { data: orders, error } = await supabase
        .from('guest_orders')
        .select('quantity, price_snapshot')
        .eq('guest_id', guestId);

      if (error) throw error;

      const total = orders?.reduce((sum, order) => {
        return sum + (order.quantity * order.price_snapshot);
      }, 0) || 0;

      setPaymentModal({ 
        open: true, 
        guestId, 
        guestName: guest.guest_name,
        amount: total,
        phone: ''
      });
    } catch (err) {
      console.error('Failed to calculate payment amount:', err);
      Alert.alert('Error', 'Failed to calculate payment amount');
    }
  }

  async function handleConfirmPayment() {
    const { guestId, amount, phone } = paymentModal;
    if (!guestId || !amount || !phone) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    // Validate minimum amount
    if (amount < 10) {
      Alert.alert('Error', 'Minimum payment amount is KES 10');
      return;
    }

    setProcessingPayment(true);

    try {
      // Initiate Lipana STK Push
      const response = await lipana.initiateStkPush({
        phone: phone,
        amount: amount,
        accountReference: `GUEST-${guestId}`,
        transactionDesc: `Payment for ${paymentModal.guestName}`,
      });

      if (response.success) {
        const transactionId = response.data.transactionId;

        // IMPORTANT: Update guest FIRST so webhook can find the guest by transaction_id
        const { error: guestError } = await supabase.from('guests').update({ 
          status: 'pending_payment',
          transaction_id: transactionId 
        }).eq('id', guestId);

        if (guestError) {
          throw guestError;
        }

        // Then record payment intent
        const { error: paymentError } = await supabase.from('payments').upsert({
          guest_id: guestId,
          transaction_id: transactionId,
          amount,
          phone_number: phone,
          status: 'pending',
          checkout_request_id: response.data.checkoutRequestID,
          lipana_response: response,
        }, { onConflict: 'transaction_id' });

        if (paymentError) {
          throw paymentError;
        }

        Alert.alert(
          'Payment Initiated',
          'Please check your phone and enter your M-Pesa PIN to complete payment.',
          [{ text: 'OK' }]
        );
      
        setPaymentModal({ open: false });
      
        // Note: Guest status will be updated to 'paid' via webhook when payment completes
      } else {
        throw new Error(response.message || 'Payment initiation failed');
      }
    } catch (err) {
      console.error('Payment initiation failed:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Payment initiation failed. Please try again.');
    } finally {
      setProcessingPayment(false);
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
        <View style={styles.headerButtons}>
          <Pressable 
            style={styles.reloadBtn} 
            onPress={refetch}
          >
            <Ionicons name="refresh" size={20} color="#0ea5e9" />
          </Pressable>
          <Pressable 
            style={styles.paymentsBtn} 
            onPress={() => router.push('/payments')}
          >
            <Ionicons name="card" size={20} color="#fff" />
            <Text style={styles.paymentsBtnText}>Payments</Text>
          </Pressable>
          <Pressable style={styles.addHeaderBtn} onPress={() => setAddModalOpen(true)}>
            <Text style={styles.addHeaderBtnText}>+ Add Table</Text>
          </Pressable>
        </View>
      </View>

      {/* Tables Grid */}
      {tables.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No tables yet</Text>
          <Text style={styles.emptySubtext}>Tap &quot;Add Table&quot; to get started</Text>
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
            const emptySeats = item.seat_count - occupancy;
            const waiter = waiters.find(w => w.id === item.waiter_id);
            
            return (
              <TableCard
                table={item}
                occupancy={occupancy}
                emptySeats={emptySeats}
                waiterName={waiter?.name}
                onPress={() => handleTablePress(item.id, item.status)}
                onEdit={() => {
                  // TODO: Add edit functionality
                  Alert.alert('Edit', 'Edit table feature coming soon');
                }}
                onRemove={() => handleRemoveTable(item.id, item.name)}
              />
            );
          }}
        />
      )}

      {/* ========== MODALS ========== */}

      {/* Add Table Modal */}
      {addModalOpen && (
        <ModalBox
          title="Add New Table"
          onClose={() => {
            setAddModalOpen(false);
            setNewTableName("");
            setNewSeatCount("4");
            setNewTableWaiter("");
            setShowTableWaiterDropdown(false);
          }}
          onConfirm={handleAddTable}
          confirmLabel="Add Table"
          scrollable={false}
        >
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Assign Waiter</Text>
            {waiters.length === 0 ? (
              <Text style={styles.noWaitersText}>No waiters available</Text>
            ) : (
              <View style={styles.waiterDropdown}>
                <Pressable
                  style={styles.dropdownBtn}
                  onPress={() => setShowTableWaiterDropdown(!showTableWaiterDropdown)}
                >
                  <Text style={styles.dropdownBtnText}>
                    {newTableWaiter 
                      ? waiters.find(w => w.id === newTableWaiter)?.name 
                      : 'Select a waiter'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </Pressable>
                
                {showTableWaiterDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll}>
                      {waiters.map(waiter => (
                        <Pressable
                          key={waiter.id}
                          style={[
                            styles.dropdownItem,
                            newTableWaiter === waiter.id && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            setNewTableWaiter(waiter.id);
                            setShowTableWaiterDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{waiter.name}</Text>
                          {newTableWaiter === waiter.id && (
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
        </ModalBox>
      )}

      {/* Table Detail Modal */}
      {tableDetail.open && tableDetail.tableId && (
        <TableDetail
          table={tables.find(t => t.id === tableDetail.tableId)!}
          guests={guestsByTable[tableDetail.tableId] || []}
          onClose={() => setTableDetail({ open: false, tableId: null })}
          onAddGuest={handleAddTableGuest}
          onUpdateGuestStatus={handleUpdateGuestStatus}
          onOpenGuestOrder={handleOpenGuestOrder}
          onTriggerPayment={handleTriggerPayment}
        />
      )}

      {/* Payment Modal */}
      {paymentModal.open && (
        <ModalBox
          title="Process Payment"
          subtitle={`Guest: ${paymentModal.guestName}`}
          onClose={() => setPaymentModal({ open: false })}
          onConfirm={handleConfirmPayment}
            confirmLabel={processingPayment ? "Processing..." : "Send Payment Request"}
            confirmDisabled={processingPayment}
          scrollable={false}
        >
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentLabel}>Amount Due:</Text>
            <Text style={styles.paymentAmount}>
              KES {paymentModal.amount?.toFixed(2) || '0.00'}
            </Text>
          </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>M-Pesa Phone Number</Text>
              <TextInput
                style={styles.input}
                value={paymentModal.phone}
                onChangeText={(text) => setPaymentModal({ ...paymentModal, phone: text })}
                placeholder="0712345678 or +254712345678"
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!processingPayment}
              />
              <Text style={styles.inputHint}>
                Enter the customer's M-Pesa phone number
              </Text>
            </View>

            <View style={styles.paymentNote}>
              <Ionicons name="information-circle" size={16} color="#6366f1" />
              <Text style={styles.paymentNoteText}>
                Customer will receive an M-Pesa prompt on their phone to complete payment
              </Text>
            </View>
        </ModalBox>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f9ff",
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  reloadBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  addHeaderBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addHeaderBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentsBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  paymentsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    padding: 12,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#111827',
  },
  
  // Seating modal
  seatsContainer: {
    marginBottom: 24,
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
    marginBottom: 14,
    gap: 12,
  },
  seatRowSelected: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  seatCheckbox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatCheckboxSelected: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  seatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  seatNumberSelected: {
    color: '#fff',
  },
  guestNameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#111827',
  },
  seatPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  
  // Waiter dropdown
  waiterDropdown: {
    position: 'relative',
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  dropdownBtnText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  dropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    maxHeight: 220,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 1000,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownCheckmark: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '700',
  },
  noWaitersText: {
    fontSize: 15,
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: 16,
  },
  
  // Payment modal
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  paymentLabel: {
    fontSize: 15,
    color: '#065f46',
    fontWeight: '600',
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981',
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2ff',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#4338ca',
    lineHeight: 18,
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  
  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
