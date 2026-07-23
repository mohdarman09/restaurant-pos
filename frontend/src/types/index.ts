export interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  restaurantId: string;
  outletId: string | null;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  image_url: string | null;
  price: string;
  cost_price: string;
  is_veg: boolean;
  is_available: boolean;
  category_id: string;
  category_name: string;
  tax_rate: string | null;
}

export interface DiningTable {
  id: string;
  name: string;
  capacity: number;
  pos_x: number;
  pos_y: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  merged_into: string | null;
  floor_name: string;
  active_order_id: string | null;
  active_order_total: string | null;
}

export interface DashboardSummary {
  sales_today: string;
  sales_week: string;
  sales_month: string;
  total_orders_today: string;
  completed_orders: string;
  pending_orders: string;
  cancelled_orders: string;
  avg_order_value: string;
  total_customers: string;
  low_stock_alerts: { id: string; name: string; current_stock: string; reorder_level: string }[];
  best_selling_items: { id: string; name: string; units_sold: string; revenue: string }[];
}

export interface SalesTrendPoint {
  date: string;
  revenue: string;
  orders: string;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  lineId: string;
  productId?: string;
  comboMealId?: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  addons: SelectedAddon[];
  notes?: string;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  order_type: 'dine_in' | 'take_away' | 'delivery';
  status: string;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  service_charge_amount: string;
  total_amount: string;
  table_name?: string | null;
  created_at: string;
}

export interface KitchenTicketItem {
  id: string;
  productName: string;
  quantity: string;
  kitchenStatus: 'new' | 'preparing' | 'ready' | 'served';
  notes: string | null;
}

export interface KitchenTicket {
  order_id: string;
  order_number: string;
  order_type: string;
  table_name: string | null;
  is_priority: boolean;
  created_at: string;
  items: KitchenTicketItem[];
}
