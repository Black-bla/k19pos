
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
  phone: string;
  time: string; // ISO timestamp
  table_id: string;
  status: 'pending' | 'seated' | 'cancelled' | 'no_show';
  guest_name?: string;
  seat_number?: number;
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
