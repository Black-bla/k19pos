
export type TableStatus = 'available' | 'occupied';

export interface Table {
  id: string;
  name: string;
  seat_count: number;
  status: TableStatus;
  waiter_id?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: 'STARTER' | 'MAIN_MEAL' | 'DESSERT' | 'DRINKS';
  available: boolean;
  is_combo?: boolean;
  combo_items?: string[];
  subcategory?: 'CARBOHYDRATE' | 'MEAT' | 'VEGETABLE';
  meal_option?: 'A' | 'B';
}

export type GuestStatus = 'pending' | 'ordered' | 'served' | 'cleared' | 'pending_payment' | 'paid';

export interface Guest {
  id: string;
  table_id: string;
  seat_number: number;
  guest_name: string;
  waiter_id?: string;
  status: GuestStatus;
  created_at: string;
}

export interface GuestOrder {
  id: string;
  guest_id: string;
  menu_item_id: string;
  menu_item_name: string;
  price_snapshot: number;
  quantity: number;
  subtotal?: number;
}

export interface OrderItem {
  id: string;
  order_id?: string | null;
  guest_id?: string | null;
  menu_item_id: string;
  menu_item_name: string;
  price_snapshot: number;
  quantity: number;
  subtotal?: number;
}

export interface Order {
  id: string;
  table?: Table | null;
  guest_count?: number;
  total?: number;
}

export interface Reservation {
  id: string;
  name: string;
  phone?: string | null;
  date: string; // yyyy-mm-dd format
  time: string; // HH:mm format
  table_id?: string | null;
  status: 'pending' | 'seated' | 'cancelled' | 'no_show';
  party_size?: number | null;
  notes?: string | null;
}

export interface DailyMenu {
  id: string;
  date: string;
  category: 'STARTER' | 'MAIN_MEAL' | 'DESSERT';
  option_label: 'Option A' | 'Option B';
  menu_item_id: string;
}

export interface Payment {
  id: string;
  guest_id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
}

export interface StaffProfile {
  id: string; // FK to auth.users.id
  name?: string | null;
  role?: 'staff' | 'admin' | string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
}

// Phase 6: Reporting Types
export interface OrderWithDetails {
  guest_id: string;
  guest_name: string;
  table_name: string;
  waiter_name?: string | null;
  menu_item_name: string;
  quantity: number;
  price_snapshot: number;
  subtotal: number;
  order_status?: string;
  created_at: string;
}

export interface WaiterSummary {
  waiter_id: string;
  waiter_name: string;
  order_count: number;
  total_sales: number;
  total_tips: number;
  net_revenue: number;
  avg_check_size: number;
  tables_served: number;
}

export interface CategorySummary {
  category: string;
  item_count: number;
  quantity_sold: number;
  total_revenue: number;
  percentage_of_sales: number;
}

export interface DailyReportSummary {
  date: string;
  total_orders: number;
  total_guests: number;
  gross_sales: number;
  total_tips: number;
  net_revenue: number;
  avg_check_size: number;
  items_sold: number;
  tables_occupied: number;
  payment_success_rate: number;
}

export interface DetailedReport {
  summary: DailyReportSummary;
  orders: OrderWithDetails[];
  waiters: WaiterSummary[];
  categories: CategorySummary[];
}
