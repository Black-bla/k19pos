import ModalBox from '@/components/ModalBox';
import Screen from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { supabase } from "@/lib/supabase";
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { MenuItem } from "../../lib/types";

type MenuSlot = {
  id: string;
  category: 'STARTER' | 'MAIN_MEAL' | 'DESSERT' | 'DRINKS';
  option: 'A' | 'B';
  item?: MenuItem;
  // For main meals
  carbohydrate?: MenuItem;
  meat?: MenuItem;
  vegetable?: MenuItem;
};

interface MenuEditScreenProps {
  serviceDate: string;
  onClose: () => void;
}

export default function MenuEditScreen({ serviceDate: initialServiceDate, onClose }: MenuEditScreenProps) {
  const auth = useAuth();
  const ownerId = auth.user?.id || '';
  const isOwner = !!auth.user?.id;
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [drinks, setDrinks] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MenuSlot | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  
  // Main meal component states
  const [carbName, setCarbName] = useState("");
  const [meatName, setMeatName] = useState("");
  const [vegName, setVegName] = useState("");
  
  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  
  // Service date state
  const [originalServiceDate, setOriginalServiceDate] = useState<string>(initialServiceDate);
  const [serviceDate, setServiceDate] = useState<string>(initialServiceDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Define the fixed slots for starters, mains, and desserts
  const menuSlots: MenuSlot[] = [
    { id: 'starter-a', category: 'STARTER', option: 'A' },
    { id: 'starter-b', category: 'STARTER', option: 'B' },
    { id: 'main-a', category: 'MAIN_MEAL', option: 'A' },
    { id: 'main-b', category: 'MAIN_MEAL', option: 'B' },
    { id: 'dessert-a', category: 'DESSERT', option: 'A' },
    { id: 'dessert-b', category: 'DESSERT', option: 'B' },
  ];

  useEffect(() => {
    if (!isOwner) {
      onClose();
      return;
    }
    // Only fetch when screen first loads, using original date
    fetchMenu();
  }, []);

  async function handleDateChange(newDate: string) {
    if (!isOwner) return;
    if (newDate !== serviceDate && menu.length > 0) {
      // Update all existing menu items to the new date
      const { error } = await supabase
        .from('menu_items')
        .update({ service_date: newDate })
        .eq('created_by', ownerId)
        .eq('service_date', serviceDate);
      
      if (error) {
        Alert.alert('Error', 'Failed to update menu date: ' + error.message);
        return;
      }
    }
    setServiceDate(newDate);
  }

  async function fetchMenu() {
    if (!isOwner) {
      setLoading(false);
      return;
    }

    if (!ownerId) {
      setMenu([]);
      setDrinks([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq('created_by', ownerId)
      .eq('service_date', originalServiceDate)
      .order("name");
    if (data) {
      setMenu(data.filter(item => item.category !== 'DRINKS'));
      setDrinks(data.filter(item => item.category === 'DRINKS'));
    }
    setLoading(false);
  }

  async function handleAddMenuItem() {
    if (!isOwner) {
      Alert.alert('View only', 'You can only edit menus you created.');
      return;
    }
    if (!selectedSlot) {
      Alert.alert("Error", "No slot selected");
      return;
    }
    
    const isEditing = !!editingId;

    // Handle main meal with components
    if (selectedSlot.category === 'MAIN_MEAL') {
      if (!meatName.trim() || !carbName.trim() || !vegName.trim() || !newPrice.trim()) {
        Alert.alert("Error", "Please enter all components (meat, carbohydrate, vegetable) and total price");
        return;
      }
      
      const totalPrice = parseFloat(newPrice);
      if (isNaN(totalPrice)) {
        return Alert.alert("Error", "Invalid price format");
      }

      if (isEditing) {
        // Update existing main meal components
        // Find the existing items for this meal option
        const meatItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'MEAT' && m.meal_option === selectedSlot.option);
        const carbItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'CARBOHYDRATE' && m.meal_option === selectedSlot.option);
        const vegItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'VEGETABLE' && m.meal_option === selectedSlot.option);

        if (meatItem) {
          await supabase.from("menu_items").update({ name: meatName.trim(), price: totalPrice }).eq('id', meatItem.id);
        }
        if (carbItem) {
          await supabase.from("menu_items").update({ name: carbName.trim(), price: 0 }).eq('id', carbItem.id);
        }
        if (vegItem) {
          await supabase.from("menu_items").update({ name: vegName.trim(), price: 0 }).eq('id', vegItem.id);
        }
      } else {
        // Insert new main meal components
        const meatResult = await supabase.from("menu_items").insert({ 
          name: meatName.trim(), 
          price: totalPrice, 
          category: 'MAIN_MEAL', 
          subcategory: 'MEAT', 
          meal_option: selectedSlot.option, 
          available: true,
          created_by: ownerId,
          service_date: serviceDate
        });
        
        if (meatResult.error) {
          console.error('Meat insert error:', meatResult.error);
          Alert.alert("Error", "Failed to add meat: " + meatResult.error.message);
          return;
        }
        
        const carbResult = await supabase.from("menu_items").insert({ 
          name: carbName.trim(), 
          price: 0, 
          category: 'MAIN_MEAL', 
          subcategory: 'CARBOHYDRATE', 
          meal_option: selectedSlot.option, 
          available: true,
          created_by: ownerId,
          service_date: serviceDate
        });
        
        if (carbResult.error) {
          console.error('Carb insert error:', carbResult.error);
          Alert.alert("Error", "Failed to add carbohydrate: " + carbResult.error.message);
          return;
        }
        
        const vegResult = await supabase.from("menu_items").insert({ 
          name: vegName.trim(), 
          price: 0, 
          category: 'MAIN_MEAL', 
          subcategory: 'VEGETABLE', 
          meal_option: selectedSlot.option, 
          available: true,
          created_by: ownerId,
          service_date: serviceDate
        });
        
        if (vegResult.error) {
          console.error('Veg insert error:', vegResult.error);
          Alert.alert("Error", "Failed to add vegetable: " + vegResult.error.message);
          return;
        }
      }

      setCarbName("");
      setMeatName("");
      setVegName("");
      setNewPrice("");
    } else {
      // Handle other categories (STARTER, DESSERT, DRINKS)
      if (!newName.trim() || !newPrice.trim()) {
        Alert.alert("Error", "Please enter name and price");
        return;
      }
      const price = parseFloat(newPrice);
      if (isNaN(price)) return Alert.alert("Error", "Invalid price");
      
      if (isEditing) {
        // Update existing item
        const { error } = await supabase
          .from("menu_items")
          .update({ name: newName.trim(), price })
          .eq('id', editingId);
        
        if (error) {
          Alert.alert("Error", error.message);
          return;
        }
      } else {
        // Insert new item
        const { error } = await supabase.from("menu_items").insert({ 
          name: newName.trim(), 
          price, 
          category: selectedSlot?.category || 'DRINKS', 
          available: true,
          created_by: ownerId,
          service_date: serviceDate
        });
        
        if (error) {
          console.error('Insert error:', error);
          Alert.alert("Error", error.message);
          return;
        }
      }

      setNewName("");
      setNewPrice("");
    }
    
    setEditingId(null);
    setAddModalOpen(false);
    setSelectedSlot(null);
    fetchMenu();
  }

  async function handleRemoveMenuItem(id: string) {
    if (!isOwner) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) Alert.alert("Error", error.message);
    fetchMenu();
  }

  async function handleToggleAvailability(id: string, available: boolean) {
    if (!isOwner) return;
    await supabase.from('menu_items').update({ available: !available }).eq('id', id);
    fetchMenu();
  }

  async function handleEditPrice(id: string) {
    const price = parseFloat(editPrice);
    if (isNaN(price)) return;
    await supabase.from('menu_items').update({ price }).eq('id', id);
    setEditingId(null);
    setEditPrice("");
    fetchMenu();
  }

  function getItemForSlot(slot: MenuSlot): MenuItem | undefined {
    // For main meals, check if all three components exist
    if (slot.category === 'MAIN_MEAL') {
      const hasMeat = menu.some(m => m.category === 'MAIN_MEAL' && m.subcategory === 'MEAT' && m.meal_option === slot.option);
      const hasCarb = menu.some(m => m.category === 'MAIN_MEAL' && m.subcategory === 'CARBOHYDRATE' && m.meal_option === slot.option);
      const hasVeg = menu.some(m => m.category === 'MAIN_MEAL' && m.subcategory === 'VEGETABLE' && m.meal_option === slot.option);
      // Return a dummy item if all exist (to show as "filled")
      if (hasMeat && hasCarb && hasVeg) {
        return { id: slot.id, name: '', price: 0, category: 'MAIN_MEAL', available: true };
      }
      return undefined;
    }
    
    // For other categories, match by category and use option index
    const items = menu.filter(item => item.category === slot.category && !item.subcategory);
    return items[slot.option === 'A' ? 0 : 1];
  }

  function handleSlotPress(slot: MenuSlot) {
    const item = getItemForSlot(slot);
    if (item) {
      // Edit existing item
      setEditingId(item.id);
      setSelectedSlot(slot);

      // For main meals, load all components
      if (slot.category === 'MAIN_MEAL') {
        const meatItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'MEAT' && m.meal_option === slot.option);
        const carbItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'CARBOHYDRATE' && m.meal_option === slot.option);
        const vegItem = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'VEGETABLE' && m.meal_option === slot.option);
        
        setMeatName(meatItem?.name || '');
        setCarbName(carbItem?.name || '');
        setVegName(vegItem?.name || '');
        setNewPrice(meatItem?.price.toString() || '');
      } else {
        setNewName(item.name);
        setNewPrice(item.price.toString());
      }
      
      setAddModalOpen(true);
    } else {
      // Add new item - clear all state first
      setNewName("");
      setNewPrice("");
      setCarbName("");
      setMeatName("");
      setVegName("");
      setEditingId(null);
      setSelectedSlot(slot);
      setAddModalOpen(true);
    }
  }

  if (!isOwner) {
    return (
      <Screen style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Redirecting to menu view...</Text>
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
          <Text style={styles.title}>Menu Management</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <Text style={{ padding: 16 }}>Loading menu...</Text>
      ) : (
        <ScrollView style={styles.content}>
          {/* Service Date Selector */}
          <View style={styles.dateSection}>
            <Text style={styles.dateLabel}>Service Date:</Text>
            <Pressable 
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{serviceDate}</Text>
              <Ionicons name="calendar" size={20} color="#0ea5e9" />
            </Pressable>
          </View>
          
          {/* Fixed Menu Slots */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Starters (2 Options)</Text>
            <View style={styles.grid}>
              {menuSlots.filter(s => s.category === 'STARTER').map(slot => {
                const item = getItemForSlot(slot);
                return (
                  <Pressable
                    key={slot.id}
                    style={styles.menuSlotCard}
                    onPress={() => handleSlotPress(slot)}
                  >
                    <View style={styles.slotHeader}>
                      <Text style={styles.optionLabel}>Option {slot.option}</Text>
                      <Ionicons name={item ? "checkmark-circle" : "add-circle-outline"} size={24} color={item ? "#10b981" : "#94a3b8"} />
                    </View>
                    {item ? (
                      <>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>KSh {item.price.toFixed(2)}</Text>
                      </>
                    ) : (
                      <Text style={styles.emptyText}>Tap to add</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Main Meals (2 Options)</Text>
            <View style={styles.grid}>
              {menuSlots.filter(s => s.category === 'MAIN_MEAL').map(slot => {
                const carb = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'CARBOHYDRATE' && m.meal_option === slot.option);
                const meat = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'MEAT' && m.meal_option === slot.option);
                const veg = menu.find(m => m.category === 'MAIN_MEAL' && m.subcategory === 'VEGETABLE' && m.meal_option === slot.option);
                const hasAll = carb && meat && veg;
                
                return (
                  <Pressable
                    key={slot.id}
                    style={styles.menuSlotCard}
                    onPress={() => handleSlotPress(slot)}
                  >
                    <View style={styles.slotHeader}>
                      <Text style={styles.optionLabel}>Option {slot.option}</Text>
                      <Ionicons name={hasAll ? "checkmark-circle" : "add-circle-outline"} size={24} color={hasAll ? "#10b981" : "#94a3b8"} />
                    </View>
                    {hasAll ? (
                      <View style={styles.mainMealComponents}>
                        <Text style={styles.componentText}>🍖 {meat.name}</Text>
                        <Text style={styles.componentText}>🍚 {carb.name}</Text>
                        <Text style={styles.componentText}>🥬 {veg.name}</Text>
                        <Text style={styles.itemPrice}>KSh {meat.price.toFixed(2)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.emptyText}>Tap to add meal</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desserts (2 Options)</Text>
            <View style={styles.grid}>
              {menuSlots.filter(s => s.category === 'DESSERT').map(slot => {
                const item = getItemForSlot(slot);
                return (
                  <Pressable
                    key={slot.id}
                    style={styles.menuSlotCard}
                    onPress={() => handleSlotPress(slot)}
                  >
                    <View style={styles.slotHeader}>
                      <Text style={styles.optionLabel}>Option {slot.option}</Text>
                      <Ionicons name={item ? "checkmark-circle" : "add-circle-outline"} size={24} color={item ? "#10b981" : "#94a3b8"} />
                    </View>
                    {item ? (
                      <>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>KSh {item.price.toFixed(2)}</Text>
                      </>
                    ) : (
                      <Text style={styles.emptyText}>Tap to add</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Drinks Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Drinks</Text>
              {isOwner ? (
                <Pressable 
                  style={styles.addDrinkBtn}
                  onPress={() => {
                    setSelectedSlot({ id: 'drink', category: 'DRINKS' as any, option: 'A' });
                    setAddModalOpen(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addDrinkText}>Add Drink</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.drinksList}>
              {drinks.map(drink => (
                <View key={drink.id} style={styles.drinkCard}>
                  <View style={styles.drinkInfo}>
                    <Text style={styles.drinkName}>{drink.name}</Text>
                    <Text style={styles.drinkPrice}>KSh {drink.price.toFixed(2)}</Text>
                  </View>
                  {isOwner ? (
                    <Pressable 
                      style={styles.removeDrinkBtn}
                      onPress={() => handleRemoveMenuItem(drink.id)}
                    >
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      {addModalOpen && (
        <ModalBox
          title={editingId ? (selectedSlot?.category === 'DRINKS' ? "Edit Drink" : selectedSlot?.category === 'MAIN_MEAL' ? `Edit Main Meal - Option ${selectedSlot?.option}` : `Edit ${selectedSlot?.category} - Option ${selectedSlot?.option}`) : (selectedSlot?.category === 'DRINKS' ? "Add Drink" : selectedSlot?.category === 'MAIN_MEAL' ? `Add Main Meal - Option ${selectedSlot?.option}` : `Add ${selectedSlot?.category} - Option ${selectedSlot?.option}`)}
          onClose={() => {
            setAddModalOpen(false);
            setSelectedSlot(null);
            setEditingId(null);
            setNewName("");
            setNewPrice("");
            setCarbName("");
            setMeatName("");
            setVegName("");
          }}
          onConfirm={handleAddMenuItem}
          confirmLabel={editingId ? "Save Changes" : "Add Item"}
        >
          <View style={styles.modalContent}>
            {selectedSlot?.category === 'MAIN_MEAL' ? (
              <>
                <Text style={styles.componentTitle}>🍖 Meat</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Chicken, Beef, Fish"
                  value={meatName}
                  onChangeText={setMeatName}
                  autoFocus
                />
                
                <Text style={styles.componentTitle}>🍚 Carbohydrate</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Rice, Ugali, Chapati"
                  value={carbName}
                  onChangeText={setCarbName}
                />
                
                <Text style={styles.componentTitle}>🥬 Vegetable</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Sukuma, Cabbage, Spinach"
                  value={vegName}
                  onChangeText={setVegName}
                />
                
                <Text style={styles.inputLabel}>Total Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Total price for the meal"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter item name"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                
                <Text style={styles.inputLabel}>Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter price"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="numeric"
                />
              </>
            )}
          </View>
        </ModalBox>
      )}
      
      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal transparent visible={true} animationType="fade">
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Service Date</Text>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#1e293b" />
                </Pressable>
              </View>
              <Calendar
                current={serviceDate}
                onDayPress={(day) => {
                  handleDateChange(day.dateString);
                  setShowDatePicker(false);
                }}
                markedDates={{
                  [serviceDate]: {
                    selected: true,
                    selectedColor: '#0ea5e9',
                    selectedTextColor: '#fff'
                  }
                }}
                theme={{
                  backgroundColor: '#fff',
                  calendarBackground: '#fff',
                  textSectionTitleColor: '#1e293b',
                  textSectionTitleDisabledColor: '#94a3b8',
                  selectedDayBackgroundColor: '#0ea5e9',
                  selectedDayTextColor: '#fff',
                  todayTextColor: '#0ea5e9',
                  todayBackgroundColor: '#f0f9ff',
                  dayTextColor: '#1e293b',
                  textDisabledColor: '#cbd5e1',
                  dotColor: '#0ea5e9',
                  selectedDotColor: '#fff',
                  arrowColor: '#0ea5e9',
                  disabledArrowColor: '#cbd5e1',
                  monthTextColor: '#1e293b',
                  indicatorColor: '#0ea5e9',
                  textDayFontFamily: 'System',
                  textMonthFontSize: 16,
                  textMonthFontWeight: '600',
                  textDayHeaderFontSize: 13,
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuSlotCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0ea5e9',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  addDrinkBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addDrinkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  drinksList: {
    gap: 10,
  },
  drinkCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drinkInfo: {
    flex: 1,
  },
  drinkName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  drinkPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  removeDrinkBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  modalContent: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  mainMealComponents: {
    gap: 6,
    marginTop: 8,
  },
  componentText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  componentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
  },
  dateSection: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    gap: 16,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  datePickerInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  datePickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  datePickerConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
  },
  datePickerConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
  },
});
