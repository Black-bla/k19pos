import ModalBox from '@/components/ModalBox';
import Screen from '@/components/Screen';
import { useTheme } from '@/context/ThemeContext';
import { useReservations } from '@/hooks/useReservations';
import { useTables } from '@/hooks/useTables';
import { supabase } from '@/lib/supabase';
import { Reservation } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STATUS_COLORS: Record<Reservation['status'], string> = {
  pending: '#0ea5e9',
  seated: '#10b981',
  cancelled: '#9ca3af',
  no_show: '#ef4444',
};

export default function ReservationsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { reservations, loading, refetch } = useReservations();
  const { tables } = useTables();
  const scaleAnim = useMemo(() => new Animated.Value(0), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<Reservation['status'] | 'all'>('pending');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: '', // yyyy-mm-dd
    time: '', // HH:mm
    partySize: '2',
    tableId: '',
    notes: '',
  });

  const filteredReservations = useMemo(() => {
    if (filterStatus === 'all') return reservations;
    return reservations.filter(r => r.status === filterStatus);
  }, [reservations, filterStatus]);

  useEffect(() => {
    if (filteredReservations.length === 0 && !loading) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [filteredReservations.length, loading, scaleAnim]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  async function createReservation() {
    if (!form.name || !form.date || !form.time) {
      Alert.alert('Missing info', 'Name, date, and time are required.');
      return;
    }
    const iso = new Date(`${form.date}T${form.time}:00`).toISOString();
    const partySize = Number(form.partySize) || 1;

    try {
      setSaving(true);
      const { error } = await supabase.from('reservations').insert([
        {
          name: form.name,
          phone: form.phone || null,
          date: form.date,
          time: form.time,
          party_size: Number(form.partySize) || 1,
          table_id: form.tableId || null,
          status: 'pending',
          notes: form.notes || null,
        },
      ]);
      if (error) throw error;
      setModalOpen(false);
      setForm({ name: '', phone: '', date: '', time: '', partySize: '2', tableId: '', notes: '' });
      await refetch();
    } catch (err) {
      console.error('Failed to create reservation', err);
      Alert.alert('Error', 'Failed to create reservation.');
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(reservation: Reservation, status: Reservation['status']) {
    try {
      setUpdatingId(reservation.id);
      const updates: any = { status };
      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', reservation.id);
      if (error) throw error;

      // If seated, optionally create guests for the party
      if (status === 'seated' && reservation.table_id) {
        const partySize = reservation.party_size || 1;
        const inserts = Array.from({ length: partySize }).map((_, idx) => ({
          table_id: reservation.table_id,
          seat_number: idx + 1,
          guest_name: reservation.name,
          status: 'pending',
        }));
        const { error: guestErr } = await supabase.from('guests').insert(inserts);
        if (guestErr) console.warn('Guests creation failed', guestErr.message);
      }

      await refetch();
    } catch (err) {
      console.error('Failed to update status', err);
      Alert.alert('Error', 'Could not update reservation status.');
    } finally {
      setUpdatingId(null);
    }
  }

  const renderCard = ({ item }: { item: Reservation }) => {
    const statusColor = STATUS_COLORS[item.status] || '#64748b';
    
    return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name || 'Unnamed Guest'}</Text>
          <Text style={styles.meta}>{item.phone || 'No phone'} · Party {item.party_size || 1}</Text>
          <Text style={styles.meta}>{item.table_id ? `Table ${item.table_id}` : 'No table assigned'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="time" size={16} color={theme.colors.subtext} />
        <Text style={styles.metaTime}>{item.date} {item.time}</Text>
      </View>

      {item.notes ? <Text style={styles.notes}>Note: {item.notes}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.primaryBtn, updatingId === item.id && styles.disabledBtn]}
          onPress={() => markStatus(item, 'seated')}
          disabled={updatingId === item.id}
        >
          {updatingId === item.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionTextPrimary}>Mark Seated</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.secondaryBtn, updatingId === item.id && styles.disabledBtn]}
          onPress={() => markStatus(item, 'cancelled')}
          disabled={updatingId === item.id}
        >
          <Text style={styles.actionText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.dangerBtn, updatingId === item.id && styles.disabledBtn]}
          onPress={() => markStatus(item, 'no_show')}
          disabled={updatingId === item.id}
        >
          <Text style={styles.actionText}>No-show</Text>
        </Pressable>
      </View>
    </View>
    );
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reservations</Text>
          <Text style={styles.subtitle}>
            {filteredReservations.length} {filterStatus === 'all' ? 'total' : filterStatus}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Status Filter */}
      <View style={styles.filterBar}>
        {(['all', 'pending', 'seated', 'cancelled', 'no_show'] as const).map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterChip,
              filterStatus === status && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === status && styles.filterChipTextActive,
              ]}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={styles.meta.color} />
          <Text style={styles.meta}>Loading reservations...</Text>
        </View>
      ) : filteredReservations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="calendar-outline" size={80} color={styles.emptyIcon.color} />
          </Animated.View>
          <Text style={styles.emptyText}>
            {reservations.length === 0 ? 'No reservations' : `No ${filterStatus} reservations`}
          </Text>
          <Text style={styles.emptySubtext}>
            {reservations.length === 0 ? 'Create your first reservation' : 'Try a different filter'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReservations}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
        />
      )}

      {modalOpen && (
        <ModalBox
          title="Add Reservation"
          onClose={() => setModalOpen(false)}
          onConfirm={createReservation}
          confirmLabel={saving ? 'Saving...' : 'Create Reservation'}
          confirmDisabled={saving}
        >
          <View style={styles.formRow}>
            <Text style={styles.label}>Guest Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm((p) => ({ ...p, name: text }))}
              placeholder="Jane Doe"
              placeholderTextColor={styles.inputPlaceholder.color}
            />
          </View>
          <View style={styles.formRow}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => setForm((p) => ({ ...p, phone: text }))}
              placeholder="0712345678"
              keyboardType="phone-pad"
              placeholderTextColor={styles.inputPlaceholder.color}
            />
          </View>
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date *</Text>
              <Pressable
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setDatePickerOpen(true)}
              >
                <Text style={form.date ? styles.inputText : styles.inputPlaceholder}>
                  {form.date ? new Date(form.date).toLocaleDateString() : 'Select date...'}
                </Text>
              </Pressable>
            </View>
            <View style={{ width: 120 }}>
              <Text style={styles.label}>Time *</Text>
              <Pressable
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setTimePickerOpen(true)}
              >
                <Text style={form.time ? styles.inputText : styles.inputPlaceholder}>
                  {form.time || 'Select time...'}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Party Size</Text>
              <TextInput
                style={styles.input}
                value={form.partySize}
                onChangeText={(text) => setForm((p) => ({ ...p, partySize: text }))}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor={styles.inputPlaceholder.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Table (optional)</Text>
              <Pressable
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setTablePickerOpen(true)}
              >
                <Text style={form.tableId ? styles.inputText : styles.inputPlaceholder}>
                  {form.tableId || 'Select table...'}
                </Text>
              </Pressable>
            </View>
          </View>
          {tablePickerOpen && (
            <View style={styles.tablePickerOverlay}>
              <View style={styles.tablePickerContent}>
                <View style={styles.tablePickerHeader}>
                  <Text style={styles.tablePickerTitle}>Select Table</Text>
                  <Pressable onPress={() => setTablePickerOpen(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text} />
                  </Pressable>
                </View>
                <FlatList
                  data={tables}
                  numColumns={3}
                  keyExtractor={(item) => item.id}
                  columnWrapperStyle={styles.tablePickerGrid}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.tablePickerButton,
                        form.tableId === item.id && styles.tablePickerButtonSelected,
                      ]}
                      onPress={() => {
                        setForm((p) => ({ ...p, tableId: item.id }));
                        setTablePickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.tablePickerButtonText,
                          form.tableId === item.id && styles.tablePickerButtonTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                />
                <Pressable
                  style={styles.tablePickerClearBtn}
                  onPress={() => {
                    setForm((p) => ({ ...p, tableId: '' }));
                    setTablePickerOpen(false);
                  }}
                >
                  <Text style={styles.tablePickerClearBtnText}>Clear Selection</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Date Picker Modal */}
          {datePickerOpen && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContent}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Date</Text>
                  <Pressable onPress={() => setDatePickerOpen(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text} />
                  </Pressable>
                </View>
                <View style={styles.calendarContainer}>
                  <DatePickerComponent
                    value={form.date ? new Date(form.date) : new Date()}
                    onChange={(date) => {
                      const iso = date.toISOString().split('T')[0];
                      setForm((p) => ({ ...p, date: iso }));
                      setDatePickerOpen(false);
                    }}
                    theme={theme}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Time Picker Modal */}
          {timePickerOpen && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContent}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Time</Text>
                  <Pressable onPress={() => setTimePickerOpen(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text} />
                  </Pressable>
                </View>
                <TimePickerComponent
                  value={form.time}
                  onChange={(time) => {
                    setForm((p) => ({ ...p, time }));
                    setTimePickerOpen(false);
                  }}
                  theme={theme}
                  styles={styles}
                />
              </View>
            </View>
          )}
          <View style={styles.formRow}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.notes}
              onChangeText={(text) => setForm((p) => ({ ...p, notes: text }))}
              placeholder="Birthday, allergies, etc."
              multiline
              placeholderTextColor={styles.inputPlaceholder.color}
            />
          </View>
        </ModalBox>
      )}
    </Screen>
  );
}

// Date Picker Component
function DatePickerComponent({
  value,
  onChange,
  theme,
}: {
  value: Date;
  onChange: (date: Date) => void;
  theme: any;
}) {
  const [year, setYear] = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth());
  const [day, setDay] = useState(value.getDate());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => null);
  const calendarDays = [...emptyDays, ...days];

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return (
    <View style={{ padding: 16 }}>
      {/* Month/Year Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Pressable onPress={() => setMonth(m => (m === 0 ? 11 : m - 1))}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
          {monthNames[month]} {year}
        </Text>
        <Pressable onPress={() => setMonth(m => (m === 11 ? 0 : m + 1))}>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View style={{ flexDirection: 'row', marginBottom: 8, justifyContent: 'space-around' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <Text key={d} style={{ fontSize: 12, fontWeight: '700', color: theme.colors.muted, width: '14.28%', textAlign: 'center' }}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {calendarDays.map((dayNum, idx) => (
          <View key={idx} style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }}>
            {dayNum ? (
              <Pressable
                style={{
                  width: '90%',
                  height: '90%',
                  borderRadius: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: dayNum === day ? theme.colors.primary : 'transparent',
                }}
                onPress={() => {
                  setDay(dayNum);
                  onChange(new Date(year, month, dayNum));
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: dayNum === day ? '#fff' : theme.colors.text,
                  }}
                >
                  {dayNum}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// Time Picker Component
function TimePickerComponent({
  value,
  onChange,
  theme,
  styles,
}: {
  value: string;
  onChange: (time: string) => void;
  theme: any;
  styles: any;
}) {
  // Parse the value prop for current hour and minute
  const [hour, setHour] = useState(() => (value ? parseInt(value.split(':')[0]) : 12));
  const [minute, setMinute] = useState(() => (value ? parseInt(value.split(':')[1]) : 0));
  const [hourInputActive, setHourInputActive] = useState(false);
  const [minuteInputActive, setMinuteInputActive] = useState(false);

  const updateTime = (newHour: number, newMinute: number) => {
    // Validate hour (0-23) and minute (0-59)
    const validHour = Math.max(0, Math.min(23, newHour));
    const validMinute = Math.max(0, Math.min(59, newMinute));
    setHour(validHour);
    setMinute(validMinute);
    onChange(`${String(validHour).padStart(2, '0')}:${String(validMinute).padStart(2, '0')}`);
  };

  const handleHourUp = () => {
    updateTime((hour + 1) % 24, minute);
  };

  const handleHourDown = () => {
    updateTime((hour - 1 + 24) % 24, minute);
  };

  const handleMinuteUp = () => {
    updateTime(hour, (minute + 1) % 60);
  };

  const handleMinuteDown = () => {
    updateTime(hour, (minute - 1 + 60) % 60);
  };

  const handleHourTextChange = (text: string) => {
    const num = parseInt(text) || 0;
    setHour(num);
    if (text.length === 2) {
      updateTime(num, minute);
      setHourInputActive(false);
    }
  };

  const handleMinuteTextChange = (text: string) => {
    const num = parseInt(text) || 0;
    setMinute(num);
    if (text.length === 2) {
      updateTime(hour, num);
      setMinuteInputActive(false);
    }
  };

  return (
    <View style={{ padding: 16, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        {/* Hour */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={handleHourUp}>
            <Ionicons name="chevron-up" size={28} color={theme.colors.primary} />
          </Pressable>
          {hourInputActive ? (
            <TextInput
              style={{
                width: 60,
                height: 60,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                borderRadius: 12,
                textAlign: 'center',
                fontSize: 32,
                fontWeight: '700',
                color: theme.colors.text,
                backgroundColor: theme.colors.input,
              }}
              value={String(hour).padStart(2, '0')}
              onChangeText={handleHourTextChange}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus
              onBlur={() => {
                setHourInputActive(false);
                updateTime(hour, minute);
              }}
            />
          ) : (
            <Pressable
              style={{
                width: 60,
                height: 60,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.colors.input,
              }}
              onPress={() => setHourInputActive(true)}
            >
              <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text }}>
                {String(hour).padStart(2, '0')}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={handleHourDown}>
            <Ionicons name="chevron-down" size={28} color={theme.colors.primary} />
          </Pressable>
        </View>

        <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text, marginBottom: 10 }}>:</Text>

        {/* Minute */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={handleMinuteUp}>
            <Ionicons name="chevron-up" size={28} color={theme.colors.primary} />
          </Pressable>
          {minuteInputActive ? (
            <TextInput
              style={{
                width: 60,
                height: 60,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                borderRadius: 12,
                textAlign: 'center',
                fontSize: 32,
                fontWeight: '700',
                color: theme.colors.text,
                backgroundColor: theme.colors.input,
              }}
              value={String(minute).padStart(2, '0')}
              onChangeText={handleMinuteTextChange}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus
              onBlur={() => {
                setMinuteInputActive(false);
                updateTime(hour, minute);
              }}
            />
          ) : (
            <Pressable
              style={{
                width: 60,
                height: 60,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.colors.input,
              }}
              onPress={() => setMinuteInputActive(true)}
            >
              <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text }}>
                {String(minute).padStart(2, '0')}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={handleMinuteDown}>
            <Ionicons name="chevron-down" size={28} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Quick select buttons for common times */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 }}>
        {['11:00', '12:00', '18:00', '19:00', '20:00'].map((t) => (
          <Pressable
            key={t}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: value === t ? theme.colors.primary : theme.colors.input,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
            onPress={() => {
              const [h, m] = t.split(':');
              updateTime(parseInt(h), parseInt(m));
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: value === t ? '#fff' : theme.colors.text }}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 13,
      color: c.subtext,
      marginTop: 4,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    addBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    list: {
      padding: 16,
      paddingBottom: 32,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.isDark ? 0.15 : 0.08,
      shadowRadius: 6,
      elevation: theme.isDark ? 0 : 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 10,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
    },
    meta: {
      fontSize: 13,
      color: c.subtext,
      marginTop: 2,
    },
    metaTime: {
      fontSize: 13,
      color: c.subtext,
      marginLeft: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    notes: {
      marginTop: 8,
      color: c.text,
      fontSize: 13,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    primaryBtn: {
      backgroundColor: c.success,
      borderColor: c.success,
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: theme.isDark ? 0 : 2,
    },
    secondaryBtn: {
      backgroundColor: c.input,
      borderColor: c.border,
    },
    dangerBtn: {
      backgroundColor: c.danger,
      borderColor: c.danger,
    },
    actionText: {
      color: c.text,
      fontWeight: '700',
      fontSize: 13,
    },
    actionTextPrimary: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    disabledBtn: {
      opacity: 0.6,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    iconWrapper: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    emptySubtext: {
      fontSize: 14,
      color: c.subtext,
    },
    emptyIcon: {
      color: c.border,
    },
    formRow: {
      marginBottom: 14,
    },
    inlineRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: c.input,
      color: c.text,
      fontSize: 14,
    },
    inputPlaceholder: {
      color: c.muted,
    },
    filterBar: {
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
      textTransform: 'capitalize',
    },
    filterChipTextActive: {
      color: '#fff',
    },
    inputText: {
      color: c.text,
      fontSize: 14,
    },
    tablePickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    tablePickerContent: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '80%',
      paddingBottom: 40,
    },
    tablePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    tablePickerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.2,
    },
    tablePickerGrid: {
      gap: 10,
      marginBottom: 12,
    },
    tablePickerButton: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 16,
      borderRadius: 10,
      backgroundColor: c.input,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 60,
    },
    tablePickerButtonSelected: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    tablePickerButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
    },
    tablePickerButtonTextSelected: {
      color: '#fff',
    },
    tablePickerClearBtn: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: c.input,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      marginTop: 12,
    },
    tablePickerClearBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
    },
    pickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    pickerContent: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '85%',
      paddingBottom: 40,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.2,
    },
    calendarContainer: {
      maxHeight: 400,
    },
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  meta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  metaTime: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  notes: {
    marginTop: 8,
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryBtn: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  actionText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  actionTextPrimary: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyIcon: {
    color: '#e5e7eb',
  },
  formRow: {
    marginBottom: 14,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 14,
  },
  inputPlaceholder: {
    color: '#94a3b8',
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  inputText: {
    color: '#0f172a',
    fontSize: 14,
  },
  tablePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  tablePickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  tablePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tablePickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tablePickerGrid: {
    gap: 10,
    marginBottom: 12,
  },
  tablePickerButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  tablePickerButtonSelected: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  tablePickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tablePickerButtonTextSelected: {
    color: '#fff',
  },
  tablePickerClearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginTop: 12,
  },
  tablePickerClearBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  pickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  calendarContainer: {
    maxHeight: 400,
  },
});
