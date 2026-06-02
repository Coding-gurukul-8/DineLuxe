import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { supabaseAdmin } from './config/supabase';

// ── Core / Auth
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';

// ── Restaurant & Menu
import restaurantRoutes from './modules/restaurants/restaurants.routes';
import menuRoutes from './modules/menu/menu.routes';

// ── Orders & Tables
import orderRoutes from './modules/orders/orders.routes';
import tableRoutes from './modules/tables/tables.routes';

// ── Staff & Roles
import staffRoutes from './modules/staff/staff.routes';

// ── Branches & Inventory
import branchRoutes from './modules/branches/branches.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';

// ── Delivery & Customers
import deliveryRoutes from './modules/delivery/delivery.routes';
import customerPreferencesRoutes from './modules/customer-preferences/customer-preferences.routes';

// ── Reservations & Feedback
// ── Reports & Analytics
import reportRoutes from './modules/reports/reports.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';

// ── Notifications & Settings
import notificationRoutes from './modules/notifications/notifications.routes';

// ── Part 2 — Phase 3 Modules
import waiterAssignmentRoutes from './modules/waiter-assignment/waiter-assignment.routes';
import paymentGatewayRoutes from './modules/payment-gateway/payment-gateway.routes';

// ── Background Jobs
import './jobs/delivery-acceptance-timeout';
import './jobs/report-export';

const app: express.Application = express();

// ── Middleware
// Security headers
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

const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── API prefix
const API = '/api/v1';

// ── Core / Auth routes
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);

// ── Restaurant & Menu routes
app.use(`${API}/restaurants`, restaurantRoutes);
app.use(`${API}/menus`, menuRoutes);

// ── Orders & Tables routes
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/tables`, tableRoutes);

// ── Staff & Roles routes
app.use(`${API}/staff`, staffRoutes);

// ── Branches & Inventory routes
app.use(`${API}/branches`, branchRoutes);
app.use(`${API}/inventory`, inventoryRoutes);

// ── Delivery & Customers routes
app.use(`${API}/delivery`, deliveryRoutes);
app.use(`${API}/customer-preferences`, customerPreferencesRoutes);

// ── Reports & Analytics routes
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/analytics`, analyticsRoutes);

// ── Notifications & Settings routes
app.use(`${API}/notifications`, notificationRoutes);

// ── Part 2 — Phase 3 Modules
app.use(`${API}/waiter-assignment`, waiterAssignmentRoutes);
app.use(`${API}/payment-gateway`, paymentGatewayRoutes);

// ── Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start materialized view refresh loop (every hour)
async function refreshMaterializedViews() {
  try {
    await supabaseAdmin.rpc('refresh_materialized_views');
    // Supabase RPC — create this function once in your database:
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
setInterval(() => {
  void refreshMaterializedViews();
}, 60 * 60 * 1000);

export default app;