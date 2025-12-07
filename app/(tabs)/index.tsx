import CustomSplash from '@/components/CustomSplash';
import ModalBox from '@/components/ModalBox';
import Screen from '@/components/Screen';
import OrderManagementScreen from '@/components/screens/OrderManagementScreen';
import TableCard from "@/components/TableCard";
import TableDetail from '@/components/TableDetail';
import { dismissToast, showToast, updateToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useTables } from "@/hooks/useTables";
import { lipana } from "@/lib/lipana";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function TablesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { tables, guestsByTable, reservedTables, loading, refetch, refetchAll } = useTables();
  
  // Filter state
  const [showMyTablesOnly, setShowMyTablesOnly] = useState(false);
  
  // Custom splash screen state
  const [showSplash, setShowSplash] = useState(false);
  
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
  
  // Order management modal
  const [orderManagement, setOrderManagement] = useState<{
    open: boolean;
    guestId?: string;
    guestName?: string;
    tableId?: string;
  }>({ open: false });
  
  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ 
    open: boolean; 
    guestId?: string; 
    guestName?: string;
    amount?: number;
    phone?: string;
  }>({ open: false });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentToastId, setPaymentToastId] = useState<string | null>(null);
  const [payingGuestId, setPayingGuestId] = useState<string | null>(null);

  // Remove table modal
  const [removeTableConfirm, setRemoveTableConfirm] = useState<{ open: boolean; tableId: string; tableName: string }>({ open: false, tableId: '', tableName: '' });

  // Edit table modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTableId, setEditTableId] = useState<string>("");
  const [editTableName, setEditTableName] = useState("");
  const [editSeatCount, setEditSeatCount] = useState("4");
  const [editTableWaiter, setEditTableWaiter] = useState<string>("");
  const [showEditWaiterDropdown, setShowEditWaiterDropdown] = useState(false);
  
  // Refresh control state
  const [refreshing, setRefreshing] = useState(false);

  // Filtered tables based on waiter filter
  const filteredTables = useMemo(() => {
    if (!showMyTablesOnly || !user?.id) return tables;
    return tables.filter(table => table.waiter_id === user.id);
  }, [tables, showMyTablesOnly, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setShowSplash(true);
    await refetch();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchWaiters();
  }, []);

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  // Background safety refresh while on screen
  useEffect(() => {
    const id = setInterval(() => {
      refetchAll();
    }, 60000);
    return () => clearInterval(id);
  }, [refetchAll]);

  useEffect(() => {
    if (addModalOpen) {
      setNewTableName(`Table ${tables.length + 1}`);
    }
  }, [addModalOpen, tables.length]);

  // Listen for payment success and update toast
  useEffect(() => {
    if (paymentToastId && payingGuestId) {
      console.log('Setting up payment listener for guest:', payingGuestId);
      
      // First, set up real-time listener
      const channel = supabase
        .channel(`guest-${payingGuestId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'guests',
            filter: `id=eq.${payingGuestId}`,
          },
          (payload) => {
            console.log('Guest update received:', payload.new);
            console.log('Current guest status:', payload.new.status);
            if (payload.new.status === 'paid') {
              console.log('Payment successful detected via realtime!');
              updateToast(paymentToastId, {
                message: 'Payment successful! Thank you.',
                type: 'success',
              });
              // Auto-dismiss after 3 seconds
              setTimeout(() => {
                dismissToast(paymentToastId);
                setPaymentToastId(null);
                setPayingGuestId(null);
              }, 3000);
            }
          }
        )
        .subscribe((status) => {
          console.log('Payment listener subscription status:', status);
        });

      // Also set up a polling fallback that checks every 3 seconds
      const pollInterval = setInterval(async () => {
        console.log('Polling guest status for:', payingGuestId);
        const { data: guest } = await supabase
          .from('guests')
          .select('status')
          .eq('id', payingGuestId)
          .single();

        if (guest?.status === 'paid') {
          console.log('Payment successful detected via polling!');
          updateToast(paymentToastId, {
            message: 'Payment successful! Thank you.',
            type: 'success',
          });
          setTimeout(() => {
            dismissToast(paymentToastId);
            setPaymentToastId(null);
            setPayingGuestId(null);
          }, 3000);
          clearInterval(pollInterval);
        }
      }, 3000);

      return () => {
        console.log('Cleaning up payment listener');
        clearInterval(pollInterval);
        supabase.removeChannel(channel);
      };
    }
  }, [paymentToastId, payingGuestId]);

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
    // Get active guests for this table (already filtered by useTables hook)
    const guests = guestsByTable[id] || [];
    
    if (guests.length > 0) {
      Alert.alert(
        'Cannot Remove',
        `This table has ${guests.length} active guest(s). Please clear all guests before removing the table.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setRemoveTableConfirm({ open: true, tableId: id, tableName });
  }

  function handleEditTable(tableId: string) {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setEditTableId(tableId);
    setEditTableName(table.name);
    setEditSeatCount(table.seat_count.toString());
    setEditTableWaiter(table.waiter_id || "");
    setEditModalOpen(true);
  }

  async function handleUpdateTable() {
    const seatCount = parseInt(editSeatCount);
    if (!editTableName.trim()) {
      Alert.alert('Error', 'Please enter a table name');
      return;
    }
    if (isNaN(seatCount) || seatCount < 1 || seatCount > 20) {
      Alert.alert('Error', 'Seat count must be between 1 and 20');
      return;
    }
    if (!editTableWaiter) {
      Alert.alert('Error', 'Please assign a waiter to this table');
      return;
    }

    try {
      const { error } = await supabase
        .from('tables')
        .update({ 
          name: editTableName.trim(), 
          seat_count: seatCount,
          waiter_id: editTableWaiter
        })
        .eq('id', editTableId);

      if (error) throw error;

      setEditModalOpen(false);
      setEditTableId("");
      setEditTableName("");
      setEditSeatCount("4");
      setEditTableWaiter("");
      refetch();
      showToast('Table updated successfully', 'success', 3000, 'card');
    } catch (err) {
      console.error('Update table failed', err);
      showToast('Failed to update table', 'error', 3000, 'card');
    }
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

        const toastId = showToast('Please check your phone and enter your M-Pesa PIN to complete payment.', 'info', 0, 'card', true);
        setPaymentToastId(toastId);
        setPayingGuestId(guestId);
      
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
        <View style={styles.headerButtons}>
          <Pressable 
            style={[styles.filterBtn, showMyTablesOnly && styles.filterBtnActive]}
            onPress={() => setShowMyTablesOnly(!showMyTablesOnly)}
          >
            <Ionicons name={showMyTablesOnly ? "funnel" : "funnel-outline"} size={18} color="#fff" />
            <Text style={styles.filterBtnText}>
              {showMyTablesOnly ? 'My Tables' : 'All Tables'}
            </Text>
          </Pressable>
          <Pressable 
            style={styles.reservationsBtn} 
            onPress={() => router.push('/(tabs)/reservations')}
          >
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.reservationsBtnText}>Reservations</Text>
          </Pressable>
          <Pressable 
            style={styles.paymentsBtn} 
            onPress={() => router.push('/payments')}
          >
            <Ionicons name="card" size={18} color="#fff" />
            <Text style={styles.paymentsBtnText}>Payments</Text>
          </Pressable>
        </View>
      </View>

      {/* Tables Grid */}
      {filteredTables.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>
            {showMyTablesOnly ? 'No tables assigned to you' : 'No tables yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {showMyTablesOnly ? 'Your assigned tables will appear here' : 'Tap "Add Table" to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...filteredTables, { id: 'add-table' } as any]}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item }) => {
            // Handle add table card
            if (item.id === 'add-table') {
              return (
                <Pressable
                  style={[styles.tableCard, styles.addTableCard]}
                  onPress={() => setAddModalOpen(true)}
                  android_ripple={{ color: theme.colors.ripple }}
                >
                  <View style={styles.addTableContent}>
                    <Ionicons name="add-circle" size={48} color={theme.colors.primary} />
                    <Text style={styles.addTableText}>Add Table</Text>
                  </View>
                </Pressable>
              );
            }

            const occupancy = (guestsByTable[item.id] || []).length;
            const emptySeats = item.seat_count - occupancy;
            const waiter = waiters.find(w => w.id === item.waiter_id);
            const isReserved = reservedTables.has(item.id);
            
            return (
              <TableCard
                table={item}
                occupancy={occupancy}
                emptySeats={emptySeats}
                seatCount={item.seat_count}
                waiterName={waiter?.name}
                isReserved={isReserved}
                onPress={() => handleTablePress(item.id, item.status)}
                onEdit={() => {
                  handleEditTable(item.id);
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
                      {waiters
                        .filter(waiter => !waiter.id || !tables.some(t => t.waiter_id === waiter.id))
                        .map(waiter => (
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

      {/* Edit Table Modal */}
      {editModalOpen && (
        <ModalBox
          title="Edit Table"
          subtitle="Update table information"
          onClose={() => {
            setEditModalOpen(false);
            setEditTableId("");
            setEditTableName("");
            setEditSeatCount("4");
            setEditTableWaiter("");
            setShowEditWaiterDropdown(false);
          }}
          onConfirm={handleUpdateTable}
          confirmLabel="Update Table"
          scrollable={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Table Name</Text>
            <TextInput
              style={styles.input}
              value={editTableName}
              onChangeText={setEditTableName}
              placeholder="e.g., Table 1, VIP Table"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Seats</Text>
            <TextInput
              style={styles.input}
              value={editSeatCount}
              onChangeText={setEditSeatCount}
              keyboardType="number-pad"
              placeholder="4"
            />
            <Text style={styles.inputHint}>
              Note: Changing seat count may affect current seating arrangements
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Assign Waiter</Text>
            {waiters.length === 0 ? (
              <Text style={styles.noWaitersText}>No waiters available</Text>
            ) : (
              <View style={styles.waiterDropdown}>
                <Pressable
                  style={styles.dropdownBtn}
                  onPress={() => setShowEditWaiterDropdown(!showEditWaiterDropdown)}
                >
                  <Text style={styles.dropdownBtnText}>
                    {editTableWaiter 
                      ? waiters.find(w => w.id === editTableWaiter)?.name 
                      : 'Select a waiter'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </Pressable>
                
                {showEditWaiterDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScroll}>
                      {waiters.map(waiter => (
                        <Pressable
                          key={waiter.id}
                          style={[
                            styles.dropdownItem,
                            editTableWaiter === waiter.id && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            setEditTableWaiter(waiter.id);
                            setShowEditWaiterDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{waiter.name}</Text>
                          {editTableWaiter === waiter.id && (
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
          onEditGuestOrders={(guestId, guestName) => {
            setOrderManagement({
              open: true,
              guestId,
              guestName,
              tableId: tableDetail.tableId || undefined,
            });
          }}
        />
      )}

      {/* Order Management Modal */}
      {orderManagement.open && orderManagement.guestId && (
        <Modal visible={true} animationType="slide">
          <OrderManagementScreen
            guestId={orderManagement.guestId}
            guestName={orderManagement.guestName || 'Guest'}
            tableId={orderManagement.tableId || ''}
            onClose={() => setOrderManagement({ open: false })}
            onOrdersUpdated={refetch}
          />
        </Modal>
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
              <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
              <Text style={styles.paymentNoteText}>
                Customer will receive an M-Pesa prompt on their phone to complete payment
              </Text>
            </View>
        </ModalBox>
      )}

      {/* Remove Table Modal */}
      {removeTableConfirm.open && (
        <ModalBox
          title="Remove Table"
          subtitle="This action cannot be undone"
          onClose={() => setRemoveTableConfirm({ open: false, tableId: '', tableName: '' })}
          onConfirm={async () => {
            try {
              await supabase.from('tables').delete().eq('id', removeTableConfirm.tableId);
              setRemoveTableConfirm({ open: false, tableId: '', tableName: '' });
              refetch();
              showToast(`${removeTableConfirm.tableName} has been removed.`, 'success', 3500, 'card');
            } catch (err) {
              console.error('Remove failed', err);
              showToast('Failed to remove table. Please try again.', 'error', 3500, 'card');
            }
          }}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          scrollable={false}
        >
          <View style={styles.modalRow}>
            <View style={styles.modalIconDanger}>
              <Ionicons name="trash" size={22} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Remove {removeTableConfirm.tableName}?</Text>
              <Text style={styles.modalSubtitle}>
                This table will be permanently deleted from the system. Make sure there are no active guests.
              </Text>
            </View>
          </View>
          <View style={styles.modalBulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.modalBulletText}>All table data will be deleted</Text>
          </View>
          <View style={styles.modalBulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.modalBulletText}>This action cannot be reversed</Text>
          </View>
        </ModalBox>
      )}

      {/* Custom Splash Screen */}
      <CustomSplash 
        visible={showSplash} 
        onFinish={() => setShowSplash(false)} 
      />
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
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 16,
      color: c.muted,
    },
    emptyText: {
      fontSize: 24,
      fontWeight: '700',
      color: c.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 16,
      color: c.muted,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 36,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    addHeaderBtn: {
      backgroundColor: c.success,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: 12,
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    addHeaderBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    reservationsBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      flex: 1,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    reservationsBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    paymentsBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      flex: 1,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    paymentsBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    filterBtn: {
      backgroundColor: c.muted,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      flex: 1,
      shadowColor: c.muted,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    filterBtnActive: {
      backgroundColor: c.primary,
      shadowColor: c.primary,
    },
    filterBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    grid: {
      padding: 12,
      paddingBottom: 24,
    },
    row: {
      gap: 12,
      marginBottom: 12,
    },
    tableCard: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addTableCard: {
      backgroundColor: c.card,
      borderStyle: 'dashed',
      borderWidth: 2,
      borderColor: c.primary,
    },
    addTableContent: {
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    addTableText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.primary,
      letterSpacing: 0.3,
    },
    
    // Modal styles
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
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
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 28,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.3 : 0.15,
      shadowRadius: 12,
    },

    modalTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      marginBottom: 8,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: 15,
      color: c.subtext,
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
      color: c.text,
      marginBottom: 10,
    },
    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      backgroundColor: c.input,
      color: c.text,
    },
    
    // Seating modal
    seatsContainer: {
      marginBottom: 24,
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
      marginBottom: 14,
      gap: 12,
    },
    seatRowSelected: {
      backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.15)' : '#f0fdf4',
      borderWidth: 2,
      borderColor: c.success,
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
      borderColor: c.border,
      backgroundColor: c.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seatCheckboxSelected: {
      backgroundColor: c.success,
      borderColor: c.success,
    },
    seatNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: c.subtext,
    },
    seatNumberSelected: {
      color: '#fff',
    },
    guestNameInput: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      backgroundColor: c.input,
      color: c.text,
    },
    seatPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: c.muted,
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
      borderColor: c.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: c.input,
    },
    dropdownBtnText: {
      fontSize: 16,
      color: c.text,
      fontWeight: '500',
    },
    dropdownArrow: {
      fontSize: 13,
      color: c.muted,
      fontWeight: '600',
    },
    dropdownList: {
      position: 'absolute',
      top: 56,
      left: 0,
      right: 0,
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      maxHeight: 220,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isDark ? 0.3 : 0.12,
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
      borderBottomColor: c.border,
    },
    dropdownItemSelected: {
      backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.15)' : '#f0fdf4',
    },
    dropdownItemText: {
      fontSize: 16,
      color: c.text,
      fontWeight: '500',
    },
    dropdownCheckmark: {
      fontSize: 18,
      color: c.success,
      fontWeight: '700',
    },
    noWaitersText: {
      fontSize: 15,
      color: c.muted,
      fontStyle: 'italic',
      padding: 16,
    },
    
    // Modal body styles
    modalBody: {
      gap: 14,
    },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    modalIconDanger: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulletDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: '#ef4444',
    },
    modalBulletText: {
      fontSize: 14,
      color: c.text,
      flex: 1,
      lineHeight: 20,
    },
    
    // Payment modal
    paymentInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(16, 185, 129, 0.08)',
      padding: 18,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(16, 185, 129, 0.2)',
    },
    paymentLabel: {
      fontSize: 15,
      color: c.success,
      fontWeight: '600',
    },
    paymentAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: c.success,
    },
    paymentNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)',
      padding: 14,
      borderRadius: 10,
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(37, 99, 235, 0.2)',
    },
    paymentNoteText: {
      flex: 1,
      fontSize: 13,
      color: c.primary,
      lineHeight: 18,
      fontWeight: '500',
    },
    inputHint: {
      fontSize: 12,
      color: c.muted,
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
      backgroundColor: c.input,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cancelBtnText: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    confirmBtn: {
      backgroundColor: c.success,
      shadowColor: c.success,
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
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  addHeaderBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  addHeaderBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reservationsBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flex: 1,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  reservationsBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  paymentsBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    flex: 1,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  paymentsBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  grid: {
    padding: 12,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  tableCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTableCard: {
    backgroundColor: '#fff',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#0ea5e9',
  },
  addTableContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  addTableText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0ea5e9',
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  paymentLabel: {
    fontSize: 15,
    color: '#10b981',
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
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#2563eb',
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
