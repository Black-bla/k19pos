import { StatusColors } from '@/constants/Colors';
import { Table } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  table: Table;
  occupancy?: number;
  emptySeats?: number;
  seatCount?: number;
  waiterName?: string;
  onPress: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export default function TableCard({ 
  table, 
  occupancy = 0, 
  emptySeats = 0,
  seatCount = 4,
  waiterName,
  onPress,
  onEdit,
  onRemove 
}: Props) {
  const [showMenu, setShowMenu] = useState(false);

  // Determine card background color based on occupancy
  const getCardBackground = () => {
    if (occupancy === 0) return '#eff6ff'; // Light blue - empty
    if (occupancy === seatCount) return '#fef3c7'; // Light orange - full
    return '#f0fdf4'; // Light green - partial
  };

  // Get status icon and color
  const getStatusIndicator = () => {
    if (table.status === 'occupied') {
      return { icon: 'checkmark-circle', color: '#10b981' };
    }
    return { icon: 'circle', color: '#0ea5e9' };
  };

  const statusIndicator = getStatusIndicator();

  // Get waiter initials for avatar
  const getWaiterInitials = () => {
    if (!waiterName) return '';
    return waiterName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const waiterInitials = getWaiterInitials();

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: getCardBackground(), borderColor: StatusColors[table.status] },
      ]}
      onPress={onPress}
      android_ripple={{ color: '#e5e7eb' }}
    >
      {/* Top Section: Table Name | Capacity Badge */}
      <View style={styles.topSection}>
        <Text style={styles.name}>{table.name}</Text>
        <View style={styles.capacityBadge}>
          <Text style={styles.capacityText}>{seatCount}</Text>
          <Ionicons name="people" size={12} color="#64748b" />
        </View>
      </View>

      {/* Status Icon Overlay */}
      <View style={styles.statusOverlay}>
        <Ionicons name={statusIndicator.icon} size={24} color={statusIndicator.color} />
      </View>

      {/* Center Section: Seat Visualization */}
      <View style={styles.seatVisualization}>
        {Array.from({ length: seatCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.seatDot,
              { backgroundColor: i < occupancy ? '#10b981' : '#e2e8f0' },
            ]}
          />
        ))}
      </View>

      {/* Bottom Section: Waiter | Menu */}
      <View style={styles.bottomSection}>
        {waiterName && (
          <View style={styles.waiterInfo}>
            <View style={styles.waiterAvatar}>
              <Text style={styles.waiterInitials}>{waiterInitials}</Text>
            </View>
            <Text style={styles.waiterText}>{waiterName}</Text>
          </View>
        )}
        
        <View style={styles.menuContainer}>
          <Pressable
            style={styles.menuBtn}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
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
                  <Text style={styles.menuItemText}>Edit</Text>
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
                  <Text style={styles.menuItemDangerText}>Remove</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Calculate card dimensions: screen width - padding (12*2) - gap (12) = per card width
// With 2 cards per row: (screenWidth - 24 - 12) / 2
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2; // 24px padding (12 each side) + 12px gap between cards

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    height: cardWidth,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  capacityBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    opacity: 0.9,
  },
  seatVisualization: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  seatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  waiterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  waiterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waiterInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  waiterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
  },
  menuContainer: {
    position: 'relative',
  },
  menuBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
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
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});
