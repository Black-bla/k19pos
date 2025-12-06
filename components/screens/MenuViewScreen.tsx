import Screen from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { MenuItem } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface MenuViewScreenProps {
  serviceDate: string;
  ownerId: string;
  onClose: () => void;
  onEdit?: (serviceDate: string) => void;
}

export default function MenuViewScreen({ serviceDate, ownerId, onClose, onEdit }: MenuViewScreenProps) {
  const auth = useAuth();
  const router = useRouter();
  const isOwner = !!auth.user?.id && auth.user.id === ownerId;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [creatorName, setCreatorName] = useState<string>('Unknown Creator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [serviceDate, ownerId]);

  async function fetchData() {
    if (!ownerId) {
      setError('Missing menu owner');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('created_by', ownerId)
        .eq('service_date', serviceDate)
        .order('name');

      if (menuError) throw menuError;
      setItems(data || []);

      const { data: profile, error: profileError } = await supabase
        .from('staff_profiles')
        .select('name')
        .eq('id', ownerId)
        .maybeSingle();

      if (!profileError && profile?.name) {
        setCreatorName(profile.name);
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
    const options: Record<'A' | 'B', { meat?: MenuItem; carb?: MenuItem; veg?: MenuItem }> = { A: {}, B: {} };
    items.filter(i => i.category === 'MAIN_MEAL').forEach(i => {
      if (i.meal_option === 'A' || i.meal_option === 'B') {
        if (i.subcategory === 'MEAT') options[i.meal_option].meat = i;
        if (i.subcategory === 'CARBOHYDRATE') options[i.meal_option].carb = i;
        if (i.subcategory === 'VEGETABLE') options[i.meal_option].veg = i;
      }
    });
    return options;
  }, [items]);

  function renderHeader() {
    return (
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Menu</Text>
        <View style={{ width: 40 }} />
      </View>
    );
  }

  function renderMeta() {
    return (
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar" size={16} color="#0ea5e9" />
          <Text style={styles.metaText}>{serviceDate}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="person" size={16} color="#0ea5e9" />
          <Text style={styles.metaText}>{creatorName}</Text>
        </View>
        {isOwner ? (
          <Pressable
            style={styles.editButton}
            onPress={() => {
              if (onEdit) {
                onEdit(serviceDate);
              }
            }}
          >
            <Ionicons name="create-outline" size={16} color="#0ea5e9" />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderStarters() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Starters</Text>
        <View style={styles.chipGrid}>
          {starters.map(item => (
            <View key={item.id} style={styles.chipCard}>
              <Text style={styles.chipName}>{item.name}</Text>
              <Text style={styles.chipPrice}>KSh {item.price.toFixed(2)}</Text>
            </View>
          ))}
          {starters.length === 0 && <Text style={styles.emptyText}>No starters</Text>}
        </View>
      </View>
    );
  }

  function renderMains() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Meals</Text>
        <View style={styles.grid}>
          {(['A', 'B'] as const).map(option => {
            const meat = mains[option].meat;
            const carb = mains[option].carb;
            const veg = mains[option].veg;
            const hasAll = meat && carb && veg;
            return (
              <View key={option} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.optionLabel}>Option {option}</Text>
                  <Ionicons
                    name={hasAll ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={20}
                    color={hasAll ? '#10b981' : '#f59e0b'}
                  />
                </View>
                {hasAll ? (
                  <View style={styles.mainList}>
                    <Text style={styles.mainLine}>🍖 {meat?.name}</Text>
                    <Text style={styles.mainLine}>🍚 {carb?.name}</Text>
                    <Text style={styles.mainLine}>🥬 {veg?.name}</Text>
                    <Text style={styles.mainPrice}>KSh {meat?.price.toFixed(2)}</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Incomplete main</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  function renderDesserts() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desserts</Text>
        <View style={styles.chipGrid}>
          {desserts.map(item => (
            <View key={item.id} style={styles.chipCard}>
              <Text style={styles.chipName}>{item.name}</Text>
              <Text style={styles.chipPrice}>KSh {item.price.toFixed(2)}</Text>
            </View>
          ))}
          {desserts.length === 0 && <Text style={styles.emptyText}>No desserts</Text>}
        </View>
      </View>
    );
  }

  function renderDrinks() {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Drinks</Text>
          <Text style={styles.sectionHint}>{drinks.length} item{drinks.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={styles.list}>
          {drinks.map(drink => (
            <View key={drink.id} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{drink.name}</Text>
                <Text style={styles.rowMeta}>Available: {drink.available ? 'Yes' : 'No'}</Text>
              </View>
              <Text style={styles.rowPrice}>KSh {drink.price.toFixed(2)}</Text>
            </View>
          ))}
          {drinks.length === 0 && <Text style={styles.emptyText}>No drinks</Text>}
        </View>
      </View>
    );
  }

  return (
    <Screen style={styles.container}>
      {renderHeader()}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {renderMeta()}
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No menu items for this date.</Text>
          ) : (
            <>
              {renderStarters()}
              {renderMains()}
              {renderDesserts()}
              {renderDrinks()}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaRow: {
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  editButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cce9f9',
    backgroundColor: '#f0f9ff',
  },
  editButtonText: {
    color: '#0ea5e9',
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748b',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  mainList: {
    gap: 4,
  },
  mainLine: {
    fontSize: 14,
    color: '#1e293b',
  },
  mainPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0ea5e9',
    marginTop: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    minWidth: '45%',
  },
  chipName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  chipPrice: {
    fontSize: 13,
    color: '#0ea5e9',
    fontWeight: '700',
    marginTop: 4,
  },
  list: {
    gap: 10,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  rowMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  rowPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0ea5e9',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
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
  errorText: {
    color: '#ef4444',
    fontWeight: '700',
  },
});
