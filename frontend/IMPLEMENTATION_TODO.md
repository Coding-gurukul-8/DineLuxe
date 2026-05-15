# Frontend Implementation TODO - All Phases

## Phase 1: Foundation & Design System
- [x] Install missing dependencies (framer-motion, lottie-react, react-easy-crop, qrcode.react, date-fns, react-day-picker, next-pwa, class-variance-authority, nanoid, use-debounce, react-intersection-observer)
- [x] Update tailwind.config.ts with design tokens (colors, typography, spacing, shadows)
- [x] Update globals.css with CSS custom properties and animation keyframes
- [x] Create core reusable components:
  - [x] StatusBadge
  - [x] FoodCard
  - [x] OrderTicketCard
  - [x] TableUnit
  - [x] QueueCard
  - [x] AlertBanner
  - [x] KPICard
  - [x] SkeletonCard
  - [x] ImageCropper
  - [x] ConfirmDialog
  - [x] DataTable
  - [x] SentimentBadge
  - [x] RoleBadge
  - [x] EmptyState
  - [x] LoadingOverlay

## Phase 2: Authentication & Onboarding (M1)
- [x] Splash screen with Lottie animation
- [x] Enhanced Login screen with show/hide password toggle
- [x] Enhanced Signup wizard with animations, password strength meter, email check
- [x] OTP input with 6 boxes, auto-advance, shake animation
- [x] Forgot password 3-screen flow
- [x] Restaurant onboarding 5-step wizard with live preview

## Phase 3: Layout & Navigation
- [x] Role-aware Sidebar
- [x] TopBar with branding + notifications
- [x] BottomNav for customer app
- [x] BrandedHeader
- [x] ThemeProvider with CSS vars injection
- [x] PageWrapper

## Phase 4: Customer App (M13-M17)
- [x] Home page with mood tiles, AI recommendations, infinite scroll
- [x] Restaurant profile with parallax, gallery, menu, reviews
- [x] Digital menu with category nav, food cards, cart
- [x] Cart bottom sheet
- [x] Booking wizard
- [x] Order tracking with progress bar
- [x] Payment with UPI QR, split bill
- [x] Profile with order history, addresses, support

## Phase 5: Staff Modules (M7-M12)
- [x] Manager dashboard with live floor map + event feed
- [x] Host interface with queue + table map
- [x] Waiter interface with tables, orders, menu
- [x] Chef KDS with dark theme, ticket grid, timers
- [x] Cashier POS with payment processing

## Phase 6: Owner Panel (M4)
- [x] Dashboard with revenue sparklines, occupancy
- [x] Branch management cards + forms
- [x] Menu management with drag-reorder
- [x] Staff management table
- [x] Reports with charts

## Phase 7: Admin Panel (M3)
- [x] Dashboard with KPIs, charts, heat-map
- [x] Restaurant management data grid
- [x] Reports and analytics
- [x] Platform health monitoring

## Phase 8: Real-time & WebSocket (M19)
- [x] useRealtime hook
- [x] useTableStatus hook
- [x] useOrderStatus hook
- [x] useQueuePosition hook
- [x] RealtimeToastHandler

## Phase 9: AI Features (M20)
- [x] Smart menu suggestions
- [x] Geo-fencing arrival detection
- [x] AI chatbot support
- [x] Sentiment analysis badges
