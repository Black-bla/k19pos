
import { useOrder } from '@/hooks/useOrders';
import { supabase } from '@/lib/supabase';
import { MenuItem } from '@/lib/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function OrderScreen() {
  const { id } = useLocalSearchParams();
  const { order, items, loading } = useOrder(id as string);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({
    STARTER: '',
    MAIN_MEAL: '',
    DESSERT: ''
  });
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchMenu();
  }, []);

  async function fetchMenu() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category')
      .order('display_order');
    if (data) setMenuItems(data);
  }

  function getItemsByCategory(category: string) {
    return menuItems.filter(item => item.category === category);
  }

  async function handleMealSelection(category: string, itemId: string) {
    // Remove existing item from this category
    const existingCategoryItems = items.filter(
      item => menuItems.find(mi => mi.id === item.menu_item_id)?.category === category
    );
    for (const item of existingCategoryItems) {
      await supabase.from('order_items').delete().eq('id', item.id);
    }
    // Add new selection
    const menuItem = menuItems.find(m => m.id === itemId);
    if (menuItem) {
      await supabase.from('order_items').insert({
        order_id: id,
        menu_item_id: itemId,
        menu_item_name: menuItem.name,
        price_snapshot: menuItem.price,
        quantity: 1
      });
    }
    setSelectedItems(prev => ({ ...prev, [category]: itemId }));
  }

  async function handleDrinkToggle(itemId: string) {
    const existingItem = items.find(item => item.menu_item_id === itemId);
    if (existingItem) {
      // Remove drink
      await supabase.from('order_items').delete().eq('id', existingItem.id);
      setDrinkQuantities(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } else {
      // Add drink
      const menuItem = menuItems.find(m => m.id === itemId);
      if (menuItem) {
        await supabase.from('order_items').insert({
          order_id: id,
          menu_item_id: itemId,
          menu_item_name: menuItem.name,
          price_snapshot: menuItem.price,
          quantity: 1
        });
        setDrinkQuantities(prev => ({ ...prev, [itemId]: 1 }));
      }
    }
  }

  async function updateDrinkQuantity(itemId: string, change: number) {
    const item = items.find(i => i.menu_item_id === itemId);
    if (!item) return;
    const newQty = item.quantity + change;
    if (newQty <= 0) {
      await supabase.from('order_items').delete().eq('id', item.id);
      setDrinkQuantities(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } else {
      await supabase.from('order_items').update({ quantity: newQty }).eq('id', item.id);
      setDrinkQuantities(prev => ({ ...prev, [itemId]: newQty }));
    }
  }

  async function handleSendToKitchen() {
    await supabase.from('orders').update({ confirmed_at: new Date().toISOString() }).eq('id', id);
    router.back();
  }

  if (loading) return <View style={styles.container}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {order?.table?.name} ({order?.guest_count || 1} Guests)
        </Text>
      </View>

      {/* STARTERS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STARTER</Text>
        {getItemsByCategory('STARTER').map(item => (
          <Pressable
            key={item.id}
            style={[styles.menuItem, selectedItems.STARTER === item.id && styles.selectedItem]}
            onPress={() => handleMealSelection('STARTER', item.id)}
          >
            <View style={styles.radioButton}>
              {selectedItems.STARTER === item.id && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>KES {item.price}</Text>
          </Pressable>
        ))}
      </View>

      {/* MAIN MEAL */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MAIN MEAL</Text>
        {getItemsByCategory('MAIN_MEAL').map(item => (
          <Pressable
            key={item.id}
            style={[styles.menuItem, selectedItems.MAIN_MEAL === item.id && styles.selectedItem]}
            onPress={() => handleMealSelection('MAIN_MEAL', item.id)}
          >
            <View style={styles.radioButton}>
              {selectedItems.MAIN_MEAL === item.id && <View style={styles.radioSelected} />}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.is_combo && item.combo_items && (
                <Text style={styles.comboItems}>{item.combo_items.join(' • ')}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>KES {item.price}</Text>
          </Pressable>
        ))}
      </View>

      {/* DESSERT */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DESSERT</Text>
        {getItemsByCategory('DESSERT').map(item => (
          <Pressable
            key={item.id}
            style={[styles.menuItem, selectedItems.DESSERT === item.id && styles.selectedItem]}
            onPress={() => handleMealSelection('DESSERT', item.id)}
          >
            <View style={styles.radioButton}>
              {selectedItems.DESSERT === item.id && <View style={styles.radioSelected} />}
            </View>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>KES {item.price}</Text>
          </Pressable>
        ))}
      </View>

      {/* DRINKS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DRINKS</Text>
        {getItemsByCategory('DRINKS').map(item => {
          const orderItem = items.find(i => i.menu_item_id === item.id);
          const isSelected = !!orderItem;
          return (
            <View key={item.id} style={styles.drinkItem}>
              <Pressable style={styles.checkbox} onPress={() => handleDrinkToggle(item.id)}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>KES {item.price}</Text>
              {isSelected && (
                <View style={styles.quantityControls}>
                  <Pressable style={styles.qtyBtn} onPress={() => updateDrinkQuantity(item.id, -1)}>
                    <Text style={styles.qtyText}>−</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{orderItem.quantity}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => updateDrinkQuantity(item.id, 1)}>
                    <Text style={styles.qtyText}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ORDER SUMMARY */}
      {items.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>ORDER SUMMARY</Text>
          {items.map(item => (
            <View key={item.id} style={styles.summaryItem}>
              <Text style={styles.summaryText}>
                • {item.menu_item_name} {item.quantity > 1 ? `× ${item.quantity}` : ''}
              </Text>
              <Text style={styles.summaryPrice}>
                KES {item.subtotal?.toFixed(2) ?? (item.price_snapshot * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL:</Text>
            <Text style={styles.totalAmount}>KES {order?.total?.toFixed(2) ?? ''}</Text>
          </View>
        </View>
      )}

      {/* ACTION BUTTONS */}
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSendToKitchen} disabled={items.length === 0}>
          <Text style={styles.primaryButtonText}>Confirm Order</Text>
        </Pressable>
      </View>
    </ScrollView>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  comboItems: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  drinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  summary: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10b981',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#10b981',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
