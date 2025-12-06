import Screen from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { MenuItem } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface OrderTakingScreenProps {
  guestId: string;
  onClose: () => void;
}

export default function OrderTakingScreen({ guestId, onClose }: OrderTakingScreenProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState<string>('');
  
  // Track selected items for the order
  const [selectedStarter, setSelectedStarter] = useState<string | null>(null);
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedDessert, setSelectedDessert] = useState<string | null>(null);
  const [selectedDrinks, setSelectedDrinks] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchTodaysMenu();
  }, []);

  async function fetchTodaysMenu() {
    setLoading(true);
    setError(null);

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      setServiceDate(today);

      // Fetch menu items for today
      const { data, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('service_date', today)
        .eq('available', true)
        .order('category')
        .order('meal_option');

      if (menuError) throw menuError;
      
      if (!data || data.length === 0) {
        setError('No menu available for today. Please contact the manager.');
        setItems([]);
      } else {
        setItems(data);
      }
    } catch (err: any) {
      console.error('Failed to load menu:', err);
      setError('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }

  const starters = useMemo(() => items.filter(i => i.category === 'STARTER'), [items]);
  const desserts = useMemo(() => items.filter(i => i.category === 'DESSERT'), [items]);
  const drinks = useMemo(() => items.filter(i => i.category === 'DRINKS'), [items]);

  const mains = useMemo(() => {
    const options: Record<'A' | 'B', { meat?: MenuItem; carb?: MenuItem; veg?: MenuItem; price?: number }> = { A: {}, B: {} };
    items.filter(i => i.category === 'MAIN_MEAL').forEach(i => {
      if (i.meal_option === 'A' || i.meal_option === 'B') {
        if (i.subcategory === 'MEAT') {
          options[i.meal_option].meat = i;
          options[i.meal_option].price = i.price;
        }
        if (i.subcategory === 'CARBOHYDRATE') options[i.meal_option].carb = i;
        if (i.subcategory === 'VEGETABLE') options[i.meal_option].veg = i;
      }
    });
    return options;
  }, [items]);

  async function handleAddToOrder() {
    if (!selectedStarter && !selectedMain && !selectedDessert && Object.keys(selectedDrinks).length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to add to the order.');
      return;
    }

    try {
      const orderItems = [];

      // Add starter
      if (selectedStarter) {
        const item = items.find(i => i.id === selectedStarter);
        if (item) {
          orderItems.push({
            guest_id: guestId,
            menu_item_id: item.id,
            menu_item_name: item.name,
            price_snapshot: item.price,
            quantity: 1
          });
        }
      }

      // Add main meal (all components)
      if (selectedMain) {
        const mainOption = selectedMain as 'A' | 'B';
        const mainItems = items.filter(i => 
          i.category === 'MAIN_MEAL' && i.meal_option === mainOption
        );
        
        for (const item of mainItems) {
          orderItems.push({
            guest_id: guestId,
            menu_item_id: item.id,
            menu_item_name: item.name,
            price_snapshot: item.price,
            quantity: 1
          });
        }
      }

      // Add dessert
      if (selectedDessert) {
        const item = items.find(i => i.id === selectedDessert);
        if (item) {
          orderItems.push({
            guest_id: guestId,
            menu_item_id: item.id,
            menu_item_name: item.name,
            price_snapshot: item.price,
            quantity: 1
          });
        }
      }

      // Add drinks
      for (const [drinkId, quantity] of Object.entries(selectedDrinks)) {
        const item = items.find(i => i.id === drinkId);
        if (item && quantity > 0) {
          orderItems.push({
            guest_id: guestId,
            menu_item_id: item.id,
            menu_item_name: item.name,
            price_snapshot: item.price,
            quantity
          });
        }
      }

      // Insert all items
      const { error } = await supabase
        .from('guest_orders')
        .insert(orderItems);

      if (error) throw error;

      // Update guest status to 'ordered'
      const { error: guestError } = await supabase
        .from('guests')
        .update({ status: 'ordered' })
        .eq('id', guestId);

      if (guestError) {
        console.error('Failed to update guest status:', guestError);
      }

      Alert.alert('Success', 'Items added to order', [
        { text: 'OK', onPress: onClose }
      ]);
    } catch (err: any) {
      console.error('Failed to add items to order:', err);
      Alert.alert('Error', 'Failed to add items to order');
    }
  }

  function handleDrinkQuantityChange(drinkId: string, change: number) {
    setSelectedDrinks(prev => {
      const current = prev[drinkId] || 0;
      const newQty = current + change;
      
      if (newQty <= 0) {
        const updated = { ...prev };
        delete updated[drinkId];
        return updated;
      }
      
      return { ...prev, [drinkId]: newQty };
    });
  }

  function calculateTotal() {
    let total = 0;

    if (selectedStarter) {
      const item = items.find(i => i.id === selectedStarter);
      if (item) total += item.price;
    }

    if (selectedMain) {
      const mainOption = mains[selectedMain as 'A' | 'B'];
      if (mainOption.price) total += mainOption.price;
    }

    if (selectedDessert) {
      const item = items.find(i => i.id === selectedDessert);
      if (item) total += item.price;
    }

    for (const [drinkId, quantity] of Object.entries(selectedDrinks)) {
      const item = items.find(i => i.id === drinkId);
      if (item) total += item.price * quantity;
    }

    return total;
  }

  if (loading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.title}>Take Order</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading today's menu...</Text>
        </View>
      </Screen>
    );
  }

  if (error || items.length === 0) {
    return (
      <Screen style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.title}>Take Order</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'No menu available'}</Text>
          <Pressable style={styles.retryButton} onPress={fetchTodaysMenu}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Take Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.dateBar}>
        <Ionicons name="calendar" size={20} color="#0ea5e9" />
        <Text style={styles.dateText}>Menu for {serviceDate}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Starters Section */}
        {starters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Starters</Text>
            <View style={styles.optionsGrid}>
              {starters.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.optionCard,
                    selectedStarter === item.id && styles.optionCardSelected
                  ]}
                  onPress={() => setSelectedStarter(selectedStarter === item.id ? null : item.id)}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionLabel}>Option {item.meal_option}</Text>
                    <Ionicons 
                      name={selectedStarter === item.id ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={selectedStarter === item.id ? "#10b981" : "#94a3b8"} 
                    />
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>KSh {item.price.toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Main Meals Section */}
        {(mains.A.meat || mains.B.meat) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Main Meals</Text>
            <View style={styles.optionsGrid}>
              {(['A', 'B'] as const).map((option) => {
                const main = mains[option];
                if (!main.meat) return null;
                
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.optionCard,
                      selectedMain === option && styles.optionCardSelected
                    ]}
                    onPress={() => setSelectedMain(selectedMain === option ? null : option)}
                  >
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionLabel}>Option {option}</Text>
                      <Ionicons 
                        name={selectedMain === option ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={selectedMain === option ? "#10b981" : "#94a3b8"} 
                      />
                    </View>
                    <View style={styles.mainComponents}>
                      <Text style={styles.componentText}>🍖 {main.meat?.name}</Text>
                      <Text style={styles.componentText}>🍚 {main.carb?.name}</Text>
                      <Text style={styles.componentText}>🥬 {main.veg?.name}</Text>
                    </View>
                    <Text style={styles.itemPrice}>KSh {main.price?.toFixed(2)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Desserts Section */}
        {desserts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desserts</Text>
            <View style={styles.optionsGrid}>
              {desserts.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.optionCard,
                    selectedDessert === item.id && styles.optionCardSelected
                  ]}
                  onPress={() => setSelectedDessert(selectedDessert === item.id ? null : item.id)}
                >
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionLabel}>Option {item.meal_option}</Text>
                    <Ionicons 
                      name={selectedDessert === item.id ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={selectedDessert === item.id ? "#10b981" : "#94a3b8"} 
                    />
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>KSh {item.price.toFixed(2)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Drinks Section */}
        {drinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Drinks</Text>
            <View style={styles.drinksList}>
              {drinks.map((item) => (
                <View key={item.id} style={styles.drinkCard}>
                  <View style={styles.drinkInfo}>
                    <Text style={styles.drinkName}>{item.name}</Text>
                    <Text style={styles.drinkPrice}>KSh {item.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <Pressable
                      style={styles.quantityButton}
                      onPress={() => handleDrinkQuantityChange(item.id, -1)}
                    >
                      <Ionicons name="remove" size={20} color="#0f172a" />
                    </Pressable>
                    <Text style={styles.quantityText}>{selectedDrinks[item.id] || 0}</Text>
                    <Pressable
                      style={styles.quantityButton}
                      onPress={() => handleDrinkQuantityChange(item.id, 1)}
                    >
                      <Ionicons name="add" size={20} color="#0f172a" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar with Total and Add Button */}
      <View style={styles.bottomBar}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>KSh {calculateTotal().toFixed(2)}</Text>
        </View>
        <Pressable 
          style={[styles.addButton, calculateTotal() === 0 && styles.addButtonDisabled]} 
          onPress={handleAddToOrder}
          disabled={calculateTotal() === 0}
        >
          <Text style={styles.addButtonText}>Add to Order</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#e0f2fe',
    borderBottomWidth: 1,
    borderBottomColor: '#bae6fd',
  },
  dateText: {
    fontSize: 14,
    color: '#0c4a6e',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  optionCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  mainComponents: {
    gap: 4,
    marginBottom: 8,
  },
  componentText: {
    fontSize: 14,
    color: '#475569',
  },
  drinksList: {
    gap: 12,
  },
  drinkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  drinkInfo: {
    flex: 1,
  },
  drinkName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 2,
  },
  drinkPrice: {
    fontSize: 14,
    color: '#64748b',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    minWidth: 24,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  addButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#10b981',
    borderRadius: 10,
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
