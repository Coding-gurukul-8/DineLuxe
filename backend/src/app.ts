import './types/express-augmentation';
import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import hpp from 'hpp';
import { corsMiddleware } from './config/cors';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';

// ─── Route modules ───────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import branchesRoutes from './modules/branches/branches.routes';
import brandingRoutes from './modules/branding/branding.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import customerPreferencesRoutes from './modules/customer-preferences/customer-preferences.routes';
import deliveryRoutes from './modules/delivery/delivery.routes';
import dynamicPricingRoutes from './modules/dynamic-pricing/dynamic-pricing.routes';
import floorLayoutRoutes from './modules/floor-layout/floor-layout.routes';
import geoRoutes from './modules/geo/geo.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import kitchenRoutes from './modules/kitchen/kitchen.routes';
import loyaltyRoutes from './modules/loyalty/loyalty.routes';
import menuRoutes from './modules/menu/menu.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import orderItemsRoutes from './modules/order-items/order-items.routes';
import ordersRoutes from './modules/orders/orders.routes';
import ownerCrmRoutes from './modules/owner-crm/owner-crm.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import queueRoutes from './modules/queue/queue.routes';
import recommendationsRoutes from './modules/recommendations/recommendations.routes';
import recipeIngredientsRoutes from './modules/recipe-ingredients/recipe-ingredients.routes';
import reportsRoutes from './modules/reports/reports.routes';
import restaurantsRoutes from './modules/restaurants/restaurants.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import shiftsRoutes from './modules/shifts/shifts.routes';
import staffRoutes from './modules/staff/staff.routes';
import staffFeedbackRoutes from './modules/staff-feedback/staff-feedback.routes';
import staffingRoutes from './modules/staffing/staffing.routes';
import supportRoutes from './modules/support/support.routes';
import tablesRoutes from './modules/tables/tables.routes';
import usersRoutes from './modules/users/users.routes';
import wasteLogRoutes from './modules/waste-log/waste-log.routes';

const app: Express = express();

// ─── Trust proxy (must be set before rate-limiters & other middleware) ───────
// Tells Express to trust the X-Forwarded-For header set by reverse proxies
// (nginx, Render, Railway, AWS ALB, etc.) so express-rate-limit can identify
// real client IPs instead of the proxy IP.
// Use `1` to trust the first hop (direct proxy). For multiple proxy hops,
// set to the number of trusted hops, or a specific IP/CIDR string.
app.set('trust proxy', 1);

// ─── Global middleware (ORDER MATTERS) ──────────────────────────────────────
app.use(helmet());
app.use(corsMiddleware);
app.use(compression());
app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(hpp());

// ─── Metrics (must be before routes to capture all request timings) ──────────
app.use(metricsMiddleware);

// ─── Routes ─────────────────────────────────────────────────────────────────
const API = '/api/v1';

// Root route
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Welcome to DineLuxe API',
    docs: 'API documentation available at /api/v1/health',
    frontend: config.FRONTEND_URL,
  });
});

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/analytics`, analyticsRoutes);
app.use(`${API}/bookings`, bookingsRoutes);
app.use(`${API}/branches`, branchesRoutes);
app.use(`${API}/restaurant/:id/branding`, brandingRoutes);
app.use(`${API}/restaurants/:id/branding`, brandingRoutes);
app.use(`${API}/chatbot`, chatbotRoutes);
app.use(`${API}/customer-preferences`, customerPreferencesRoutes);
app.use(`${API}/delivery`, deliveryRoutes);
app.use(`${API}/dynamic-pricing`, dynamicPricingRoutes);
app.use(`${API}/floor-layout`, floorLayoutRoutes);
app.use(`${API}/geo`, geoRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/kitchen`, kitchenRoutes);
app.use(`${API}/loyalty`, loyaltyRoutes);
app.use(`${API}/menu`, menuRoutes);
app.use(`${API}/notifications`, notificationsRoutes);
app.use(`${API}/order-items`, orderItemsRoutes);
app.use(`${API}/orders`, ordersRoutes);
app.use(`${API}`, ownerCrmRoutes);
app.use(`${API}/payments`, paymentsRoutes);
app.use(`${API}/queue`, queueRoutes);
app.use(`${API}/recommendations`, recommendationsRoutes);
app.use(`${API}/recipe-ingredients`, recipeIngredientsRoutes);
app.use(`${API}/reports`, reportsRoutes);
app.use(`${API}/restaurants`, restaurantsRoutes);
app.use(`${API}/reviews`, reviewsRoutes);
app.use(`${API}/shifts`, shiftsRoutes);
app.use(`${API}/staff`, staffRoutes);
app.use(`${API}/staff-feedback`, staffFeedbackRoutes);
app.use(`${API}/staffing`, staffingRoutes);
app.use(`${API}/support`, supportRoutes);
app.use(`${API}/tables`, tablesRoutes);
app.use(`${API}/users`, usersRoutes);
app.use(`${API}/waste-log`, wasteLogRoutes);

// ─── Health checks ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get(`${API}/health`, (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 & Error handlers (must be last) ────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;