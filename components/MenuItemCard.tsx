import { useTheme } from '@/context/ThemeContext';
import { MenuItem } from '@/lib/types';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export default function MenuItemCard({ item, onPress }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={[styles.card, !item.available && styles.unavailable]}
      onPress={item.available ? onPress : undefined}
      disabled={!item.available}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{item.name}</Text>
        {item.category && (
          <Text style={styles.category}>{item.category}</Text>
        )}
      </View>
      <Text style={styles.price}>KES {item.price.toFixed(2)}</Text>
      {!item.available && (
        <Text style={styles.unavailableText}>Unavailable</Text>
      )}
    </Pressable>
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    unavailable: {
      opacity: 0.5,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      flex: 1,
    },
    category: {
      fontSize: 12,
      color: c.muted,
      backgroundColor: c.input,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    price: {
      fontSize: 18,
      fontWeight: '700',
      color: c.success,
    },
    unavailableText: {
      fontSize: 12,
      color: c.danger,
      marginTop: 4,
    },
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unavailable: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  category: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  unavailableText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
});
