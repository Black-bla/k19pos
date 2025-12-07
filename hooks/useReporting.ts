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
          menu_item_name,
          menu_item_id,
          guest:guests(
            id,
            guest_name,
            table_id,
            waiter_id,
            created_at,
            table:tables(name)
          )
        `
        );

      if (ordersError) throw ordersError;

      // Filter and sort orders by date on the client side
      const filteredOrders = (ordersData || [])
        .filter((order: any) => {
          const guestDate = order.guest?.created_at;
          if (!guestDate) return false;
          const orderDate = new Date(guestDate).toISOString().split('T')[0];
          return orderDate === date;
        })
        .sort((a: any, b: any) => {
          const dateA = new Date(a.guest?.created_at || 0).getTime();
          const dateB = new Date(b.guest?.created_at || 0).getTime();
          return dateA - dateB;
        });

      // 1b. Fetch all staff profiles to map waiter IDs to names
      const { data: staffData, error: staffError } = await supabase
        .from('staff_profiles')
        .select('id, name');

      if (staffError) throw staffError;

      // Create a map of waiter IDs to names
      const waiterNameMap = new Map<string, string>();
      if (staffData) {
        staffData.forEach((staff: any) => {
          waiterNameMap.set(staff.id, staff.name || 'Unknown');
        });
      }

      // 1c. Fetch menu items to get category information
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, category');

      if (menuError) throw menuError;

      // Create a map of menu item IDs to categories
      const menuCategoryMap = new Map<string, string>();
      if (menuData) {
        menuData.forEach((item: any) => {
          menuCategoryMap.set(item.id, item.category || 'Other');
        });
      }

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
      if (filteredOrders && filteredOrders.length > 0) {
        filteredOrders.forEach((order: any) => {
          const subtotal = (order.price_snapshot || 0) * order.quantity;
          grossSales += subtotal;

          const guest = order.guest;
          const table = guest?.table;
          const waiter_id = guest?.waiter_id;
          const waiter_name = waiter_id ? waiterNameMap.get(waiter_id) : null;
          const menu_item_name = order.menu_item_name || 'Unknown Item';
          const menu_item_id = order.menu_item_id;
          const created_at = guest?.created_at || new Date().toISOString();

          orders.push({
            guest_id: guest?.id || '',
            guest_name: guest?.guest_name || 'Unknown',
            table_name: table?.name || 'N/A',
            waiter_name: waiter_name || null,
            menu_item_name: menu_item_name,
            quantity: order.quantity,
            price_snapshot: order.price_snapshot,
            subtotal,
            created_at: created_at,
          });

          // Track waiter sales
          if (guest?.waiter_id) {
            const waiterId = guest.waiter_id;
            const waiterName = waiterNameMap.get(waiterId) || 'Unknown';
            if (!waiterMap.has(waiterId)) {
              waiterMap.set(waiterId, {
                waiter_id: waiterId,
                waiter_name: waiterName,
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
          const category = menu_item_id ? menuCategoryMap.get(menu_item_id) : 'Other';
          const categoryName = category || 'Other';
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
              category: categoryName,
              item_count: 1,
              quantity_sold: order.quantity,
              total_revenue: subtotal,
              percentage_of_sales: 0,
            });
          } else {
            const categorySummary = categoryMap.get(categoryName)!;
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
