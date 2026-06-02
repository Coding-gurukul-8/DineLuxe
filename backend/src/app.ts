import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { supabaseAdmin } from './config/supabase';

// ════════════════════════════════════════════════════════════════════════════
// ROUTE IMPORTS — fully audited (Parts 1 + 2 + 3)
// ════════════════════════════════════════════════════════════════════════════

// ── Core / Auth ──────────────────────────────────────────────────────────────
import authRoutes             from './modules/auth/auth.routes';
import userRoutes             from './modules/users/users.routes';

// ── Restaurant & Branding ────────────────────────────────────────────────────
import restaurantRoutes       from './modules/restaurants/restaurants.routes';
import branchRoutes           from './modules/branches/branches.routes';
import brandingRoutes         from './modules/branding/branding.routes';

// ── Menu ─────────────────────────────────────────────────────────────────────
import menuRoutes             from './modules/menu/menu.routes';

// ── Tables & Floor ───────────────────────────────────────────────────────────
import tableRoutes            from './modules/tables/tables.routes';
import floorLayoutRoutes      from './modules/floor-layout/floor-layout.routes';

// ── Orders & Order Items ─────────────────────────────────────────────────────
import orderRoutes            from './modules/orders/orders.routes';
import orderItemRoutes        from './modules/order-items/order-items.routes';

// ── Kitchen ───────────────────────────────────────────────────────────────────
import kitchenRoutes          from './modules/kitchen/kitchen.routes';

// ── Payments ─────────────────────────────────────────────────────────────────
import paymentRoutes          from './modules/payments/payments.routes';
import paymentGatewayRoutes   from './modules/payment-gateway/payment-gateway.routes';

// ── Bookings & Queue ─────────────────────────────────────────────────────────
import bookingRoutes          from './modules/bookings/bookings.routes';
import queueRoutes            from './modules/queue/queue.routes';

// ── Delivery ─────────────────────────────────────────────────────────────────
import deliveryRoutes         from './modules/delivery/delivery.routes';

// ── Reviews ──────────────────────────────────────────────────────────────────
import reviewRoutes           from './modules/reviews/reviews.routes';

// ── Inventory & Waste Log ────────────────────────────────────────────────────
import inventoryRoutes        from './modules/inventory/inventory.routes';
import wasteLogRoutes         from './modules/waste-log/waste-log.routes';

// ── Staff, Shifts & Staffing ─────────────────────────────────────────────────
import staffRoutes            from './modules/staff/staff.routes';
import shiftRoutes            from './modules/shifts/shifts.routes';
import staffingRoutes         from './modules/staffing/staffing.routes';
import staffFeedbackRoutes    from './modules/staff-feedback/staff-feedback.routes';

// ── Reports & Analytics ──────────────────────────────────────────────────────
import reportRoutes           from './modules/reports/reports.routes';
import analyticsRoutes        from './modules/analytics/analytics.routes';

// ── Geo ───────────────────────────────────────────────────────────────────────
import geoRoutes              from './modules/geo/geo.routes';

// ── Loyalty ───────────────────────────────────────────────────────────────────
import loyaltyRoutes          from './modules/loyalty/loyalty.routes';

// ── Support & Notifications ──────────────────────────────────────────────────
import supportRoutes          from './modules/support/support.routes';
import notificationRoutes     from './modules/notifications/notifications.routes';

// ── Admin ─────────────────────────────────────────────────────────────────────
import adminRoutes            from './modules/admin/admin.routes';

// ── Part 1 Additions ─────────────────────────────────────────────────────────
import recipeIngredientRoutes from './modules/recipe-ingredients/recipe-ingredients.routes';
import dynamicPricingRoutes   from './modules/dynamic-pricing/dynamic-pricing.routes';
import customerPrefRoutes     from './modules/customer-preferences/customer-preferences.routes';
import recommendationRoutes   from './modules/recommendations/recommendations.routes';
import chatbotRoutes          from './modules/chatbot/chatbot.routes';
import socialDiningRoutes     from './modules/social-dining/social-dining.routes';
import couponRoutes           from './modules/coupons/coupons.routes';

// ── Part 2 Additions ─────────────────────────────────────────────────────────
import waiterAssignmentRoutes from './modules/waiter-assignment/waiter-assignment.routes';
import ownerCrmRoutes         from './modules/owner-crm/order-crm.route';

// ── Background Jobs ───────────────────────────────────────────────────────────
import './jobs/booking-reminder';
import './jobs/inventory-alert';
import './jobs/no-show-cancel';
import './jobs/overdue-orders';
import './jobs/queue-recalculate';
import './jobs/delivery-acceptance-timeout';
import './jobs/report-export';

// ════════════════════════════════════════════════════════════════════════════
// APP SETUP
// ════════════════════════════════════════════════════════════════════════════

const app: express.Application = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    xPoweredBy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
        connectSrc: ["'self'", process.env.SUPABASE_URL ?? '', 'wss:'].filter(Boolean),
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ════════════════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION — all modules wired
// ════════════════════════════════════════════════════════════════════════════

const API = '/api/v1';

// ── Core / Auth ──────────────────────────────────────────────────────────────
app.use(`${API}/auth`,                   authRoutes);
app.use(`${API}/users`,                  userRoutes);

// ── Restaurant & Branding ────────────────────────────────────────────────────
app.use(`${API}/restaurants`,            restaurantRoutes);
app.use(`${API}/branches`,               branchRoutes);
app.use(`${API}/branding`,               brandingRoutes);

// ── Menu ─────────────────────────────────────────────────────────────────────
app.use(`${API}/menus`,                  menuRoutes);

// ── Tables & Floor ───────────────────────────────────────────────────────────
app.use(`${API}/tables`,                 tableRoutes);
app.use(`${API}/floor-layout`,           floorLayoutRoutes);

// ── Orders & Order Items ─────────────────────────────────────────────────────
app.use(`${API}/orders`,                 orderRoutes);
app.use(`${API}/order-items`,            orderItemRoutes);

// ── Kitchen ───────────────────────────────────────────────────────────────────
app.use(`${API}/kitchen`,                kitchenRoutes);

// ── Payments ─────────────────────────────────────────────────────────────────
app.use(`${API}/payments`,               paymentRoutes);
app.use(`${API}/payment-gateway`,        paymentGatewayRoutes);

// ── Bookings & Queue ─────────────────────────────────────────────────────────
app.use(`${API}/bookings`,               bookingRoutes);
app.use(`${API}/queue`,                  queueRoutes);

// ── Delivery ─────────────────────────────────────────────────────────────────
app.use(`${API}/delivery`,               deliveryRoutes);

// ── Reviews ──────────────────────────────────────────────────────────────────
app.use(`${API}/reviews`,                reviewRoutes);

// ── Inventory & Waste Log ────────────────────────────────────────────────────
app.use(`${API}/inventory`,              inventoryRoutes);
app.use(`${API}/waste-log`,              wasteLogRoutes);

// ── Staff, Shifts & Staffing ─────────────────────────────────────────────────
app.use(`${API}/staff`,                  staffRoutes);
app.use(`${API}/shifts`,                 shiftRoutes);
app.use(`${API}/staffing`,               staffingRoutes);
app.use(`${API}/staff-feedback`,         staffFeedbackRoutes);

// ── Reports & Analytics ──────────────────────────────────────────────────────
app.use(`${API}/reports`,                reportRoutes);
app.use(`${API}/analytics`,              analyticsRoutes);

// ── Geo ───────────────────────────────────────────────────────────────────────
app.use(`${API}/geo`,                    geoRoutes);

// ── Loyalty ───────────────────────────────────────────────────────────────────
app.use(`${API}/loyalty`,                loyaltyRoutes);

// ── Support & Notifications ──────────────────────────────────────────────────
app.use(`${API}/support`,                supportRoutes);
app.use(`${API}/notifications`,          notificationRoutes);

// ── Admin ─────────────────────────────────────────────────────────────────────
app.use(`${API}/admin`,                  adminRoutes);

// ── Part 1 — Phase 1 additions ───────────────────────────────────────────────
app.use(`${API}/recipe-ingredients`,     recipeIngredientRoutes);
app.use(`${API}/dynamic-pricing`,        dynamicPricingRoutes);
app.use(`${API}/customer-preferences`,   customerPrefRoutes);
app.use(`${API}/recommendations`,        recommendationRoutes);
app.use(`${API}/chatbot`,                chatbotRoutes);
app.use(`${API}/social-dining`,          socialDiningRoutes);
app.use(`${API}/coupons`,                couponRoutes);

// ── Part 2 — Phase 3 additions ───────────────────────────────────────────────
app.use(`${API}/waiter-assignment`,      waiterAssignmentRoutes);
app.use(`${API}/owner/customers`,        ownerCrmRoutes);   // owner-crm mounts at /owner/customers

// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ════════════════════════════════════════════════════════════════════════════
// MATERIALIZED VIEW REFRESH (every 60 min)
// ════════════════════════════════════════════════════════════════════════════

async function refreshMaterializedViews() {
  try {
    await supabaseAdmin.rpc('refresh_materialized_views');
    // Ensure this SQL function exists in your database:
    //
    //   CREATE OR REPLACE FUNCTION refresh_materialized_views()
    //   RETURNS void LANGUAGE plpgsql AS $$
    //   BEGIN
    //     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;
    //     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;
    //     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;
    //   END; $$;
    console.log('[cron] Materialized views refreshed');
  } catch (err) {
    console.error('[cron] Materialized view refresh failed:', err);
  }
}

void refreshMaterializedViews();
setInterval(() => { void refreshMaterializedViews(); }, 60 * 60 * 1000);

export default app;