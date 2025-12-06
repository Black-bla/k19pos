import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import Screen from '@/components/Screen';
import { Ionicons } from '@expo/vector-icons';

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
  };
}

export default function PaymentsListScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
            table_id
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPayments(data || []);
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

  function renderPaymentItem({ item }: { item: Payment }) {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const guestName = item.guests?.guest_name || 'Unknown Guest';

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Payments</Text>
        <Text style={styles.headerSubtitle}>{new Date().toDateString()}</Text>
      </View>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Payments</Text>
            <Text style={styles.summaryValue}>{payments.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Successful</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
              {payments.filter(p => p.status === 'success').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {payments.filter(p => p.status === 'pending').length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={[styles.summaryValue, { color: '#0ea5e9' }]}>
              {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
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
      ) : (
        <FlatList
          data={payments}
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
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
});
