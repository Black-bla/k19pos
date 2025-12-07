import { supabase } from '@/lib/supabase';
import {
    CategorySummary,
    DailyReportSummary,
    DetailedReport,
    OrderWithDetails,
    WaiterSummary,
} from '@/lib/types';
import { useCallback, useState } from 'react';

export const useReporting = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyReport = useCallback(async (date: string): Promise<DetailedReport | null> => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch all orders for the day with guest and table info
      const { data: ordersData, error: ordersError } = await supabase
        .from('guest_orders')
        .select(
          `
          id,
          quantity,
          price_snapshot,
          guest:guests(
            id,
            guest_name,
            table_id,
            waiter_id,
            table:tables(name),
            waiter:staff_profiles(name)
          ),
          menu_items(
            name,
            category
          ),
          created_at
        `
        )
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // 2. Fetch all payments for the day
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, guest_id, amount, status, created_at')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`)
        .eq('status', 'success');

      if (paymentsError) throw paymentsError;

      // 3. Fetch all guests from orders for the day
      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('id, guest_name, table_id, waiter_id, created_at')
        .gte('created_at', `${date}T00:00:00`)
        .lt('created_at', `${date}T23:59:59`);

      if (guestsError) throw guestsError;

      // Process and aggregate data
      const orders: OrderWithDetails[] = [];
      const waiterMap = new Map<string, WaiterSummary>();
      const categoryMap = new Map<string, CategorySummary>();
      let grossSales = 0;
      let totalTips = 0;
      const tableIds = new Set<string>();
      const guestIds = new Set<string>();

      // Build orders array
      if (ordersData) {
        ordersData.forEach((order: any) => {
          const subtotal = (order.price_snapshot || 0) * order.quantity;
          grossSales += subtotal;

          const guest = order.guest;
          const table = guest?.table;
          const waiter = guest?.waiter;
          const menuItem = order.menu_items?.[0];

          orders.push({
            guest_id: guest?.id || '',
            guest_name: guest?.guest_name || 'Unknown',
            table_name: table?.name || 'N/A',
            waiter_name: waiter?.name || null,
            menu_item_name: menuItem?.name || 'Unknown Item',
            quantity: order.quantity,
            price_snapshot: order.price_snapshot,
            subtotal,
            created_at: order.created_at,
          });

          // Track waiter sales
          if (guest?.waiter_id && waiter) {
            const waiterId = guest.waiter_id;
            if (!waiterMap.has(waiterId)) {
              waiterMap.set(waiterId, {
                waiter_id: waiterId,
                waiter_name: waiter.name || 'Unknown',
                order_count: 0,
                total_sales: 0,
                total_tips: 0,
                net_revenue: 0,
                avg_check_size: 0,
                tables_served: 0,
              });
            }
            const waiterSummary = waiterMap.get(waiterId)!;
            waiterSummary.order_count += 1;
            waiterSummary.total_sales += subtotal;
          }

          // Track category sales
          const category = menuItem?.category || 'Other';
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              category,
              item_count: 1,
              quantity_sold: order.quantity,
              total_revenue: subtotal,
              percentage_of_sales: 0,
            });
          } else {
            const categorySummary = categoryMap.get(category)!;
            categorySummary.item_count += 1;
            categorySummary.quantity_sold += order.quantity;
            categorySummary.total_revenue += subtotal;
          }

          // Track unique tables and guests
          if (guest?.table_id) tableIds.add(guest.table_id);
          if (guest?.id) guestIds.add(guest.id);
        });
      }

      // Add tips from payments (tips would need to be added to payments table separately)
      // For now, tips are included in the payment amount
      if (paymentsData) {
        paymentsData.forEach((payment: any) => {
          totalTips += payment.amount || 0;
        });
      }

      // Calculate percentages
      categoryMap.forEach((cat) => {
        cat.percentage_of_sales = grossSales > 0 ? (cat.total_revenue / grossSales) * 100 : 0;
      });

      // Calculate waiter averages
      const uniqueWaiterTables = new Map<string, Set<string>>();
      orders.forEach((order) => {
        // This would need waiter_id tracking - using guest data
      });

      waiterMap.forEach((waiter) => {
        waiter.avg_check_size = waiter.order_count > 0 ? waiter.total_sales / waiter.order_count : 0;
        waiter.net_revenue = waiter.total_sales + waiter.total_tips;
      });

      // Success rate calculation
      const totalPayments = paymentsData?.length || 0;
      const successPayments = paymentsData?.filter((p: any) => p.status === 'success').length || 0;
      const paymentSuccessRate = totalPayments > 0 ? (successPayments / totalPayments) * 100 : 0;

      // Build summary
      const summary: DailyReportSummary = {
        date,
        total_orders: orders.length,
        total_guests: guestIds.size,
        gross_sales: grossSales,
        total_tips: totalTips,
        net_revenue: grossSales + totalTips,
        avg_check_size: orders.length > 0 ? grossSales / guestIds.size : 0,
        items_sold: orders.reduce((sum, order) => sum + order.quantity, 0),
        tables_occupied: tableIds.size,
        payment_success_rate: paymentSuccessRate,
      };

      const reportData: DetailedReport = {
        summary,
        orders,
        waiters: Array.from(waiterMap.values()),
        categories: Array.from(categoryMap.values()),
      };

      setReport(reportData);
      return reportData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch report';
      setError(message);
      console.error('Error fetching report:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    report,
    loading,
    error,
    fetchDailyReport,
  };
};
