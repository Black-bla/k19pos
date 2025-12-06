import Screen from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { deleteMenuItemsByDateLocal, getAllMenuItemsLocal, getStaffProfileByIdLocal, insertMenuItemLocal } from '@/lib/localDataAccess';
import { syncWithSupabase } from '@/lib/syncManager';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MenuEditScreen from './MenuEditScreen';
import MenuViewScreen from './MenuViewScreen';

type MenuSummary = {
  service_date: string;
  item_count: number;
  has_starters: boolean;
  has_mains: boolean;
  has_desserts: boolean;
  has_drinks: boolean;
  created_by?: string;
  creator_name?: string;
};

export default function MenuListScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  const userHasMenu = menus.some(menu => menu.created_by === auth.user?.id);
  const canCreate = !!auth.user;

  useEffect(() => {
    // Wait for auth/database initialization before fetching
    if (!auth.loading) {
      fetchMenus();
    }
  }, [auth.loading]);

  async function fetchMenus() {
    setLoading(true);
    try {
      // Fetch from local database first (works offline)
      const data = await getAllMenuItemsLocal() as any[];
      
      if (data) {
        // Group by service_date
        const grouped = data.reduce((acc, item) => {
          const date = item.service_date;
          if (!acc[date]) {
            acc[date] = {
              service_date: date,
              item_count: 0,
              has_starters: false,
              has_mains: false,
              has_desserts: false,
              has_drinks: false,
              created_by: item.created_by,
              creator_name: 'Unknown Creator',
            };
          }
          acc[date].item_count++;
          if (item.category === 'STARTER') acc[date].has_starters = true;
          if (item.category === 'MAIN_MEAL') acc[date].has_mains = true;
          if (item.category === 'DESSERT') acc[date].has_desserts = true;
          if (item.category === 'DRINKS') acc[date].has_drinks = true;
          return acc;
        }, {} as Record<string, MenuSummary>);

        const menus = Object.values(grouped) as MenuSummary[];

        // Fetch creator names from local database
        const creatorIds = [...new Set(menus.map((m: MenuSummary) => m.created_by))];
        const creatorMap: Record<string, string> = {};
        
        for (const id of creatorIds) {
          if (id) {
            const profile = await getStaffProfileByIdLocal(id) as any;
            if (profile) {
              creatorMap[id] = profile.name;
            }
          }
        }

        menus.forEach((menu: MenuSummary) => {
          menu.creator_name = menu.created_by ? creatorMap[menu.created_by] || 'Unknown Creator' : 'Unknown Creator';
        });

        setMenus(menus);
      }
    } catch (error) {
      console.error('Error fetching menus:', error);
    } finally {
      setLoading(false);
    }
    
    // Trigger background sync
    syncWithSupabase().catch(console.error);
  }

  function handleCreateMenu() {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedOwnerId(auth.user?.id || '');
    setEditModalOpen(true);
  }

  async function handleQuickCreateMenu() {
    if (!auth.user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setCreating(true);
    const serviceDate = new Date().toISOString().split('T')[0];

    try {
      // Create default items in local database (works offline)
      const defaultItems = [
        // Starters
        { name: 'Starter Option A', category: 'STARTER', price: 150 },
        { name: 'Starter Option B', category: 'STARTER', price: 150 },
        // Main Meal Option A - price only on meat
        { name: 'Chicken', category: 'MAIN_MEAL', subcategory: 'MEAT', meal_option: 'A', price: 500 },
        { name: 'Rice', category: 'MAIN_MEAL', subcategory: 'CARBOHYDRATE', meal_option: 'A', price: 0 },
        { name: 'Sukuma Wiki', category: 'MAIN_MEAL', subcategory: 'VEGETABLE', meal_option: 'A', price: 0 },
        // Main Meal Option B - price only on meat
        { name: 'Beef', category: 'MAIN_MEAL', subcategory: 'MEAT', meal_option: 'B', price: 450 },
        { name: 'Ugali', category: 'MAIN_MEAL', subcategory: 'CARBOHYDRATE', meal_option: 'B', price: 0 },
        { name: 'Cabbage', category: 'MAIN_MEAL', subcategory: 'VEGETABLE', meal_option: 'B', price: 0 },
        // Desserts
        { name: 'Dessert Option A', category: 'DESSERT', price: 100 },
        { name: 'Dessert Option B', category: 'DESSERT', price: 100 },
        // Drinks (at least 1)
        { name: 'Water', category: 'DRINKS', price: 50 },
        { name: 'Soda', category: 'DRINKS', price: 100 },
      ];

      for (const item of defaultItems) {
        await insertMenuItemLocal({
          ...item,
          available: true,
          created_by: auth.user.id,
          service_date: serviceDate,
        });
      }

      Alert.alert('Success', 'Menu created for ' + serviceDate + ' (will sync when online)');
      fetchMenus();
      setCreating(false);
    } catch (e) {
      console.error('Error creating menu:', e);
      Alert.alert('Error', 'Failed to create menu');
      setCreating(false);
    }
  }

  function handleEditMenu(serviceDate: string) {
    setSelectedDate(serviceDate);
    setSelectedOwnerId(auth.user?.id || '');
    setEditModalOpen(true);
  }

  function handleOpenMenu(serviceDate: string, ownerId?: string) {
    setSelectedDate(serviceDate);
    setSelectedOwnerId(ownerId || auth.user?.id || '');
    setViewModalOpen(true);
  }

  async function handleDeleteMenu(serviceDate: string) {
    Alert.alert(
      'Delete Menu',
      `Are you sure you want to delete the menu for ${serviceDate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from local database (works offline)
              await deleteMenuItemsByDateLocal(auth.user?.id!, serviceDate);
              Alert.alert('Success', 'Menu deleted (will sync when online)');
              fetchMenus();
            } catch (error) {
              console.error('Error deleting menu:', error);
              Alert.alert('Error', 'Failed to delete menu');
            }
          }
        }
      ]
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Menus</Text>
        <View style={styles.headerButtons}>
          {canCreate && !userHasMenu ? (
            <>
              <Pressable 
                style={styles.quickCreateButton} 
                onPress={handleQuickCreateMenu}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size={20} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                    <Text style={styles.quickCreateButtonText}>Quick Create</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.addButton} onPress={handleCreateMenu} disabled={creating}>
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.addButtonText}>Custom</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading menus...</Text>
      ) : menus.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Menus Yet</Text>
          <Text style={styles.emptyText}>Create your first menu to get started</Text>
          {canCreate ? (
            <Pressable style={styles.emptyButton} onPress={handleCreateMenu}>
              <Text style={styles.emptyButtonText}>Create Menu</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {menus.map((menu) => (
            <Pressable
              key={menu.service_date}
              style={styles.menuCard}
              onPress={() => handleOpenMenu(menu.service_date, menu.created_by)}
            >
              <View style={styles.menuHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuDate}>{menu.service_date}</Text>
                  <Text style={styles.menuCreator}>{menu.creator_name || 'Unknown Creator'}</Text>
                  <Text style={styles.menuCount}>{menu.item_count} items</Text>
                </View>
                <View style={styles.menuActions}>
                  {menu.created_by === auth.user?.id && (
                    <>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => handleEditMenu(menu.service_date)}
                      >
                        <Ionicons name="create-outline" size={20} color="#0ea5e9" />
                      </Pressable>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDeleteMenu(menu.service_date)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.menuCategories}>
                {menu.has_starters && (
                  <View style={styles.categoryBadge}>
                    <Ionicons name="fast-food" size={14} color="#10b981" />
                    <Text style={styles.categoryText}>Starters</Text>
                  </View>
                )}
                {menu.has_mains && (
                  <View style={styles.categoryBadge}>
                    <Ionicons name="restaurant" size={14} color="#0ea5e9" />
                    <Text style={styles.categoryText}>Mains</Text>
                  </View>
                )}
                {menu.has_desserts && (
                  <View style={styles.categoryBadge}>
                    <Ionicons name="ice-cream" size={14} color="#f59e0b" />
                    <Text style={styles.categoryText}>Desserts</Text>
                  </View>
                )}
                {menu.has_drinks && (
                  <View style={styles.categoryBadge}>
                    <Ionicons name="wine" size={14} color="#8b5cf6" />
                    <Text style={styles.categoryText}>Drinks</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* View Menu Modal */}
      <Modal
        visible={viewModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setViewModalOpen(false);
          fetchMenus();
        }}
      >
        <MenuViewScreen
          serviceDate={selectedDate}
          ownerId={selectedOwnerId}
          onClose={() => {
            setViewModalOpen(false);
            fetchMenus();
          }}
          onEdit={(date) => {
            setViewModalOpen(false);
            setSelectedDate(date);
            setEditModalOpen(true);
          }}
        />
      </Modal>

      {/* Edit Menu Modal */}
      <Modal
        visible={editModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setEditModalOpen(false);
          fetchMenus();
        }}
      >
        <MenuEditScreen
          serviceDate={selectedDate}
          onClose={() => {
            setEditModalOpen(false);
            fetchMenus();
          }}
        />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  quickCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  quickCreateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingText: {
    padding: 16,
    textAlign: 'center',
    color: '#64748b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuCreator: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  menuCount: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  menuCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  categoryText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});
