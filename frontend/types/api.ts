/**
 * types/api.ts
 *
 * Frontend API response types derived from the Prisma schema.
 * Every field name matches what the Express controllers actually return.
 * Use these as the generic parameter to apiClient.get<T>() calls.
 */

// ─── Enums (mirror prisma enums) ─────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "host"
  | "waiter"
  | "chef"
  | "cashier"
  | "customer"
  | "delivery_partner"
  | "support";

export type TableStatus = "free" | "reserved" | "occupied" | "cleaning" | "maintenance";
export type OrderStatus = "created" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "closed" | "cancelled";
export type OrderType = "dine_in" | "delivery" | "takeaway";
export type BookingStatus = "pending" | "confirmed" | "arrived" | "seated" | "no_show" | "cancelled";
export type QueueStatus = "waiting" | "arrived" | "seated" | "no_show" | "cancelled";
export type PaymentMethod = "cash" | "card" | "upi" | "split" | "wallet";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type MenuItemStatus = "available" | "sold_out" | "hidden";
export type TableShape = "round" | "square" | "rectangle" | "booth";
export type NotificationType =
  | "order_update"
  | "booking_update"
  | "payment"
  | "queue_update"
  | "system_alert"
  | "promotional";
export type SentimentLabel = "positive" | "neutral" | "negative";
export type DeliveryStatus =
  | "assigned"
  | "accepted"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "failed";

// ─── Core models ──────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string | null;
  gst_number: string | null;
  status: "active" | "suspended" | "pending" | "inactive";
  created_at: string;
  updated_at: string;
  // Joined relations (present depending on endpoint)
  branches?: Branch[];
  branding?: RestaurantBranding | null;
}

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  manager_id: string | null;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  restaurant?: Pick<Restaurant, "id" | "name">;
}

export interface RestaurantBranding {
  id: string;
  restaurant_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  banner_url: string | null;
  tagline: string | null;
  font_family: string | null;
}

export interface Table {
  id: string;
  branch_id: string;
  label: string;
  capacity: number;
  floor_number: number;
  shape: TableShape;
  zone: string;
  photo_url: string | null;
  status: TableStatus;
  x_pos: number | null;
  y_pos: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  // Joined
  items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  category_id: string;
  branch_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  discounted_price: number | null;
  photo_url: string | null;
  dietary_tags: string[];
  allergens: string[];
  prep_time_minutes: number | null;
  status: MenuItemStatus;
  display_order: number;
  is_featured: boolean;
  addons: Array<{ name: string; extra_price: number }> | null;
  created_at: string;
  updated_at: string;
  // Joined
  category?: Pick<MenuCategory, "id" | "name">;
}

/** Full menu response returned by GET /menu/branch/:branchId */
export interface PublicMenu {
  categories: Array<MenuCategory & { items: MenuItem[] }>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  addons: Array<{ name: string; extra_price: number }> | null;
  status: string;
  prepared_at: string | null;
  served_at: string | null;
  created_at: string;
  // Joined
  menu_item?: Pick<MenuItem, "id" | "name" | "photo_url">;
}

export interface Order {
  id: string;
  table_id: string | null;
  customer_id: string | null;
  waiter_id: string | null;
  branch_id: string;
  order_type: OrderType;
  status: OrderStatus;
  special_instructions: string | null;
  created_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  updated_at: string;
  // Joined
  order_items?: OrderItem[];
  table?: Pick<Table, "id" | "label"> | null;
  payment?: Payment | null;
  /** Computed total — sum of (unit_price × quantity) across all items */
  total?: number;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  tax_amount: number | null;
  service_charge: number | null;
  discount_amount: number | null;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_ref: string | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  branch_id: string;
  table_id: string | null;
  people_count: number;
  arrival_time: string;
  status: BookingStatus;
  special_requests: string | null;
  arrived_at: string | null;
  seated_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  branch?: Pick<Branch, "id" | "name" | "address">;
  table?: Pick<Table, "id" | "label"> | null;
}

export interface QueueEntry {
  id: string;
  branch_id: string;
  user_id: string | null;
  table_id: string | null;
  people_count: number;
  position: number;
  status: QueueStatus;
  guest_name: string | null;
  guest_phone: string | null;
  arrived_at: string | null;
  seated_at: string | null;
  created_at: string;
  /** Computed by backend — estimated wait in minutes */
  estimated_wait_minutes?: number;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  employee_id: string | null;
  restaurant_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  force_password_change: boolean;
  profile_pic_url: string | null;
  last_login: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  branch_id: string;
  ingredient_name: string;
  unit: string;
  current_quantity: number;
  reorder_threshold: number;
  cost_per_unit: number | null;
  last_updated: string;
  /** Computed: current_quantity <= reorder_threshold */
  is_low_stock?: boolean;
}

export interface Review {
  id: string;
  user_id: string;
  restaurant_id: string;
  branch_id: string;
  order_id: string | null;
  overall_rating: number;
  text_review: string | null;
  photos: string[];
  sentiment_label: SentimentLabel | null;
  created_at: string;
  // Joined
  user?: { id: string; name: string };
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

/** Returned by GET /kitchen/branch/:branchId/tickets */
export interface KitchenTicket {
  id: string;
  order_id: string;
  branch_id: string;
  table_label: string | null;
  order_type: OrderType;
  status: OrderStatus;
  special_instructions: string | null;
  created_at: string;
  items: Array<{
    id: string;
    menu_item_id: string;
    name: string;
    quantity: number;
    notes: string | null;
    status: string;
  }>;
}

// ─── Computed / summary shapes ────────────────────────────────────────────────

/** Returned by GET /branches/:id/live-stats */
export interface BranchLiveStats {
  tables_total: number;
  tables_occupied: number;
  tables_available: number;
  queue_length: number;
  active_orders: number;
  revenue_today: number;
}

/** Returned by GET /loyalty/me */
export interface LoyaltyData {
  id: string;
  user_id: string;
  points: number;
  tier: string;
  pointsToNextReward: number;
  progressPercent: number;
}

/** Returned by GET /restaurants/:id/live-status */
export interface RestaurantLiveStatus {
  is_open: boolean;
  queue_length: number;
  wait_minutes: number;
}

/** Returned by POST /payments/initiate */
export interface PaymentInitResponse {
  payment_id: string;
  razorpay_order_id?: string;
  amount: number;
  currency: string;
}
// ─── User (base) ──────────────────────────────────────────────────────────────
// Minimal User shape used as a join target across multiple new interfaces below.
// Defined here to avoid forward-reference issues; does not replace any
// existing Staff interface.

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  profile_pic_url: string | null;
}

// ─── Dynamic Pricing ──────────────────────────────────────────────────────────

export type DiscountType = 'percentage' | 'fixed_amount';

export interface DynamicPricingRule {
  id: string;
  branch_id: string;
  menu_item_id: string | null;
  menu_category_id: string | null;
  rule_name: string;
  discount_type: DiscountType;
  discount_value: number;
  days_of_week: number[];           // 0=Sun, 1=Mon, …, 6=Sat
  start_time: string;               // "HH:MM:SS"
  end_time: string;                 // "HH:MM:SS"
  is_active: boolean;
  created_at: string;
  // Joined
  menu_item?: Pick<MenuItem, 'id' | 'name' | 'price'> | null;
  menu_category?: Pick<MenuCategory, 'id' | 'name'> | null;
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  branch_id: string;
  staff_id: string;
  date: string;                     // "YYYY-MM-DD"
  start_time: string;               // "HH:MM" or "HH:MM:SS"
  end_time: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined
  staff?: Pick<User, 'id' | 'first_name' | 'last_name' | 'role'>;
}

// ─── Customer Preferences ─────────────────────────────────────────────────────

export type DietaryPreference =
  | 'vegan'
  | 'vegetarian'
  | 'halal'
  | 'jain'
  | 'gluten_free'
  | 'keto'
  | 'high_protein';

export type AllergenType =
  | 'nuts'
  | 'dairy'
  | 'gluten'
  | 'eggs'
  | 'soy'
  | 'shellfish'
  | 'fish';

export interface DietaryProfile {
  user_id: string;
  preferences: DietaryPreference[];
  allergies: AllergenType[];
  updated_at: string;
}

export interface CustomerTablePreference {
  id: string;
  user_id: string;
  branch_id: string;
  preferred_table_id: string | null;
  preferred_table_label: string | null;
  times_selected: number;
  last_selected: string;
  branch_name?: string;
}

// ─── Staff Feedback ───────────────────────────────────────────────────────────

export interface StaffFeedback {
  id: string;
  restaurant_id: string;
  branch_id: string | null;
  role_label: string;               // "A Waiter", "A Chef" — never the real name
  feedback_text: string;
  sentiment_label: SentimentLabel | null;
  sentiment_score: number | null;
  is_flagged: boolean;
  created_at: string;
  branch_name?: string;
}

export interface StaffFeedbackStats {
  items: StaffFeedback[];
  total: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  high_negative_branches: string[];
}

// ─── AI Recommendations ───────────────────────────────────────────────────────

export interface RestaurantRecommendation {
  id: string;
  name: string;
  cuisine_type: string | null;
  logo_url: string | null;
  primary_color: string | null;
  branch_id: string;
  lat: number | null;
  lon: number | null;
  distance_meters: number;
  avg_rating: number;
  orders_last_7d: number;
  score: number;
  match_reason: string;
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'ai' | 'agent';
  content: string;
  timestamp: string;
}

export interface ChatbotResponse {
  response: string;
  isEscalated: boolean;
  ticketId: string | null;
}

// ─── Staffing Prediction ──────────────────────────────────────────────────────

export interface HourlyPrediction {
  hour: number;
  predicted_orders: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface StaffingRecommendation {
  date: string;
  peak_hours: number[];
  recommendations: Array<{
    hour: number;
    waiters: number;
    chefs: number;
    cashiers: number;
  }>;
  current_scheduled: {
    waiter: number;
    chef: number;
    cashier: number;
    host: number;
  };
  warnings: string[];
}

// ─── Social Dining ────────────────────────────────────────────────────────────

export interface SocialDiningGroup {
  id: string;
  booking_id: string;
  invite_code: string;
  organizer_id: string;
  max_members: number;
  is_open: boolean;
  created_at: string;
  members?: SocialDiningMember[];
}

export interface SocialDiningMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  pre_orders: Array<{ menu_item_id: string; quantity: number; notes?: string }> | null;
  user?: Pick<User, 'id' | 'first_name' | 'last_name' | 'profile_pic_url'>;
}