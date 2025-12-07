import { useTheme } from '@/context/ThemeContext';
import { Table } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  table: Table;
  occupancy?: number;
  emptySeats?: number;
  seatCount?: number;
  waiterName?: string;
  isReserved?: boolean;
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
  isReserved = false,
  onPress,
  onEdit,
  onRemove 
}: Props) {
  const { theme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Determine card background color based on occupancy and theme
  const getCardBackground = () => {
    if (theme.isDark) {
      if (occupancy === 0) return '#1f2937'; // Dark slate - empty
      if (occupancy === seatCount) return '#2d3748'; // Darker slate - full
      return '#1f2937'; // Dark slate - partial
    } else {
      if (occupancy === 0) return '#eff6ff'; // Light blue - empty
      if (occupancy === seatCount) return '#fef3c7'; // Light orange - full
      return '#f0fdf4'; // Light green - partial
    }
  };

  // Get status icon and color
  const getStatusIndicator = () => {
    if (table.status === 'occupied') {
      return { icon: 'checkmark-circle' as const, color: '#10b981' };
    }
    return { icon: 'checkmark-circle-outline' as const, color: '#0ea5e9' };
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
        { backgroundColor: getCardBackground() },
      ]}
      onPress={onPress}
      android_ripple={{ color: theme.colors.ripple }}
    >
      {/* Top Section: Table Name on left, Status Icon + Capacity Badge on right */}
      <View style={styles.topSection}>
        <Text style={styles.name} numberOfLines={1}>{table.name}</Text>
        <View style={styles.rightTopSection}>
          <View style={styles.statusBadge}>
            <Ionicons name={statusIndicator.icon} size={16} color={statusIndicator.color} />
          </View>
          <View style={styles.capacityBadge}>
            <Text style={styles.capacityText}>{seatCount}</Text>
            <Ionicons name="people" size={12} color={theme.colors.muted} />
          </View>
        </View>
      </View>

      {/* Center Section: Seat Visualization */}
      <View style={styles.seatVisualization}>
        {Array.from({ length: seatCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.seatDot,
              { backgroundColor: i < occupancy ? theme.colors.success : (theme.isDark ? '#374151' : '#e2e8f0') },
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
            <Text style={styles.waiterText} numberOfLines={1}>{waiterName}</Text>
          </View>
        )}
        
        {isReserved && (
          <View style={styles.reservedBadge}>
            <Ionicons name="calendar" size={12} color="#f59e0b" />
            <Text style={styles.reservedText}>Reserved</Text>
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

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    card: {
      width: cardWidth,
      height: cardWidth,
      borderRadius: 14,
      padding: 14,
      justifyContent: 'space-between',
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.isDark ? 0.3 : 0.08,
      shadowRadius: 4,
      elevation: theme.isDark ? 0 : 3,
    },
    cardElevated: {
      zIndex: 1000,
      elevation: 10,
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
      color: c.text,
      flex: 1,
    },
    rightTopSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(241, 245, 249, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    capacityBadge: {
      backgroundColor: theme.isDark ? 'rgba(31, 41, 55, 0.9)' : '#f1f5f9',
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
      color: c.text,
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
      color: c.subtext,
      fontWeight: '600',
      flex: 1,
    },
    reservedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(254, 243, 199, 0.8)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.4)',
    },
    reservedText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#f59e0b',
      letterSpacing: 0.2,
    },
    menuContainer: {
      position: 'relative',
    },
    menuBtn: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: theme.isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(241, 245, 249, 0.7)',
    },
    dropdown: {
      position: 'absolute',
      top: 32,
      right: 0,
      backgroundColor: c.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      minWidth: 140,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isDark ? 0.3 : 0.15,
      shadowRadius: 8,
      elevation: theme.isDark ? 8 : 10,
      zIndex: 1001,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuItemDanger: {
      borderBottomWidth: 0,
    },
    menuItemText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    menuItemDangerText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.danger,
    },
  });
}
