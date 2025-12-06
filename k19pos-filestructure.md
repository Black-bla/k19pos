# Complete Minimalistic File Structure

Based on your reset, here's the **leanest possible structure** for maximum speed:

```
restaurant-pos/
├── app/
│   ├── (auth)/
│   │   └── login.tsx                    # Staff login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx                  # Tab navigator
│   │   ├── index.tsx                    # Tables grid (home)
│   │   ├── menu.tsx                     # Menu list
│   │   └── reservations.tsx             # Reservations list
│   ├── order/[id].tsx                   # Order detail screen
│   ├── payment/[orderId].tsx            # Payment/STK Push screen
│   └── _layout.tsx                      # Root layout
│
├── components/
│   ├── TableCard.tsx                    # Single table with status badge
│   ├── StatusBadge.tsx                  # Reusable colored status pill
│   ├── OrderItemRow.tsx                 # Order item with +/- buttons
│   └── MenuItemCard.tsx                 # Menu item display
│
├── lib/
│   ├── supabase.ts                      # Supabase client setup
│   └── types.ts                         # TypeScript types
│
├── hooks/
│   ├── useTables.ts                     # Realtime tables
│   ├── useOrders.ts                     # Orders logic
│   └── useReservations.ts               # Reservations logic
│
├── constants/
│   └── Colors.ts                        # Status colors (already exists)
│
├── .env                                 # Supabase keys
├── .env.example                         # Template
├── supabase/
│   ├── schema.sql                       # Database schema
│   └── functions/
│       └── mpesa-stk-push/
│           └── index.ts                 # M-Pesa Edge Function
│
├── app.json
├── package.json
└── tsconfig.json
```

---

## File Contents (Copy-Paste Ready)

### 1. **`.env`**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. **`.env.example`**
```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

### 3. **`lib/supabase.ts`**
```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

### 4. **`lib/types.ts`**
```typescript
export type TableStatus = 'available' | 'occupied' | 'awaiting_payment';
export type OrderStatus = 'open' | 'paid';
export type PaymentStatus = 'pending' | 'success' | 'failed';
export type ReservationStatus = 'pending' | 'seated' | 'completed';

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  available: boolean;
}

export interface Order {
  id: string;
  table_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  table?: Table;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  price_snapshot: number;
  quantity: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  order_id: string;
  phone_number: string;
  amount: number;
  mpesa_receipt_number?: string;
  status: PaymentStatus;
  created_at: string;
}

export interface Reservation {
  id: string;
  customer_name: string;
  phone_number: string;
  table_id: string;
  reservation_time: string;
  status: ReservationStatus;
  table?: Table;
}
```

---

### 5. **`constants/Colors.ts`** (Add to existing file)
```typescript
export const StatusColors = {
  available: '#10b981',      // Green
  occupied: '#f59e0b',       // Orange
  awaiting_payment: '#3b82f6', // Blue
  open: '#f59e0b',
  paid: '#10b981',
  pending: '#6b7280',        // Gray
  success: '#10b981',
  failed: '#ef4444',         // Red
  seated: '#8b5cf6',         // Purple
  completed: '#10b981',
};
```

---

### 6. **`components/StatusBadge.tsx`**
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { StatusColors } from '@/constants/Colors';

type StatusType = keyof typeof StatusColors;

interface Props {
  status: StatusType;
  label?: string;
}

export default function StatusBadge({ status, label }: Props) {
  const displayLabel = label || status.replace(/_/g, ' ');
  
  return (
    <View style={[styles.badge, { backgroundColor: StatusColors[status] }]}>
      <Text style={styles.text}>{displayLabel.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
```

---

### 7. **`components/TableCard.tsx`**
```typescript
import { Pressable, Text, StyleSheet } from 'react-native';
import { Table } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { StatusColors } from '@/constants/Colors';

interface Props {
  table: Table;
  onPress: () => void;
}

export default function TableCard({ table, onPress }: Props) {
  return (
    <Pressable
      style={[styles.card, { borderColor: StatusColors[table.status] }]}
      onPress={onPress}
      android_ripple={{ color: '#e5e7eb' }}
    >
      <Text style={styles.name}>{table.name}</Text>
      <StatusBadge status={table.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
});
```

---

### 8. **`components/OrderItemRow.tsx`**
```typescript
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { OrderItem } from '@/lib/types';

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

      <Text style={styles.subtotal}>KES {item.subtotal.toFixed(2)}</Text>
      
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
```

---

### 9. **`components/MenuItemCard.tsx`**
```typescript
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { MenuItem } from '@/lib/types';

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export default function MenuItemCard({ item, onPress }: Props) {
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
```

---

### 10. **`hooks/useTables.ts`**
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Table } from '@/lib/types';

export function useTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTables();

    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tables' },
        () => fetchTables()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchTables() {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('name');
    
    if (data) setTables(data);
    setLoading(false);
  }

  return { tables, loading, refetch: fetchTables };
}
```

---

### 11. **`hooks/useOrders.ts`**
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderItem } from '@/lib/types';

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
    fetchItems();

    const itemsChannel = supabase
      .channel(`order-items-${orderId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` },
        () => {
          fetchItems();
          fetchOrder(); // Refresh total
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [orderId]);

  async function fetchOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, table:tables(*)')
      .eq('id', orderId)
      .single();
    
    if (data) setOrder(data);
    setLoading(false);
  }

  async function fetchItems() {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at');
    
    if (data) setItems(data);
  }

  async function updateQuantity(itemId: string, change: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newQty = item.quantity + change;
    
    if (newQty <= 0) {
      await supabase.from('order_items').delete().eq('id', itemId);
    } else {
      await supabase
        .from('order_items')
        .update({ quantity: newQty })
        .eq('id', itemId);
    }
  }

  async function removeItem(itemId: string) {
    await supabase.from('order_items').delete().eq('id', itemId);
  }

  return { order, items, loading, updateQuantity, removeItem };
}
```

---

### 12. **`hooks/useReservations.ts`**
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Reservation } from '@/lib/types';

export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();

    const channel = supabase
      .channel('reservations-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => fetchReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchReservations() {
    const { data } = await supabase
      .from('reservations')
      .select('*, table:tables(*)')
      .order('reservation_time');
    
    if (data) setReservations(data);
    setLoading(false);
  }

  return { reservations, loading, refetch: fetchReservations };
}
```

---

### 13. **`app/(tabs)/_layout.tsx`**
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#10b981',
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tables',
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

---

### 14. **`app/(tabs)/index.tsx`** (Tables Screen)
```typescript
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTables } from '@/hooks/useTables';
import TableCard from '@/components/TableCard';
import { supabase } from '@/lib/supabase';

export default function TablesScreen() {
  const { tables, loading } = useTables();

  async function handleTablePress(tableId: string, status: string) {
    if (status === 'available') {
      // Create new order
      const { data } = await supabase
        .from('orders')
        .insert({ table_id: tableId })
        .select()
        .single();
      
      if (data) router.push(`/order/${data.id}`);
    } else {
      // Find existing open order
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .single();
      
      if (data) router.push(`/order/${data.id}`);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading tables...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tables</Text>
      </View>
      
      <FlatList
        data={tables}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <TableCard
              table={item}
              onPress={() => handleTablePress(item.id, item.status)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  grid: {
    padding: 16,
  },
  row: {
    gap: 16,
  },
  cardWrapper: {
    flex: 1,
  },
});
```

---

## Installation Commands

```bash
# Install dependencies
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

# Install icons
npx expo install @expo/vector-icons
```

---

## Next Steps

1. **Set up Supabase database** (I'll give you the SQL schema next)
2. **Seed initial tables** (Table 1, Table 2, etc.)
3. **Test Tables screen** with realtime updates
4. **Build Order screen** (order/[id].tsx)
5. **Implement Payment screen**

**Ready?** Tell me "database schema" and I'll give you the complete SQL to copy-paste into Supabase SQL Editor.