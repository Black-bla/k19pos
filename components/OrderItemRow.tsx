import { OrderItem } from '@/lib/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  item: OrderItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export default function OrderItemRow({ item, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.menu_item_name}</Text>
        <Text style={styles.price}>KES {item.price_snapshot.toFixed(2)}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.btn} onPress={onDecrement}>
          <Text style={styles.btnText}>-</Text>
        </Pressable>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <Pressable style={styles.btn} onPress={onIncrement}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.subtotal}>KES {(item.subtotal ?? (item.price_snapshot * item.quantity)).toFixed(2)}</Text>
      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    gap: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  price: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: 36,
    height: 36,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    minWidth: 80,
    textAlign: 'right',
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 20,
    color: '#ef4444',
  },
});
