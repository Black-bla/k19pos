import Screen from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Payment {
  id: string;
  guest_id: string;
  transaction_id: string;
  amount: number;
  phone_number: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  guest?: {
    guest_name: string;
    table_id: string;
    waiter_id?: string;
    staff_profiles?: {
      name: string;
    };
  };
}

export default function PaymentsListScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    try {
      setLoading(true);
      // Fetch payments from today
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          guest_id,
          transaction_id,
          amount,
          phone_number,
          status,
          created_at,
          guests:guest_id (
            guest_name,
            table_id,
            waiter_id
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch waiter information separately
      const paymentsWithWaiters = await Promise.all(
        (data || []).map(async (payment: any) => {
          const guestData = Array.isArray(payment.guests) ? payment.guests[0] : payment.guests;
          
          if (guestData?.waiter_id) {
            const { data: waiterData } = await supabase
              .from('staff_profiles')
              .select('name')
              .eq('id', guestData.waiter_id)
              .single();
            
            return {
              ...payment,
              guest: {
                ...guestData,
                staff_profiles: waiterData,
              },
            };
          }
          
          return {
            ...payment,
            guest: guestData,
          };
        })
      );
      
      setPayments(paymentsWithWaiters);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      case 'pending':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function getWaiters() {
    const waiters = new Map<string, string>();
    payments.forEach(payment => {
      const waiterId = payment.guest?.waiter_id;
      const waiterName = payment.guest?.staff_profiles?.name;
      if (waiterId && waiterName && !waiters.has(waiterId)) {
        waiters.set(waiterId, waiterName);
      }
    });
    return Array.from(waiters.entries()).map(([id, name]) => ({ id, name }));
  }

  function getWaiterTotals() {
    const totals = new Map<string, { name: string; amount: number }>();
    payments
      .filter(p => p.status === 'success')
      .forEach(payment => {
        const waiterId = payment.guest?.waiter_id;
        const waiterName = payment.guest?.staff_profiles?.name || 'Unknown';
        if (waiterId) {
          const current = totals.get(waiterId) || { name: waiterName, amount: 0 };
          totals.set(waiterId, { name: waiterName, amount: current.amount + payment.amount });
        }
      });
    return Array.from(totals.entries()).map(([id, data]) => ({ id, ...data }));
  }

  function getFilteredPayments() {
    if (!selectedWaiter) return payments;
    return payments.filter(p => p.guest?.waiter_id === selectedWaiter);
  }

  function renderPaymentItem({ item }: { item: Payment }) {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const guestName = item.guest?.guest_name || 'Unknown Guest';

    return (
      <View style={styles.paymentCard}>
        <View style={styles.paymentHeader}>
          <View style={styles.guestInfo}>
            <Text style={styles.guestName}>{guestName}</Text>
            <Text style={styles.transactionId}>{item.transaction_id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Ionicons name={statusIcon} size={16} color="#fff" />
          </View>
        </View>

        <View style={styles.paymentDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Amount:</Text>
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Waiter:</Text>
            <Text style={styles.phone}>{item.guest?.staff_profiles?.name || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.phone}>{item.phone_number}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Time:</Text>
            <Text style={styles.time}>{formatTime(item.created_at)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.status, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Header with Filter */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Today's Payments</Text>
            <Text style={styles.headerSubtitle}>{new Date().toDateString()}</Text>
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="funnel" size={20} color="#0ea5e9" />
            {selectedWaiter && <View style={styles.filterBadge} />}
          </TouchableOpacity>
        </View>
        {selectedWaiter && (
          <TouchableOpacity
            style={styles.activeFilterTag}
            onPress={() => setSelectedWaiter(null)}
          >
            <Text style={styles.activeFilterText}>
              {payments.find(p => p.guest?.waiter_id === selectedWaiter)?.guest?.staff_profiles?.name || 'Waiter'} ✕
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Waiter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TouchableOpacity
                style={[
                  styles.waiterOption,
                  !selectedWaiter && styles.waiterOptionActive,
                ]}
                onPress={() => {
                  setSelectedWaiter(null);
                  setShowFilterModal(false);
                }}
              >
                <Text style={[styles.waiterOptionText, !selectedWaiter && styles.waiterOptionTextActive]}>
                  All Waiters
                </Text>
              </TouchableOpacity>

              {getWaiterTotals()
                .sort((a, b) => b.amount - a.amount)
                .map((waiter) => (
                  <TouchableOpacity
                    key={waiter.id}
                    style={[
                      styles.waiterOption,
                      selectedWaiter === waiter.id && styles.waiterOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedWaiter(waiter.id);
                      setShowFilterModal(false);
                    }}
                  >
                    <View style={styles.waiterInfo}>
                      <Text style={[styles.waiterOptionText, selectedWaiter === waiter.id && styles.waiterOptionTextActive]}>
                        {waiter.name}
                      </Text>
                      <Text style={[styles.waiterAmount, selectedWaiter === waiter.id && styles.waiterAmountActive]}>
                        {formatCurrency(waiter.amount)}
                      </Text>
                    </View>
                    {selectedWaiter === waiter.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#0ea5e9" />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Payments</Text>
            <Text style={styles.summaryValue}>{getFilteredPayments().length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Successful</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
              {getFilteredPayments().filter(p => p.status === 'success').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {getFilteredPayments().filter(p => p.status === 'pending').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={[styles.summaryValue, { color: '#0ea5e9' }]}>
              {formatCurrency(getFilteredPayments().filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0))}
            </Text>
          </View>
        </View>
      )}

      {/* Payments List */}
      {payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No payments today</Text>
          <Text style={styles.emptySubtext}>Payments will appear here as guests pay</Text>
        </View>
      ) : getFilteredPayments().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="filter" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No payments for this waiter</Text>
          <Text style={styles.emptySubtext}>Try selecting a different waiter</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredPayments()}
          keyExtractor={(item) => item.id}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
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
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  phone: {
    fontSize: 13,
    color: '#475569',
    fontFamily: 'monospace',
  },
  time: {
    fontSize: 13,
    color: '#64748b',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  activeFilterTag: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  activeFilterText: {
    fontSize: 12,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    padding: 12,
  },
  waiterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  waiterOptionActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0ea5e9',
  },
  waiterInfo: {
    flex: 1,
  },
  waiterOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  waiterOptionTextActive: {
    color: '#0ea5e9',
  },
  waiterAmount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  waiterAmountActive: {
    color: '#0ea5e9',
  },
});
