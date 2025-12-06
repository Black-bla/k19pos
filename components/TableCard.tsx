import { StatusColors } from '@/constants/Colors';
import { Table } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import StatusBadge from './StatusBadge';

interface Props {
  table: Table;
  occupancy?: number;
  emptySeats?: number;
  waiterName?: string;
  onPress: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export default function TableCard({ 
  table, 
  occupancy = 0, 
  emptySeats = 0,
  waiterName,
  onPress,
  onEdit,
  onRemove 
}: Props) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Pressable
      style={[styles.card, { borderColor: StatusColors[table.status] }]}
      onPress={onPress}
      android_ripple={{ color: '#e5e7eb' }}
    >
      {/* Header with menu */}
      <View style={styles.header}>
        <Text style={styles.name}>{table.name}</Text>
        <View style={styles.menuContainer}>
          <Pressable 
            style={styles.menuBtn}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#64748b" />
          </Pressable>
          
          {showMenu && (
            <View style={styles.dropdown}>
              {onEdit && (
                <Pressable 
                  style={styles.menuItem}
                  onPress={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                >
                  <Ionicons name="pencil" size={16} color="#0ea5e9" />
                  <Text style={styles.menuItemText}>Edit Table</Text>
                </Pressable>
              )}
              {onRemove && (
                <Pressable 
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => {
                    onRemove();
                    setShowMenu(false);
                  }}
                >
                  <Ionicons name="trash" size={16} color="#ef4444" />
                  <Text style={styles.menuItemDangerText}>Remove Table</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Status Badge */}
      <StatusBadge status={table.status} />

      {/* Occupancy Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="people" size={16} color="#10b981" />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>{occupancy}</Text> occupied
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="square" size={16} color="#0ea5e9" />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>{emptySeats}</Text> empty
          </Text>
        </View>
      </View>

      {/* Waiter Info */}
      {waiterName && (
        <View style={styles.waiterSection}>
          <Ionicons name="person-circle" size={14} color="#8b5cf6" />
          <Text style={styles.waiterText}>{waiterName}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Calculate card dimensions: screen width - padding (12*2) - gap (12) = per card width
// With 2 cards per row: (screenWidth - 24 - 12) / 2
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2; // 24px padding (12 each side) + 12px gap between cards

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
    width: cardWidth,
    height: cardWidth,
    justifyContent: 'space-between',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  menuContainer: {
    position: 'relative',
  },
  menuBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  dropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  menuItemDangerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  infoSection: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  infoBold: {
    fontWeight: '700',
    color: '#1e293b',
  },
  waiterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  waiterText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '600',
  },
});
