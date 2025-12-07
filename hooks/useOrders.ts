import { supabase } from '@/lib/supabase';
import { Order, OrderItem } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ORDER_CACHE_KEY = (orderId: string) => `order-cache-${orderId}-v1`;
const ORDER_ITEMS_CACHE_KEY = (orderId: string) => `order-items-cache-${orderId}-v1`;

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateFromCache();
    fetchOrder();
    fetchItems();
    const itemsChannel = supabase
      .channel(`order-items-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => {
        fetchItems();
        fetchOrder();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [orderId]);

  async function fetchOrder() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      if (data) {
        setOrder(data);
        await AsyncStorage.setItem(ORDER_CACHE_KEY(orderId), JSON.stringify(data));
      }
    } catch (err) {
      console.warn('fetchOrder failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(ORDER_CACHE_KEY(orderId));
        if (cached) setOrder(JSON.parse(cached));
      } catch (cacheErr) {
        console.warn('failed to load cached order after fetch error', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchItems() {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at');

      if (error) throw error;
      if (data) {
        setItems(data as OrderItem[]);
        await AsyncStorage.setItem(ORDER_ITEMS_CACHE_KEY(orderId), JSON.stringify(data));
      }
    } catch (err) {
      console.warn('fetchItems failed, using cache', err);
      try {
        const cached = await AsyncStorage.getItem(ORDER_ITEMS_CACHE_KEY(orderId));
        if (cached) setItems(JSON.parse(cached));
      } catch (cacheErr) {
        console.warn('failed to load cached order items after fetch error', cacheErr);
      }
    }
  }

  async function hydrateFromCache() {
    try {
      const [orderCache, itemsCache] = await Promise.all([
        AsyncStorage.getItem(ORDER_CACHE_KEY(orderId)),
        AsyncStorage.getItem(ORDER_ITEMS_CACHE_KEY(orderId)),
      ]);

      if (orderCache) setOrder(JSON.parse(orderCache));
      if (itemsCache) setItems(JSON.parse(itemsCache));

      if (orderCache || itemsCache) {
        setLoading(false);
      }
    } catch (err) {
      console.warn('hydrateFromCache failed', err);
    }
  }

  async function updateQuantity(itemId: string, change: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + change;
    if (newQty <= 0) {
      await supabase.from('order_items').delete().eq('id', itemId);
    } else {
      await supabase.from('order_items').update({ quantity: newQty }).eq('id', itemId);
    }
  }

  async function removeItem(itemId: string) {
    await supabase.from('order_items').delete().eq('id', itemId);
  }

  return { order, items, loading, updateQuantity, removeItem };
}
