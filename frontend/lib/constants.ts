import type { Icon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Bell,
  Calendar,
  CreditCard,
  DollarSign,
  Package,
  Truck,
  Users,
} from "lucide-react";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  OWNER: "owner",
  MANAGER: "manager",
  HOST: "host",
  WAITER: "waiter",
  CHEF: "chef",
  CASHIER: "cashier",
  CUSTOMER: "customer",
  DELIVERY_PARTNER: "delivery_partner",
  SUPPORT: "support",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

// ─────────────────────────────────────────────────────────────────────────────
// Display-ready constants (label/color/bgColor), used by dashboard UI.
// ─────────────────────────────────────────────────────────────────────────────

export const USER_ROLES = {
  owner: { label: "Owner", color: "#E8A020" },
  manager: { label: "Manager", color: "#2980B9" },
  waiter: { label: "Waiter", color: "#1E7E34" },
  chef: { label: "Chef", color: "#C0392B" },
  cashier: { label: "Cashier", color: "#7F8C8D" },
  host: { label: "Host", color: "#F39C12" },
  delivery_partner: { label: "Delivery Partner", color: "#2980B9" },
  customer: { label: "Customer", color: "#7F8C8D" },
  super_admin: { label: "Super Admin", color: "#1A3C5E" },
  admin: { label: "Admin", color: "#1A3C5E" },
} as const;

export type UserRoleKey = keyof typeof USER_ROLES;

export const ORDER_STATUSES = {
  created: { label: "Created", color: "#2980B9" },
  confirmed: { label: "Confirmed", color: "#1A3C5E" },
  preparing: { label: "Preparing", color: "#F39C12" },
  ready: { label: "Ready", color: "#1E7E34" },
  served: { label: "Served", color: "#1E7E34" },
  paid: { label: "Paid", color: "#1E7E34" },
  closed: { label: "Closed", color: "#7F8C8D" },
  cancelled: { label: "Cancelled", color: "#C0392B" },
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUSES;

export const BOOKING_STATUSES = {
  pending: { label: "Pending", color: "#2980B9" },
  confirmed: { label: "Confirmed", color: "#1A3C5E" },
  arrived: { label: "Arrived", color: "#F39C12" },
  seated: { label: "Seated", color: "#1E7E34" },
  completed: { label: "Completed", color: "#7F8C8D" },
  no_show: { label: "No Show", color: "#C0392B" },
  cancelled: { label: "Cancelled", color: "#C0392B" },
} as const;

export type BookingStatusKey = keyof typeof BOOKING_STATUSES;

export const TABLE_STATUSES = {
  available: { label: "Available", color: "#1E7E34", bgColor: "rgba(30,126,52,0.12)" },
  reserved: { label: "Reserved", color: "#2980B9", bgColor: "rgba(41,128,185,0.12)" },
  occupied: { label: "Occupied", color: "#C0392B", bgColor: "rgba(192,57,43,0.12)" },
  cleaning: { label: "Cleaning", color: "#F1C40F", bgColor: "rgba(241,196,15,0.12)" },
  maintenance: { label: "Maintenance", color: "#7F8C8D", bgColor: "rgba(127,140,141,0.12)" },
} as const;

export type TableStatusKey = keyof typeof TABLE_STATUSES;

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatible enums (existing imports in codebase).
// ─────────────────────────────────────────────────────────────────────────────

export const ORDER_STATUS = {
  CREATED: "created",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  PAID: "paid",
  CLOSED: "closed",
  CANCELLED: "cancelled",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  ARRIVED: "arrived",
  SEATED: "seated",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const TABLE_STATUS = {
  FREE: "free",
  RESERVED: "reserved",
  OCCUPIED: "occupied",
  CLEANING: "cleaning",
  MAINTENANCE: "maintenance",
} as const;
export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];

// Payment methods
export const PAYMENT_METHODS = {
  CASH: "cash",
  CARD: "card",
  UPI: "upi",
  ONLINE: "online",
  SPLIT: "split",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const ORDER_TYPES = {
  DINE_IN: "dine_in",
  DELIVERY: "delivery",
  TAKEAWAY: "takeaway",
} as const;
export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

export const COLORS = {
  PRIMARY: "#1A3C5E",
  ACCENT: "#E8A020",
  SUCCESS: "#1E7E34",
  WARNING: "#F39C12",
  DANGER: "#C0392B",
  INFO: "#2980B9",
  NEUTRAL: "#7F8C8D",
  CLEANING: "#F1C40F",
  DARK_BG: "#111111",
  DARK_SURFACE: "#1A1A1A",
} as const;

export const TABLE_STATUS_COLORS: Record<TableStatus, string> = {
  free: COLORS.SUCCESS,
  reserved: COLORS.INFO,
  occupied: COLORS.DANGER,
  cleaning: COLORS.CLEANING,
  maintenance: COLORS.NEUTRAL,
};

export const WS_EVENTS = {
  ORDER_CREATED: "order_created",
  ORDER_CANCELLED: "order_cancelled",
  ORDER_STATUS_UPDATED: "order_status_updated",
  KITCHEN_STATUS_UPDATED: "kitchen_status_updated",
  FOOD_READY: "food_ready",
  TABLE_STATUS_CHANGED: "table_status_changed",
  QUEUE_UPDATED: "queue_updated",
  ARRIVAL_DETECTED: "arrival_detected",
  QUEUE_POSITION_UPDATE: "queue_position_update",
  PAYMENT_CONFIRMED: "payment_confirmed",
  INVENTORY_LOW: "inventory_low",
  OVERDUE_ORDER: "overdue_order",
  CUSTOMER_CALL_WAITER: "customer_call_waiter",
  BRANDING_UPDATED: "branding_updated",
  LOCATION_UPDATE: "location_update",
  DELIVERY_COMPLETE: "delivery_complete",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant filtering constants
// ─────────────────────────────────────────────────────────────────────────────

export const CUISINE_TYPES = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Italian",
  "Mexican",
  "Continental",
  "Thai",
  "Japanese",
  "Fast Food",
  "Cafe",
  "Bakery",
  "Street Food",
  "Seafood",
  "Mughlai",
  "Mediterranean",
  "Korean",
  "American",
  "Fine Dining",
] as const;

export type CuisineType = (typeof CUISINE_TYPES)[number];

export const DIETARY_LABELS = {
  vegan: { label: "Vegan", icon: "🌱" },
  vegetarian: { label: "Vegetarian", icon: "🥗" },
  halal: { label: "Halal", icon: "🕌" },
  jain: { label: "Jain", icon: "🪷" },
  gluten_free: { label: "Gluten-Free", icon: "🚫🌾" },
  kosher: { label: "Kosher", icon: "✡️" },
} as const;

export type DietaryLabelKey = keyof typeof DIETARY_LABELS;

export const ALLERGEN_LABELS = {
  nuts: { label: "Nuts", icon: "🥜" },
  dairy: { label: "Dairy", icon: "🥛" },
  gluten: { label: "Gluten", icon: "🌾" },
  eggs: { label: "Eggs", icon: "🥚" },
  soy: { label: "Soy", icon: "🫘" },
  shellfish: { label: "Shellfish", icon: "🦐" },
} as const;

export type AllergenLabelKey = keyof typeof ALLERGEN_LABELS;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export const NOTIFICATION_TYPES = {
  order: { label: "Order", icon: Package },
  booking: { label: "Booking", icon: Calendar },
  payment: { label: "Payment", icon: CreditCard },
  loyalty: { label: "Loyalty", icon: BadgeCheck },
  system: { label: "System", icon: Activity },
  delivery: { label: "Delivery", icon: Truck },
} as const;


export type NotificationTypeKey = keyof typeof NOTIFICATION_TYPES;

// Legacy dietary/allergen tags used elsewhere
export const DIETARY_TAGS = ["veg", "non_veg", "vegan", "halal", "jain", "gluten_free"] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const ALLERGENS = ["nuts", "dairy", "gluten", "eggs", "soy", "shellfish"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const CACHE_TTL = {
  BRANDING: 60 * 60 * 1000,
  MENU: 10 * 60 * 1000,
  NEARBY_SEARCH: 5 * 60 * 1000,
  DASHBOARD_STATS: 5 * 60 * 1000,
} as const;

export const GEO_ARRIVAL_RADIUS_METERS = 150;
export const PAGINATION = { DEFAULT_LIMIT: 20, MAX_LIMIT: 100 } as const;

