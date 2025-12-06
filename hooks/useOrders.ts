import { supabase } from '@/lib/supabase';
import { Order, OrderItem } from '@/lib/types';
import { useEffect, useState } from 'react';

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    const { data } = await supabase
      .from('orders')
      .select('*')
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
    if (data) setItems(data as OrderItem[]);
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
