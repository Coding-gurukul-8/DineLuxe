# 🎨 Restaurant OS — Complete UI/UX Styling Prompt Library
## Highest Level Styling — Every Screen, Every Component
**Priyanshu Kumar Gupta & Ronit Gupta | DineLuxe 2025**

---

## 🔬 PRE-ANALYSIS FINDINGS

After reading every CSS file, component, and page, here is the current state:

### ✅ What's Already Good
- Comprehensive Tailwind config with brand tokens, animations, spacing scale
- Framer Motion installed throughout (KPICard, PageWrapper, Sidebar all use it)
- CSS variables system (`--ink`, `--muted`, `--paper`, `--surface`, `--accent`)
- Shimmer skeleton, slide-up, fade-in, pulse animations defined
- KPICard has animated numbers + sparklines ← genuinely good
- Customer home has navy hero, gradient tiles, search bar ← good structure
- Dark mode foundation for KDS

### ❌ What Needs Maximum Elevation
| Area | Current State | Target |
|---|---|---|
| Sidebar | Basic nav list, flat colors | Premium glass sidebar with glow active state |
| Auth / Login | 3 basic portal cards | Split-screen with animated illustration |
| Waiter Table Grid | `bg-green-50 border-green-400` flat colors | Rich status tiles with depth + icons |
| KDS (Kitchen) | `bg-gray-800` blocks | Professional ticket cards with timers |
| Cashier POS | White cards, gray background | Clean POS layout with numeric keypad feel |
| FoodCard | Basic `rounded-xl shadow-sm` | Hover-lift with blurred background, spring add-to-cart |
| DataTable | Plain table with borders | Striped hover rows, sticky header |
| PageWrapper | Just `space-y-6` fade-in | Gradient header bar + breadcrumbs |
| Forms/Inputs | No consistent style layer | Floating labels, focus glow |
| Buttons | Inconsistent across pages | 5 variants with spring press animation |

---

## 🎨 DESIGN LANGUAGE RULES (Apply to ALL Prompts)

```
PRIMARY NAVY:     #1A3C5E   — headers, active states, CTAs
ACCENT GOLD:      #E8A020   — highlights, badges, warm accents
BACKGROUND:       #FAF7F4   — warm off-white (not pure white)
SURFACE:          #FFFFFF   — card backgrounds
BORDER:           #E5E7EB   — subtle gray borders
TEXT PRIMARY:     #111111
TEXT SECONDARY:   #6B7280
TEXT MUTED:       #9CA3AF

ELEVATION SYSTEM:
  Level 0: flat (no shadow)
  Level 1: shadow-sm  — cards at rest
  Level 2: shadow-md  — cards on hover
  Level 3: shadow-lg  — modals, dropdowns
  Level 4: shadow-xl  — full overlays

BORDER RADIUS:
  Pill badges:    rounded-full
  Cards:          rounded-2xl
  Buttons:        rounded-xl
  Inputs:         rounded-xl
  Chips:          rounded-lg

MOTION LANGUAGE:
  Entrance:       fade-in + translateY(16px) → 0, 0.4s easeOut
  Hover lift:     translateY(-2px) + shadow up, 0.2s ease
  Press:          scale(0.97), 0.1s ease
  Spring:         cubic-bezier(0.34, 1.56, 0.64, 1) ← already in tailwind.config
  Stagger lists:  0.05s delay per item
```

---

# ═══════════════════════════════════════════════
# ST-1 — DESIGN SYSTEM FOUNDATION
# Enhanced globals.css + tailwind.config.ts
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/globals.css              (full — the current file)
tailwind.config.ts           (full — the current file)
```

### 🎯 Task for Claude

```
You are elevating the design system foundation of Restaurant OS (DineLuxe).
The brand colors are: Navy #1A3C5E, Gold #E8A020, Background #FAF7F4.

Read both files completely. Then make these ADDITIONS — do NOT remove existing code.

=== ADD TO globals.css ===

/* ═══════════════════════════════════════════════
   GLASS MORPHISM LAYER
   ═══════════════════════════════════════════════ */

.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.55);
}

.glass-dark {
  background: rgba(26, 60, 94, 0.75);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.glass-navy {
  background: rgba(26, 60, 94, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ── Surface variants ── */
.surface-raised {
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  border: 1px solid rgba(229,231,235,0.8);
}

.surface-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.surface-card:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04);
  transform: translateY(-2px);
}

/* ═══════════════════════════════════════════════
   GRADIENT UTILITIES
   ═══════════════════════════════════════════════ */

.gradient-brand {
  background: linear-gradient(135deg, #1A3C5E 0%, #2A5C8E 100%);
}

.gradient-gold {
  background: linear-gradient(135deg, #E8A020 0%, #F5C050 100%);
}

.gradient-warm {
  background: linear-gradient(135deg, #1A3C5E 0%, #2A5C8E 50%, #E8A020 100%);
}

.gradient-success {
  background: linear-gradient(135deg, #1E7E34 0%, #27AE60 100%);
}

.gradient-danger {
  background: linear-gradient(135deg, #C0392B 0%, #E74C3C 100%);
}

.text-gradient-brand {
  background: linear-gradient(135deg, #1A3C5E, #E8A020);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-gradient-gold {
  background: linear-gradient(135deg, #E8A020, #F5C050);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ═══════════════════════════════════════════════
   BUTTON BASE LAYER
   ═══════════════════════════════════════════════ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  line-height: 1;
  padding: 10px 20px;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.2s ease, background-color 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.btn-primary {
  background: linear-gradient(135deg, #1A3C5E, #1E4D78);
  color: white;
  box-shadow: 0 2px 8px rgba(26,60,94,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
}
.btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(26,60,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
  transform: translateY(-1px);
}

.btn-gold {
  background: linear-gradient(135deg, #E8A020, #F0B030);
  color: white;
  box-shadow: 0 2px 8px rgba(232,160,32,0.35), inset 0 1px 0 rgba(255,255,255,0.2);
}
.btn-gold:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(232,160,32,0.45);
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  color: #1A3C5E;
  border: 1.5px solid #1A3C5E;
  box-shadow: none;
}
.btn-outline:hover:not(:disabled) {
  background: rgba(26,60,94,0.06);
}

.btn-ghost {
  background: transparent;
  color: #6B7280;
  border: 1.5px solid #E5E7EB;
}
.btn-ghost:hover:not(:disabled) {
  background: #F9FAFB;
  border-color: #D1D5DB;
  color: #374151;
}

.btn-danger {
  background: linear-gradient(135deg, #C0392B, #E74C3C);
  color: white;
  box-shadow: 0 2px 8px rgba(192,57,43,0.3);
}
.btn-danger:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(192,57,43,0.4);
  transform: translateY(-1px);
}

.btn-sm { padding: 7px 14px; font-size: 12px; border-radius: 8px; }
.btn-lg { padding: 14px 28px; font-size: 16px; border-radius: 14px; }
.btn-icon { padding: 10px; border-radius: 10px; }

/* Ripple effect */
.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.btn:active::after { opacity: 1; }

/* ═══════════════════════════════════════════════
   INPUT LAYER
   ═══════════════════════════════════════════════ */

.input-base {
  width: 100%;
  padding: 11px 16px;
  border: 1.5px solid #E5E7EB;
  border-radius: 12px;
  font-size: 14px;
  color: #111111;
  background: #ffffff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  outline: none;
  line-height: 1.5;
}

.input-base::placeholder { color: #9CA3AF; }

.input-base:hover:not(:disabled) {
  border-color: #D1D5DB;
  background: #FAFAFA;
}

.input-base:focus {
  border-color: #1A3C5E;
  box-shadow: 0 0 0 3px rgba(26,60,94,0.12);
  background: #ffffff;
}

.input-base:disabled {
  background: #F9FAFB;
  color: #9CA3AF;
  cursor: not-allowed;
}

.input-error {
  border-color: #C0392B;
  box-shadow: 0 0 0 3px rgba(192,57,43,0.1);
}

.input-success {
  border-color: #1E7E34;
  box-shadow: 0 0 0 3px rgba(30,126,52,0.1);
}

/* ═══════════════════════════════════════════════
   CARD PATTERN UTILITIES
   ═══════════════════════════════════════════════ */

.card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #F0F0F0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.card-interactive {
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card-interactive:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.card-navy {
  background: linear-gradient(135deg, #1A3C5E 0%, #0D2A45 100%);
  border-radius: 16px;
  color: white;
}

.card-gold-border {
  border: 1px solid transparent;
  background: linear-gradient(#ffffff, #ffffff) padding-box,
              linear-gradient(135deg, #E8A020, #F5C050) border-box;
  border-radius: 16px;
}

/* ═══════════════════════════════════════════════
   STATUS INDICATOR DOTS (animated)
   ═══════════════════════════════════════════════ */

.dot-live {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #1E7E34;
  position: relative;
}
.dot-live::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: rgba(30,126,52,0.3);
  animation: pulse-green 1.5s ease infinite;
}

.dot-warning {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #F39C12;
}

.dot-danger {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #C0392B;
  animation: pulse-red 1.5s ease infinite;
}

/* ═══════════════════════════════════════════════
   PAGE TRANSITION WRAPPER
   ═══════════════════════════════════════════════ */

.page-enter {
  animation: rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* ═══════════════════════════════════════════════
   HOVER HIGHLIGHT ROW (for tables/lists)
   ═══════════════════════════════════════════════ */

.row-hover {
  transition: background 0.15s ease;
}
.row-hover:hover {
  background: rgba(26,60,94,0.03);
}

/* ═══════════════════════════════════════════════
   OPERATIONAL URGENCY STATES (KDS + Waiter)
   ═══════════════════════════════════════════════ */

.urgency-normal { border-left: 3px solid #1E7E34; }
.urgency-warning { border-left: 3px solid #F39C12; }
.urgency-critical {
  border-left: 3px solid #C0392B;
  animation: pulse-red 1.5s ease infinite;
}

/* ═══════════════════════════════════════════════
   NO-SCROLLBAR UTILITY
   ═══════════════════════════════════════════════ */

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

=== ADD TO tailwind.config.ts ===

Inside theme.extend, add these new sections:

backgroundImage: {
  'gradient-brand':   'linear-gradient(135deg, #1A3C5E 0%, #2A5C8E 100%)',
  'gradient-gold':    'linear-gradient(135deg, #E8A020 0%, #F5C050 100%)',
  'gradient-warm':    'linear-gradient(160deg, #1A3C5E 0%, #2A5C8E 60%, #E8A020 100%)',
  'gradient-success': 'linear-gradient(135deg, #1E7E34 0%, #27AE60 100%)',
  'gradient-danger':  'linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)',
  'grid-subtle': 'linear-gradient(rgba(26,60,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,60,94,0.04) 1px, transparent 1px)',
},

backgroundSize: {
  'grid-sm': '20px 20px',
  'grid-md': '32px 32px',
},

backdropBlur: {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
},

Add 3 more keyframes:
  'ticket-enter': {
    '0%':   { opacity: '0', transform: 'translateX(-24px) scale(0.96)' },
    '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
  },
  'number-pop': {
    '0%':   { transform: 'scale(1)' },
    '40%':  { transform: 'scale(1.25)' },
    '100%': { transform: 'scale(1)' },
  },
  'drawer-in': {
    '0%':   { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(0)' },
  },

Add 3 more animations:
  'ticket-enter': 'ticket-enter 0.4s cubic-bezier(0.34,1.56,0.64,1)',
  'number-pop':   'number-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
  'drawer-in':    'drawer-in 0.35s cubic-bezier(0.22,1,0.36,1)',

Return the complete updated globals.css and tailwind.config.ts.
All existing code must be preserved — only ADD new utilities.
```

---

# ═══════════════════════════════════════════════
# ST-2 — SIDEBAR PREMIUM REDESIGN
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
components/layout/Sidebar.tsx    (full — the current 400+ line file)
app/globals.css                  (updated from ST-1)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are redesigning the Sidebar component of Restaurant OS to premium quality.

Read Sidebar.tsx completely. Understand the full nav item structure, dark mode hook,
BrandLogo component, and collapse logic.

=== REDESIGN PRINCIPLES ===

Visual Design:
  - Background: deep navy gradient: bg-gradient-to-b from-[#0D2A45] to-[#1A3C5E]
  - NOT white/gray — the sidebar is the "command center" — dark and authoritative
  - Width: 240px expanded, 64px collapsed
  - Smooth width transition: transition-[width] duration-300 ease-spring

Top Brand Area:
  - Logo/initial letter in a gold rounded square (48×48px when expanded, 40×40px collapsed)
  - App name in white, bold (hidden when collapsed)
  - Divider: 1px rgba(255,255,255,0.08) full width

Nav Item Design (EACH ITEM):
  Currently: plain flex row with icon + label
  New design:
    DEFAULT state:
      px-3 py-2.5, rounded-xl
      Icon: 18px, text-white/50
      Label: text-sm font-medium text-white/60
      Background: transparent
      Transition: 0.15s ease
    
    HOVER state:
      Background: rgba(255,255,255,0.07)
      Icon: text-white/90
      Label: text-white/80
      No border needed — subtle fill is enough
    
    ACTIVE state (current page):
      Background: rgba(232,160,32,0.15)
      Left border accent: border-l-2 border-[#E8A020]
      Icon: text-[#E8A020]
      Label: text-white font-semibold
      Glow: box-shadow: inset 0 0 0 1px rgba(232,160,32,0.2)

Nav Section Labels:
  Currently: section dividers may or may not be there
  New design:
    Between groups, show a section label:
    <p className="px-3 mt-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {section}
    </p>
    Divider line between major sections (Operations/Analytics/Settings)

Collapsed State (width: 64px):
  - Icons centered in 40×40 transparent circle
  - Active state: gold bg circle
  - Tooltips on hover: small floating label to the right of icon
    Use a CSS title attr tooltip OR a custom Tooltip wrapper:
    After the icon: <span className="sidebar-tooltip">{label}</span>
    CSS: .sidebar-tooltip: position absolute, left 100%, ml-2, white bg, rounded, hidden → 
    .sidebar-icon:hover .sidebar-tooltip { display: block }

Bottom User Section:
  Currently: logout button somewhere
  New design (pinned to bottom):
    - User avatar (initial letter circle, gold/navy)
    - Name + role (hidden when collapsed)
    - Logout icon button
    - Divider above this section: rgba(255,255,255,0.08)

Scrollable Middle:
  - Nav items area should be: flex-1 overflow-y-auto no-scrollbar

Mobile Overlay:
  Keep existing mobile behavior but upgrade:
  - Overlay backdrop: bg-black/60 backdrop-blur-sm
  - Sidebar slides from left with drawer-in animation

=== ALSO: Collapse toggle button ===
Current: ChevronLeft/Right button somewhere
New: 
  - Position: absolute right edge of sidebar, vertically centered
  - Style: w-6 h-6 rounded-full bg-white/10 hover:bg-white/20, arrow icon
  - Smooth 180° rotation when toggled

Return the COMPLETE redesigned Sidebar.tsx.
Keep all existing logic (role filtering, auth, branding fetch, dark mode) — only change styles.
```

---

# ═══════════════════════════════════════════════
# ST-3 — PAGE WRAPPER + BOTTOM NAV
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
components/layout/PageWrapper.tsx
components/layout/BottomNav.tsx
app/globals.css                   (updated from ST-1)
```

### 🎯 Task for Claude

```
You are elevating the PageWrapper and BottomNav components.

=== REDESIGN: PageWrapper.tsx ===

Current: just space-y-6 + fade-in animation.
New design adds a full header bar when title is provided.

Props (keep existing, add new optional props):
  breadcrumbs?: Array<{ label: string; href?: string }>
  headerVariant?: 'default' | 'gradient' | 'minimal'

GRADIENT VARIANT (for main dashboards):
  <div className="relative overflow-hidden rounded-2xl mb-6 p-6 pb-8 
                  bg-gradient-to-br from-[#1A3C5E] via-[#1E4D78] to-[#0D2A45]">
    {/* Decorative circles */}
    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
    <div className="absolute -bottom-16 -left-8 w-32 h-32 rounded-full bg-[#E8A020]/10" />
    
    {/* Breadcrumbs */}
    {breadcrumbs && (
      <nav className="flex items-center gap-1.5 text-white/50 text-xs mb-3">
        {breadcrumbs.map((b, i) => (
          <Fragment key={i}>
            {i > 0 && <span>/</span>}
            {b.href ? (
              <Link href={b.href} className="hover:text-white/80 transition-colors">{b.label}</Link>
            ) : (
              <span className="text-white/70">{b.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
    )}
    
    <div className="flex items-end justify-between relative z-10">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-white/60 text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  </div>

DEFAULT VARIANT (for sub-pages):
  Simple row: title (text-gray-900, text-2xl font-bold) + action
  Subtle bottom border: border-b border-gray-100 pb-4 mb-6

MINIMAL VARIANT:
  No header bar, just children with page-enter animation

=== REDESIGN: BottomNav.tsx ===

Read the current BottomNav. It's used for the customer mobile app.

New design:
  CONTAINER:
  - Fixed bottom-0, safe-area-inset-bottom
  - Full width
  - Height: 64px + safe area
  - Background: glass effect:
    background: rgba(255,255,255,0.92)
    backdrop-filter: blur(24px) saturate(180%)
    border-top: 1px solid rgba(229,231,235,0.6)
    box-shadow: 0 -4px 24px rgba(0,0,0,0.06)

  ITEMS (each nav tab):
    Layout: flex-col items-center gap-1, py-2, flex-1
    DEFAULT:
      Icon: 22px, text-gray-400
      Label: text-[10px] font-medium text-gray-400
    
    ACTIVE:
      Icon: 22px, text-[#1A3C5E]
      Label: text-[10px] font-semibold text-[#1A3C5E]
      Indicator: 4px × 4px rounded-full bg-[#E8A020] below icon (not above)
      
    ANIMATION: When tab becomes active:
      framer-motion animate icon with: scale 1→1.15→1, 0.3s spring

  SPECIAL: Center tab (Scan QR):
    Floating circular button above the nav bar:
    - 56×56px circle
    - bg-gradient-to-br from-[#1A3C5E] to-[#2A5C8E]
    - box-shadow: 0 4px 16px rgba(26,60,94,0.4)
    - Positioned: mt-[-28px] (floats above the nav bar)
    - White QR icon inside
    - Spring scale animation on press

  NOTIFICATION BADGE on bell icon:
    - Small red dot: w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1
    - If count > 0: w-4 h-4 rounded-full bg-red-500 flex items-center justify-center
      text-white text-[8px] font-bold

Return both complete updated files.
```

---

# ═══════════════════════════════════════════════
# ST-4 — AUTH PAGES PREMIUM REDESIGN
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/auth/login/page.tsx
components/auth/LoginForm.tsx
components/auth/OTPInput.tsx
components/auth/RestaurantSignupWizard.tsx
app/globals.css                              (ST-1 updated version)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are designing the premium auth experience for Restaurant OS.

Read all 4 auth files completely.

=== REDESIGN 1: app/auth/login/page.tsx (Portal Selector) ===

Current: 3 portal cards on a plain background.
New design:

FULL PAGE SPLIT LAYOUT (lg: side by side):

LEFT PANEL (hidden on mobile, lg:flex, w-5/12):
  bg-gradient-to-br from-[#0D2A45] via-[#1A3C5E] to-[#1E4D78]
  
  Content (centered, max-w-xs):
    - DineLuxe logo: large gold circle with fork+knife icon (or 🍽️ large emoji)
    - Large display text: "Restaurant OS" (font-display, 40px, white, bold)
    - Subtitle: "The complete platform for modern restaurants" (text-white/70)
    - 3 feature bullets with animated check marks:
      ✓ Real-time kitchen & operations
      ✓ Smart table & queue management  
      ✓ AI-powered insights
    Each with: green check icon, white/90 text, staggered fade-in
    
    Bottom: floating stats strip:
    "Trusted by 500+ restaurants · 1M+ orders" (text-white/40, italic)
    
    Decorative elements:
      - Large blurred circle: w-80 h-80, bg-[#E8A020]/10, absolute -bottom-20 -right-20
      - Dot grid pattern: bg-grid-subtle bg-grid-md
      - Top-right circles (stacked): current pattern is fine

RIGHT PANEL (full width on mobile, lg:w-7/12):
  bg-[#FAF7F4]
  Flex-col items-center justify-center min-h-screen px-6

  Header:
    "Choose your portal" (text-2xl font-bold text-gray-900)
    "What brings you in today?" (text-gray-500 text-sm mt-1)
  
  3 PORTAL CARDS (mt-8, space-y-3):
    Each card:
    - bg-white rounded-2xl border border-gray-100 shadow-sm
    - p-5, flex items-center gap-4
    - HOVER: shadow-md, -translate-y-0.5, border-[#1A3C5E]/20
    - transition: all 0.2s ease
    - FEATURED (Restaurant): border-[#E8A020]/40, shadow-[0_0_0_1px_#E8A020]/20
    
    Left: 48×48px rounded-xl icon container
      Admin: bg-blue-50, blue icon
      Restaurant: bg-[#1A3C5E]/10, navy icon (featured: gold badge top-right)
      Customer: bg-amber-50, amber icon
    
    Middle: 
      Label chip: "Admin Portal" (text-xs font-semibold uppercase text-gray-400)
      Title: "Admin App" (text-base font-bold text-gray-900)
      Description: (text-sm text-gray-500)
    
    Right: ChevronRight (text-gray-300, group-hover:text-[#1A3C5E])
    
    FEATURED badge on Restaurant card: 
      "MOST USED" amber pill, top-right corner of card, text-[10px] font-bold

=== REDESIGN 2: components/auth/OTPInput.tsx ===

Read the current OTPInput. It has individual digit boxes.

Elevate the digit boxes:
  Each digit box:
  - w-12 h-14 (48×56px)
  - rounded-xl
  - border-2 border-gray-200 → focus: border-[#1A3C5E] shadow-[0_0_0_3px_rgba(26,60,94,0.12)]
  - bg-white
  - text-xl font-bold text-center text-gray-900
  - Smooth transition: 0.15s ease border-color, box-shadow
  
  FILLED state:
  - border-[#E8A020]/60
  - bg-[#FFF8EE]
  
  ERROR state:
  - border-[#C0392B]
  - animate-shake
  
  Between boxes: gap-3

  Below boxes:
  - "Resend in 0:45" countdown timer (text-sm text-gray-400)
  - When can resend: "Resend OTP" button (text-[#E8A020] font-medium, text-sm)

=== REDESIGN 3: RestaurantSignupWizard.tsx — PROGRESS INDICATOR ===

Read the current wizard. Find the step indicator (it may be dots or numbers).

Upgrade to a STEP BAR:
  
  Container: flex items-center gap-0 w-full mb-8
  
  Each step: flex items-center flex-1
    - Step circle: w-8 h-8 rounded-full flex items-center justify-center
      COMPLETED: bg-gradient-gold, white check icon, shadow-[0_2px_8px_rgba(232,160,32,0.4)]
      CURRENT: bg-gradient-brand, white number, animate-glow-pulse
      UPCOMING: bg-gray-100, text-gray-400
    
    - Step label below circle: text-[11px] text-gray-400 (upcoming) / text-[11px] font-semibold text-[#1A3C5E] (current)
    
    Connector line (between steps):
      COMPLETED → CURRENT: gradient line from gold to navy
      Default: bg-gray-200
  
  Step content area:
    - AnimatePresence key={stepIndex}
    - Each step slides in from the right (x: 40 → 0) when advancing
    - Each step slides out to the left when going back

Return all 4 complete updated files.
```

---

# ═══════════════════════════════════════════════
# ST-5 — CUSTOMER APP UI SYSTEM
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/customer/home/page.tsx             (full)
components/shared/FoodCard.tsx         (full)
app/customer/restaurant/[restaurantId]/page.tsx  (full — if large, just the styling portions)
app/globals.css                        (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are perfecting the Customer App visual design for Restaurant OS.

=== ENHANCE 1: app/customer/home/page.tsx ===

Read the full file. The home already has a good structure (navy hero, quick actions, search).
Make these targeted improvements:

A) HERO SECTION (already has navy gradient):
  ADD:
  - Animated greeting text: use a typewriter effect or just a clean fade-in
  - Search bar: upgrade with a subtle inner glow when focused:
    focus:ring-2 ring-[#E8A020]/40 AND focus:shadow-[0_0_0_4px_rgba(232,160,32,0.12)]
  - Location pill below search: "📍 Connaught Place, New Delhi" with a soft update button
    Style: glass pill with white/20 bg, text-white/80

B) QUICK ACTION TILES (already has gradient):
  Upgrade:
  - Each tile: rounded-2xl, gradient bg, 60×60px (larger)
  - Add subtle pattern overlay inside each tile: bg-grid-subtle bg-grid-sm opacity-20
  - Hover: scale(1.05) + shadow-lg, 0.2s spring
  - Icon: slightly larger (24px), white

C) MOOD TILES (if present, from P1-28):
  Each tile:
  - Height: 72px (taller than before)
  - Active selected tile: ring-2 ring-white ring-offset-1, scale(0.97)
  - Gradient text inside: the emoji is 20px, label is text-xs font-bold text-white
  - Inactive hover: opacity 0.85

D) RESTAURANT CARDS (the main feed cards):
  Currently likely basic bg-white rounded-xl
  Upgrade each restaurant card to:
  - bg-white rounded-2xl overflow-hidden shadow-sm
  - HOVER: translateY(-3px) + shadow-[0_12px_32px_rgba(0,0,0,0.12)], 0.25s ease
  - Image: 16:9 ratio, object-cover, with a gradient overlay at bottom:
    After image: <div className="absolute bottom-0 left-0 right-0 h-24 
    bg-linear-to-t from-black/50 to-transparent" />
    Show cuisine type badge ON the image (glass pill, bottom-left)
  - Rating badge: absolute top-2 right-2, glass bg, ⭐ + rating number
  - Content area below image: p-3
    Name: font-semibold text-gray-900
    Distance + time: text-xs text-gray-500 flex items-center gap-1
    Tags (cuisine, dietary): small rounded chips, text-[10px]

=== ENHANCE 2: components/shared/FoodCard.tsx ===

Read the current FoodCard. 

TARGET: Make it feel like a premium food delivery app (Swiggy/Zomato level).

CARD CONTAINER:
  - bg-white rounded-2xl overflow-hidden
  - border: none (use shadow only)
  - shadow: 0 1px 4px rgba(0,0,0,0.06)
  - HOVER: translateY(-3px) + shadow: 0 12px 32px rgba(0,0,0,0.12)
  - Transition: 0.25s cubic-bezier(0.22,1,0.36,1)

IMAGE AREA (4:3):
  - Photo: object-cover, full size
  - Gradient overlay bottom: h-16 from-black/40 to-transparent
  - Sold out overlay: bg-black/50 backdrop-blur-sm flex items-center justify-center
    "SOLD OUT" text: font-bold text-white uppercase text-sm, with a gray border
  - Dietary badge (top-left): rounded-full pill
    VEG: bg-green-100 text-green-700 border border-green-200
    NON-VEG: bg-red-100 text-red-700 border border-red-200
  - Discount badge (top-right if applicable): bg-[#E8A020] text-white rounded-lg px-2 py-0.5 text-xs font-bold "-20%"

CONTENT AREA (p-3):
  Name: text-sm font-bold text-gray-900 line-clamp-1
  Description: text-xs text-gray-500 line-clamp-2 mt-0.5
  
  PRICE + ADD ROW:
  Left: 
    If discounted: show original with strikethrough in gray/50, new price in green font-bold
    Normal: font-bold text-gray-900 "₹240"
  Right: ADD TO CART BUTTON
    DEFAULT (qty=0): 
      "+" button: w-8 h-8 rounded-xl bg-[#1A3C5E] text-white flex items-center justify-center
      Spring scale on press: scale → 1.2 → 1
    ADDED (qty>0):
      Row: [−] [qty] [+] in rounded pill
      bg-[#1A3C5E], text-white
      Minus/plus: rounded buttons inside
      Qty: font-bold tabular-nums min-w-[20px] text-center
      Animate qty change: number-pop keyframe

Prep time badge (if available): 
  Below price: "⏱ 15 min" in text-[11px] text-gray-400

=== ENHANCE 3: Quick Reorder Cards (horizontal scroll) ===

From home page, find the Quick Reorder section (added in P4-5).
Each card style:
  - bg-white rounded-2xl border border-gray-100 shadow-sm
  - w-44 flex-none
  - Hover: shadow-md, -translate-y-0.5
  - Restaurant logo: 32×32 rounded-xl object-cover
  - Items text: text-[11px] text-gray-500 line-clamp-2
  - Reorder button: w-full, btn btn-primary btn-sm
  - "Reorder" text with ↺ icon

Return all 3 updated files. Mark ALL styling changes with // STYLE ENHANCEMENT comments.
```

---

# ═══════════════════════════════════════════════
# ST-6 — OWNER & ADMIN DASHBOARDS
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/owner/dashboard/page.tsx      (full)
app/admin/dashboard/page.tsx      (full)
components/shared/KPICard.tsx     (full)
app/globals.css                   (ST-1 updated)
```

### 🎯 Task for Claude

```
You are elevating the Owner and Admin dashboards to premium quality.

=== ENHANCE 1: KPICard.tsx ===

Read the current KPICard carefully.
It already has AnimatedNumber + sparklines — this is good.

ADD a visual upgrade:

CARD VARIANTS (add a variant prop: 'default' | 'gradient' | 'minimal'):

DEFAULT variant (current) — upgrade:
  - Add gradient top border: already there (bg-linear-to-r from-[#1A3C5E]/20 via-[#E8A020]/60 to-[#1A3C5E]/20)
  - ADD icon container (when icon prop is provided):
    Instead of raw icon, wrap it in a soft gradient circle:
    <div className="w-10 h-10 rounded-xl flex items-center justify-center
                    bg-linear-to-br from-[#1A3C5E]/10 to-[#1A3C5E]/5
                    border border-[#1A3C5E]/10">
      {icon}
    </div>

GRADIENT variant (for hero KPIs on dashboards):
  - bg-gradient-to-br from-[#1A3C5E] to-[#0D2A45]
  - All text: white
  - Trend: green or red with white/70 base
  - Gold accent for sparkline area fill

For the trend indicator:
  IMPROVE: Instead of plain TrendingUp/Down icon + number,
  Use a pill badge:
  <span className={cn(
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
    isUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
  )}>
    {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
    {Math.abs(trendValue).toFixed(1)}%
  </span>

=== ENHANCE 2: app/owner/dashboard/page.tsx ===

Read the full dashboard page.

A) KPI ROW: 
  Apply new KPICard variants:
  Revenue Today → variant='gradient' (white text on navy)
  Orders Today → default with TrendingUp icon
  Avg Order Value → default 
  Occupancy → default with icon

B) REVENUE CHART:
  Find the AreaChart. Upgrade the chart visuals:
  
  Area fill: use gradient def:
  <defs>
    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#1A3C5E" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#1A3C5E" stopOpacity={0} />
    </linearGradient>
  </defs>
  Area fill="url(#revenueGrad)"
  Area stroke="#1A3C5E" strokeWidth={2.5}
  
  CartesianGrid: strokeDasharray="4 4" stroke="#F0F0F0"
  XAxis, YAxis: tick style: fill="#9CA3AF" fontSize={11}
  
  Chart container card: bg-white rounded-2xl border border-gray-100 shadow-sm p-5

C) OCCUPANCY HEATMAP (OccupancyHeatmap component):
  Upgrade the heatmap cells:
  Each cell: rounded-sm, 14×14px (slightly larger)
  Color scale: 0→1 intensity using:
    opacity 0.08: bg-[#1A3C5E]
    opacity 0.25: bg-[#1A3C5E]
    opacity 0.50: bg-[#1A3C5E]
    opacity 0.75: bg-[#1A3C5E]
    opacity 1.00: bg-[#E8A020] (peak hours in gold!)
  Use: style={{ backgroundColor: `rgba(26,60,94,${Math.min(i * 0.9, 0.6)})` }}
       BUT for intensity > 0.6: style={{ backgroundColor: `rgba(232,160,32,${i})` }}

D) LIVE EVENTS FEED:
  Find the live events feed section.
  Each event item:
    - flex items-start gap-3, py-2.5, border-b border-gray-50
    - Left: colored dot based on type
      order: green dot, booking: blue dot, alert: red dot
    - Message: text-sm text-gray-700
    - Time: text-xs text-gray-400 ml-auto
    - First item (most recent): slight gold left accent

=== ENHANCE 3: app/admin/dashboard/page.tsx ===

Read the admin dashboard.

A) TOP STATS ROW: Apply gradient KPICard variant to first 2 KPIs.

B) PLATFORM GROWTH CHART:
  LineChart upgrade:
  Line: stroke="#1A3C5E" strokeWidth={2.5} dot={false}
  Second line (orders): stroke="#E8A020" strokeWidth={2}
  Grid: strokeDasharray="4 4" stroke="#F3F4F6"

C) TOP RESTAURANTS TABLE:
  Find the restaurant list.
  UPGRADE to a proper leaderboard style:
  Each row:
    - Rank number: large, bold, gray/40 (#1 gets gold color: text-[#E8A020])
    - Restaurant name: font-semibold
    - Revenue: font-mono font-bold text-[#1A3C5E]
    - Orders: small chip badge
    - Status: StatusBadge component

D) RECENT ACTIVITY FEED:
  Event type icons:
    restaurant_joined: Store icon, green bg
    restaurant_suspended: ShieldAlert icon, red bg
    large_order: ShoppingBag icon, gold bg
    user_signup: UserPlus icon, blue bg
  
  Each item: 
    40×40px icon circle with the colored icon
    Title + time right of icon
    Hover: bg-gray-50/50, rounded-xl transition

Return all 3 updated files.
```

---

# ═══════════════════════════════════════════════
# ST-7 — STAFF OPERATIONAL INTERFACES
# (Waiter Table Grid + Host Queue)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/staff/waiter/page.tsx           (full — 20.5KB)
app/staff/host/queue/page.tsx       (full — 10.7KB)
components/shared/QueueCard.tsx     (full)
components/floor/FloorMap.tsx       (full)
components/shared/TableUnit.tsx     (full)
app/globals.css                     (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are perfecting the staff operational interfaces for maximum clarity and efficiency.
Staff use these screens under pressure — design must communicate status instantly.

=== REDESIGN 1: TableUnit.tsx (the individual table cell) ===

Read the current TableUnit and FloorMap.

TABLE UNIT OVERHAUL:

Each table cell (regardless of shape) shows:
  - Table label: bold, centered (T1, T3, VIP-1)
  - Capacity: tiny chip below label (👥 4)
  - Status indicator: colored dot + color scheme
  - Waiter initials: small circle bottom-right if assigned

STATUS COLOR SYSTEM (more refined):
  available:   bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]  (soft green)
  occupied:    bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]  (soft red)
  reserved:    bg-[#EFF6FF] border-[#93C5FD] text-[#2563EB]  (soft blue)
  cleaning:    bg-[#FFFBEB] border-[#FDE047] text-[#CA8A04]  (soft yellow)
  maintenance: bg-[#F9FAFB] border-[#D1D5DB] text-[#6B7280]  (gray)

CELL SIZE: 80×80px minimum (previously too small)
CELL STYLE:
  border-2, border-solid, rounded-2xl
  box-shadow: 0 2px 6px rgba(0,0,0,0.08)
  Position relative (for waiter badge)
  
HOVER:
  scale(1.05) + shadow-md, 0.15s spring

SELECTED:
  ring-2 ring-[#1A3C5E] ring-offset-2
  scale(1.02)

WAITER BADGE (bottom-right):
  w-6 h-6 rounded-full bg-[#1A3C5E] text-white text-[9px] font-bold
  absolute -bottom-1 -right-1
  Shows: first initial of waiter name (e.g., "R" for Rahul)

FOR ROUND TABLE: border-radius 50% (using Tailwind: rounded-full)
FOR RECTANGLE: rounded-xl, 2:1 aspect ratio (64×32 min or 120×60)
FOR BOOTH: rounded-t-none rounded-b-2xl (one rounded side)

=== REDESIGN 2: app/staff/waiter/page.tsx ===

Read the full waiter page.

A) HEADER BAR:
  - bg-gradient-to-r from-[#1A3C5E] to-[#1E4D78]
  - White text, gold accent for important numbers
  - "My Tables: 3 | Active Orders: 2 | Pending: 1"
    Each as a small stat chip: bg-white/10 rounded-xl px-3 py-1

B) FLOOR/TABLE GRID SECTION:
  Container: bg-[#F8F9FA] rounded-2xl p-4 border border-gray-100
  
  Floor tab selector (if multiple floors):
    Horizontal pill tabs: active floor = bg-[#1A3C5E] text-white
    Others: bg-white text-gray-600 border border-gray-200
  
  Legend row (bottom of grid):
    Small colored squares with labels — upgrade to:
    flex items-center gap-4 text-xs text-gray-500 mt-3
    Each: <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{background, border}} />
            {label}
          </span>

C) ACTIVE ORDER PANEL (right side / bottom sheet on mobile):
  Card: bg-white rounded-2xl shadow-sm border border-gray-100 p-4
  
  Order header: 
    Table label chip (gold bg, navy text)
    Order time: text-xs text-gray-400 ml-auto
  
  Items list: divide-y divide-gray-50
  Each item row:
    qty × name | status badge | action button
    Status chips:
      'pending': bg-gray-100 text-gray-600 "Waiting"
      'preparing': bg-amber-100 text-amber-700 "In Kitchen"
      'ready': bg-green-100 text-green-700 animate-pulse-green "Ready!"

=== REDESIGN 3: QueueCard.tsx ===

Read the current QueueCard.

VISUAL REDESIGN:
  Container: bg-white rounded-2xl border border-gray-100 shadow-sm
  
  LEFT STRIPE: w-1 rounded-l-2xl — color based on urgency:
    wait < 5min: bg-green-400
    wait 5-15min: bg-amber-400
    wait > 15min: bg-red-400
  
  CONTENT:
    Top row: Queue number (large: text-2xl font-bold text-[#1A3C5E]) | Time waiting chip
    Middle: Party size + platform badge (App / Walk-in / Phone)
    Name: text-sm font-medium text-gray-700
    Bottom: Action buttons row
      [Assign Table] primary button
      [Notify] ghost button
      [Remove] danger icon button
  
  Geo-arrived state: gold ring + "📍 Nearby" badge glowing

=== REDESIGN 4: app/staff/host/queue/page.tsx ===

Read the host queue page.

A) TOP BAR:
  - Stats: "In Queue: 12 | Avg Wait: 18 min | Tables Free: 3"
  - Each stat: glass chip bg-white/80 backdrop-blur-sm rounded-xl px-3 py-1.5

B) QUEUE LIST:
  Use updated QueueCard for each entry
  List with staggered entrance animation (0.05s delay per item)

C) TABLE ASSIGNMENT MODAL:
  When assigning a table to a queue entry:
  Modal card: rounded-2xl bg-white shadow-xl p-6
  
  Title: "Assign Table for [Name]'s party of [n]"
  
  TABLE GRID inside modal:
    2-column grid of available tables
    Each: rounded-xl border-2, shows capacity, click to select
    Selected: border-[#1A3C5E] bg-[#1A3C5E]/5

Return all 5 updated files. Mark all changes with // STYLE comments.
```

---

# ═══════════════════════════════════════════════
# ST-8 — KITCHEN DISPLAY SYSTEM (KDS)
# Professional Dark Mode Ticket Interface
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/staff/chef/kitchen/page.tsx    (full — 11.5KB)
app/globals.css                    (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are designing the premium Kitchen Display System for Restaurant OS.

The KDS is a high-pressure, high-visibility interface used by chefs.
Requirements: Dark mode primary, large text, clear urgency signaling, zero clutter.

Read the full kitchen page. The KDS has:
- Dark mode toggle (currently active by default: darkMode=true)
- Order tickets as cards
- Station tabs
- Timer/elapsed time display

=== OVERHAUL THE ENTIRE KDS VISUAL SYSTEM ===

BACKGROUND:
  Dark: bg-[#0F0F0F] (near-black, not gray-900)
  Light: bg-[#F0F0F0] (cool light gray for contrast with white tickets)

HEADER BAR:
  Height: 56px
  Dark: bg-[#1A1A1A] border-b border-white/8
  
  Left: "🍳 Kitchen Display" + branch name
  Center: Station tabs (see below)
  Right: 
    Active orders count: "12 active" in green pill
    Dark/light toggle
    Time: digital clock format "09:45 PM" in monospace font

STATION TABS (upgrade from ST-1 P1-31):
  Dark: Each tab bg-[#262626] text-white/50 rounded-xl px-4 py-1.5
  Active tab:
    bg-[#E8A020] text-[#0F0F0F] font-bold
    shadow: 0 2px 8px rgba(232,160,32,0.4)
  Count badge on each tab: small circle with order count
  Hover: bg-white/10

TICKET CARD (the main element — make this excellent):

  Container:
    Dark: bg-[#1C1C1C] rounded-2xl border border-white/8
    Light: bg-white rounded-2xl border border-gray-200 shadow-sm
    Width: 280px (fixed)
    overflow: hidden
  
  URGENCY LEFT BORDER (3px):
    0-10 min:   border-l-[3px] border-green-400
    10-20 min:  border-l-[3px] border-amber-400
    20+ min:    border-l-[3px] border-red-500 + animate-pulse-red on the border

  TICKET HEADER:
    Padding: px-4 pt-3 pb-2
    Background:
      Dark < 10min:  transparent
      Dark 10-20min: bg-amber-900/20
      Dark 20+min:   bg-red-900/20 (urgent!)
    
    Row 1: Order number chip + table/type badge
      Order #: text-xs font-mono font-bold text-white/60 (dark)
      "TABLE T3" chip: bg-white/10 rounded-lg px-2 py-0.5 text-[11px] font-bold text-white
      Order type badge: "Dine-In" / "Delivery" / "Takeaway"
    
    Row 2: ELAPSED TIMER (prominent):
      If < 10min: text-2xl font-bold font-mono text-green-400
      If 10-20min: text-2xl font-bold font-mono text-amber-400
      If > 20min: text-2xl font-bold font-mono text-red-400 animate-pulse
      Format: "08:42" (MM:SS)
      
      Next to timer: small "(target: 15 min)" text-xs text-white/30
    
    Row 3: Item count + waiter name
      "5 items" text-xs text-white/40
      "Waiter: Rahul" text-xs text-white/40

  DIVIDER: 1px border-white/8

  ITEMS LIST (px-4 py-2):
    Each item row (py-2 border-b border-white/5):
      Qty: text-sm font-bold text-[#E8A020] w-8 (e.g., "×2")
      Name: text-sm text-white/90 font-medium flex-1
      Status: small icon-only indicator
        pending:    ⬜ gray dot
        preparing:  🟡 yellow dot (pulsing)
        ready:      ✅ green check
      
      Notes (if any): text-[11px] text-white/40 italic ml-8 mt-0.5
    
    COMPLETED items: opacity-40 text-white/30 line-through

  ACTION BUTTONS (px-4 pb-4 pt-2):
    If all items preparing:
      [Mark All Ready] full-width btn-gold
    
    If all items ready:
      [Complete Order] full-width bg-green-500 text-white font-bold
      Add checkmark animation on click: bounce scale 0.9→1.1→1
    
    If some ready, some not:
      [Mark Remaining Ready] btn-outline (lighter)

TICKET GRID LAYOUT:
  CSS columns: auto-fill, min 280px, gap-4
  New tickets: animate-ticket-enter (slide from left)
  Completing tickets: animate-slide-out (slide right out)
  AnimatePresence around each ticket

STATION ORDER COUNT BADGE:
  For each station tab, show a small number badge of pending orders.
  Active station: white badge on gold tab
  Other stations: gold badge on dark tab

Return the COMPLETE updated kitchen/page.tsx.
```

---

# ═══════════════════════════════════════════════
# ST-9 — CASHIER POS INTERFACE
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/staff/cashier/page.tsx         (full — 17.2KB)
components/payment/PaymentModal.tsx (full)
app/globals.css                    (ST-1 updated)
```

### 🎯 Task for Claude

```
You are designing the Cashier POS interface for Restaurant OS.

The cashier interface is used to view active table orders, generate bills,
take payments, and print receipts. It must feel like a professional POS terminal.

Read both files completely.

=== REDESIGN: app/staff/cashier/page.tsx ===

OVERALL LAYOUT (2-column on desktop):
  Left column (flex-1): Active Tables / Order List
  Right column (w-80): Bill Summary + Payment Actions

LEFT COLUMN:

  A) Table Selector (at top):
    Horizontal scrollable row of active table pills:
    Each pill: 
      bg-white rounded-xl border-2 border-gray-200 px-4 py-2 flex items-center gap-2
      Table label (bold) + order status dot + order total in small text
      ACTIVE: border-[#1A3C5E] bg-[#1A3C5E]/5 text-[#1A3C5E]
      With order: green dot indicator

  B) Order Items Table:
    Table header row:
      bg-gray-50 rounded-t-xl border-b border-gray-200
      Columns: Item | Qty | Unit Price | Total | (remove button)
      Text: text-xs font-semibold uppercase text-gray-400 tracking-wide
    
    Item rows:
      py-3 px-4 border-b border-gray-50 hover:bg-gray-50/50
      Item name: text-sm font-medium text-gray-900
      Qty: text-sm font-bold text-[#1A3C5E] centered
      Prices: text-sm font-mono text-gray-700
      Remove button: x-circle icon, text-gray-300 hover:text-red-500
    
    Items with notes: show notes in text-xs italic text-gray-400 below item name

RIGHT COLUMN (BILL PANEL):

  Container: bg-[#1A3C5E] rounded-2xl p-5 text-white (NAVY BILL PANEL)
  
  Title: "Bill Summary" text-sm font-semibold text-white/60 uppercase tracking-wide
  
  Table/Order info:
    "Table T3 · 4 guests" with separator dot
  
  LINE ITEMS SUMMARY:
    Subtotal row: flex justify-between text-white/80 text-sm
    GST row: flex justify-between text-white/60 text-sm
    Service Charge row: flex justify-between text-white/60 text-sm
    Discount row (if any): text-green-300 flex justify-between
    Divider: border-t border-white/15 my-3
    GRAND TOTAL: text-2xl font-bold text-white
    Per-person (if split): text-white/60 text-sm "₹160 per person"
  
  COUPON INPUT:
    Input: bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40
    "Apply" button: btn-gold btn-sm
    If applied: green checkmark + "₹54 saved!" chip
  
  PAYMENT METHOD BUTTONS (below total):
    4 payment method tiles in 2×2 grid:
    Each tile: bg-white/10 hover:bg-white/20 rounded-xl p-3 flex flex-col items-center gap-1.5
    Icon + label
    SELECTED: bg-[#E8A020] text-[#1A3C5E] font-bold shadow-inner
    
    [💵 Cash] [💳 Card] [📱 UPI] [✂️ Split]
  
  CHARGE BUTTON:
    Full-width, bg-[#E8A020] text-[#1A3C5E] font-bold text-lg h-14
    Amount on button: "Charge ₹1,340"
    Loading state: spinner + "Processing..."
    
=== REDESIGN: PaymentModal.tsx ===

Read the current modal. 

VISUAL UPGRADE:

Modal Container: 
  Slide-up animation from bottom on mobile
  Center modal on desktop
  bg-white rounded-t-3xl (mobile) or rounded-2xl (desktop)
  shadow-2xl

Payment Method Tabs:
  Horizontal pill tabs (not buttons):
  Tab container: bg-gray-100 rounded-full p-1 flex gap-1
  Each tab: px-4 py-1.5 rounded-full text-sm font-medium
  Active: bg-white shadow-sm text-[#1A3C5E] font-semibold
  Inactive: text-gray-500

Bill breakdown (confirmation step):
  Clean numbered list with lines:
  Each line: flex justify-between, py-2 border-b border-gray-50
  Grand total: border-t-2 border-gray-200 pt-3 text-lg font-bold

UPI QR tab content:
  Centered QR code with a navy border ring
  Countdown timer: circular progress ring around "14:23" countdown
  UPI app buttons: row of branded icons (GPay, PhonePe, Paytm)

Return both complete files.
```

---

# ═══════════════════════════════════════════════
# ST-10 — DATA TABLE + FORMS + MICRO-INTERACTIONS
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
components/shared/DataTable.tsx        (full)
components/shared/SkeletonCard.tsx     (full)
components/shared/EmptyState.tsx       (full)
components/shared/ConfirmDialog.tsx    (full)
app/globals.css                        (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are completing the micro-interaction layer and shared component polish.

=== REDESIGN 1: DataTable.tsx ===

Read the current DataTable. It's likely a basic HTML table with borders.

NEW DESIGN:

CONTAINER:
  bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm

HEADER ROW:
  bg-gray-50/80 border-b border-gray-100
  Each th: px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400
  Sortable columns: flex items-center gap-1 cursor-pointer hover:text-gray-600
    Sort icon: ChevronUp/Down (10px) next to label
    Active sort column: text-[#1A3C5E] font-bold

DATA ROWS:
  Each tr: border-b border-gray-50 transition-colors duration-100
  Default: bg-white
  Hover: bg-[#1A3C5E]/02  (extremely subtle navy tint)
  Each td: px-4 py-3.5 text-sm text-gray-700

  STRIPED variant (alternate rows):
  Even rows: bg-gray-50/40

ACTIONS COLUMN (rightmost):
  Actions as icon buttons: 
  Each: w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
  Edit: hover:bg-blue-50 hover:text-blue-600
  Delete: hover:bg-red-50 hover:text-red-500
  View: hover:bg-gray-100 hover:text-gray-700

PAGINATION ROW:
  border-t border-gray-100 px-4 py-3
  flex items-center justify-between text-sm text-gray-500
  
  Page info: "Showing 1–20 of 128"
  Buttons: Previous / Next — rounded-lg border border-gray-200 px-3 py-1.5
  Active page number: bg-[#1A3C5E] text-white rounded-lg px-3 py-1.5

=== REDESIGN 2: SkeletonCard.tsx ===

Read the current skeleton. It likely uses the .skeleton class.

UPGRADE:
  Base skeleton: rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm
  
  Inner skeleton blocks: .skeleton class (shimmer animated)
  
  Card variant (for KPICard skeleton):
    - Header: h-4 w-1/2 skeleton at top
    - Value: h-8 w-3/4 skeleton
    - Trend: h-3 w-1/4 skeleton
    - Sparkline: h-12 w-full skeleton at bottom
    Padding: p-5 space-y-3
  
  List variant (for table rows):
    - Each row: flex gap-3 items-center h-14 px-4 border-b border-gray-50
      Avatar circle: w-8 h-8 rounded-full skeleton
      Lines: flex-1 space-y-1.5
        Line 1: h-3 w-1/2 skeleton
        Line 2: h-3 w-1/3 skeleton
  
  Feed variant (for activity):
    - Left dot: w-2 h-2 rounded-full skeleton
    - Lines: space-y-2

=== REDESIGN 3: EmptyState.tsx ===

Read the current EmptyState.

NEW DESIGN:
  Container: flex flex-col items-center justify-center py-16 px-6 text-center
  
  ICON CIRCLE (large):
    w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4
    Icon inside: 32px, text-gray-300
    
    If variant='success': bg-green-50, text-green-300
    If variant='search': bg-blue-50, text-blue-300
    If variant='error': bg-red-50, text-red-300
  
  Title: text-lg font-semibold text-gray-900 mt-2
  Subtitle: text-sm text-gray-500 mt-1 max-w-xs mx-auto
  
  Action button (optional):
    mt-6, btn btn-primary btn-sm
    With an icon (+ Add, ↺ Retry, etc.)

=== REDESIGN 4: ConfirmDialog.tsx ===

Read the current confirm dialog.

NEW DESIGN (slides up, centered):

OVERLAY: bg-black/50 backdrop-blur-sm fixed inset-0 z-50

DIALOG CARD:
  - bg-white rounded-2xl shadow-2xl
  - w-full max-w-sm mx-4 (mobile) or max-w-md (desktop)
  - animate-scale-in on mount
  - p-6
  
  HEADER:
    Icon circle (based on variant):
      danger: w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4
              AlertTriangle icon text-red-500
      warning: amber version
      info: blue version
    
    Title: text-lg font-bold text-gray-900 text-center
    Subtitle: text-sm text-gray-500 text-center mt-1.5
  
  BUTTONS (mt-6):
    flex gap-3
    Cancel: flex-1, btn btn-ghost
    Confirm: flex-1, btn btn-danger (for delete actions)
    
    Danger confirm has a 2-second delay before becoming clickable:
    Show countdown: "Delete (3)" → "Delete (2)" → "Delete (1)" → "Delete"
    Progress bar under button: width 0% → 100% over 3 seconds using CSS animation

Return all 4 updated files.
```

---

# ═══════════════════════════════════════════════
# ST-11 — OWNER PANEL PAGES
# Menu, Inventory, Staff, Branding
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
components/owner/MenuManagement.tsx        (full — should be large)
app/owner/branding/page.tsx               (full — 25.1KB)
components/owner/StaffManagement.tsx      (full)
app/globals.css                           (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are polishing the Owner panel pages for premium visual quality.

=== ENHANCE 1: MenuManagement.tsx ===

Read the full component.

A) CATEGORY TABS:
  Currently likely: buttons or simple links
  New: Scrollable pill tabs
    Container: flex gap-2 overflow-x-auto no-scrollbar pb-2
    Each pill: px-4 py-1.5 rounded-full text-sm font-medium transition-all
    Active: bg-[#1A3C5E] text-white shadow-sm
    Inactive: bg-white text-gray-600 border border-gray-200 hover:border-[#1A3C5E]/30

B) MENU ITEM CARDS (grid layout):
  Toggle between: Grid view (2-col cards) and List view (rows)
  Toggle button: in top-right of the section header
  
  GRID CARD:
    bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm
    Image: 4:3 top
    Content: p-3
      Name: font-semibold text-sm text-gray-900
      Price: font-bold text-[#1A3C5E]
      Status toggle: small switch component
        ON: bg-[#1E7E34]
        OFF: bg-gray-300
    
    Available / Sold Out badge overlaid on image corner
  
  LIST ROW (alternate view):
    flex items-center gap-4 py-3 px-4 border-b border-gray-50 hover:bg-gray-50/50
    Thumbnail: 48×48 rounded-xl object-cover (or emoji placeholder)
    Name + category chip
    Price: font-mono font-bold text-[#1A3C5E]
    Availability toggle right-aligned
    3-dot action menu

C) ADD/EDIT FORM SIDE PANEL:
  Slides in from the right (translate-x animation)
  bg-white border-l border-gray-200 h-screen fixed right-0 w-96 shadow-2xl
  
  Form fields using input-base CSS class (from ST-1)
  Photo upload area:
    Dashed border rectangle: border-2 border-dashed border-gray-300 rounded-2xl
    "Drag or click to upload" text + camera icon
    Shows uploaded image preview with remove button overlay

=== ENHANCE 2: app/owner/branding/page.tsx ===

This is a large existing page (25.1KB). Read it completely.

The page likely has:
  - Color pickers for primary/secondary
  - Logo upload
  - App name input
  - Preview area

UPGRADES:

A) LIVE PREVIEW PANEL (the BrandingPreviewPanel from P2-13):
  Make the preview look like an actual phone mockup:
  
  Phone frame: 
    w-64 mx-auto relative
    bg-white rounded-[3rem] border-4 border-gray-900
    h-[520px] overflow-hidden shadow-2xl
    
    Notch: w-32 h-6 rounded-b-full bg-gray-900 absolute top-0 left-1/2 -translate-x-1/2
    Side buttons: absolute right-[-6px] top-24 w-1.5 h-12 bg-gray-700 rounded-r-full
    
    Inside the phone (overflow-hidden):
      Mini app header: {selectedPrimaryColor}, logo, app name
      Mini restaurant cards: 3 skeleton-style cards
      Mini bottom nav bar

B) COLOR PICKERS:
  Each color option shown as:
    A 40×40px color swatch circle with border
    Click to open a popover with a hex input + preset palette grid
    Currently selected: ring-2 ring-offset-2 ring-[#1A3C5E]
  
  Preset palette (8 common restaurant brand colors):
    Row of 8 circles: click to apply

C) FONT SELECTOR:
  Show each font in its own style:
  Each option: a card with the font applied to "DineLuxe Restaurant" preview text
  Selected: border-2 border-[#1A3C5E]

=== ENHANCE 3: StaffManagement.tsx ===

Read the full component.

STAFF CARD:
  Each staff member shown as a card OR table row.
  If using table rows:
  
  Avatar: initials circle — bg gradient based on role:
    owner/manager: bg-gradient-brand text-white
    waiter/host: bg-gradient-gold text-white
    chef: bg-gradient-to-br from-orange-400 to-red-500 text-white
    cashier: bg-gradient-to-br from-blue-500 to-indigo-600 text-white
  
  Role badge: RoleBadge component (already exists, upgrade colors if needed)
  Status indicator: dot-live (green) or dot-danger (red)
  
  Actions: Edit, toggle access, reset password — as icon buttons with proper hover states

Return all 3 files.
```

---

# ═══════════════════════════════════════════════
# ST-12 — DELIVERY PARTNER + ADMIN FINAL POLISH
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/delivery/page.tsx             (full)
app/delivery/earnings/page.tsx    (full)
app/admin/platform-health/page.tsx (full)
app/admin/restaurants/page.tsx    (full — 18.2KB)
app/globals.css                   (ST-1 updated)
```

### 🎯 Task for Claude

```
You are completing the styling for delivery and admin interfaces.

=== ENHANCE 1: Delivery Home Page (app/delivery/page.tsx) ===

Read the current delivery page.

TARGET: A clean mobile-first app feel for delivery partners, similar to Swiggy/Zomato delivery.

ONLINE/OFFLINE TOGGLE (hero element):
  Large toggle at top — full width within header
  OFFLINE state:
    bg-gray-100 text-gray-500
    Large toggle pill with "OFFLINE" label
    Subtitle: "Go online to start receiving orders"
  
  ONLINE state:
    bg-gradient-to-r from-[#1E7E34] to-[#27AE60] text-white
    Animated pulsing green dot + "ONLINE"
    Subtitle: "Waiting for new orders..."
  
  Toggle animation: 0.3s ease, spring translation

ACTIVE DELIVERY CARD (when a delivery is active):
  Prominent card with gold border: card-gold-border
  Background: navy gradient
  Shows: Restaurant name + address, customer area, distance, ETA
  [View Details] button → gold

TODAY'S STATS ROW (small chips):
  3 stats: Deliveries Today | Earnings Today | Avg Rating
  Each: glass pill bg-white/80 backdrop-blur rounded-xl px-4 py-2

=== ENHANCE 2: Delivery Earnings Page (app/delivery/earnings/page.tsx) ===

Read the current file.

EARNINGS CHART:
  BarChart for daily/weekly earnings
  Bars: gradient fill (gold at top, light gold at bottom)
  Active bar: solid [#E8A020], others: [#E8A020]/30

EARNINGS SUMMARY CARDS:
  Today / This Week / This Month tabs
  Active tab: gold bg
  Summary card: navy bg with white text

=== ENHANCE 3: Admin Platform Health Page ===

Read the current page.

HEALTH SCORE (PlatformHealthScore from P4-8):
  This card should be the HERO element of the page.
  Full width at top.
  
  If Grade A: green gradient header
  If Grade B/C: amber gradient  
  If Grade D/F: red gradient
  
  The 0-100 score number: 
    Extra-large: text-8xl font-black text-white
    Grade letter to the right: text-4xl font-bold text-white/80

SYSTEM STATUS GRID (below score):
  4 cards in a grid: Database | Redis | API | WebSocket
  Each card:
    Status indicator: large dot (dot-live or dot-danger)
    Metric: latency ms or "OK"
    bg-white rounded-2xl border shadow-sm

=== ENHANCE 4: Admin Restaurants Page ===

Read the full page (18.2KB).

This is likely a large table/list of restaurants.

UPGRADES:

A) FILTER BAR:
  Horizontal pill filters: All | Active | Pending | Suspended
  Each: rounded-full px-4 py-1.5 text-sm font-medium
  Active: bg-[#1A3C5E] text-white
  Count badge on each: small number in muted color

B) RESTAURANT ROWS (in table or card list):
  If table: apply DataTable styling from ST-10
  
  Restaurant name cell:
    Logo (small, 32×32 rounded-lg) + name + cuisine type chip
  
  Status cell: StatusBadge (from existing component — already styled)
  
  Revenue cell: font-mono font-bold text-[#1A3C5E]
  
  Action cell: [View] [Approve] [Suspend] as small icon buttons

C) PENDING RESTAURANTS SECTION (if any):
  Highlighted section at top with amber left border:
  border-l-4 border-amber-400 bg-amber-50 rounded-r-2xl p-4
  "3 restaurants awaiting approval" with [Review Now] button

Return all 4 updated files.
```

---

# ═══════════════════════════════════════════════
# ST-13 — TOAST NOTIFICATIONS + LOADING STATES
# Global Polish Layer
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/layout.tsx                    (root layout)
components/error/GlobalErrorBoundary.tsx  (from P2-15)
components/shared/PageLoader.tsx          (from P2-15)
app/globals.css                   (ST-1 updated)
```

### 🎯 Task for Claude

```
You are adding the final polish layer — toasts, loading states, and global layout.

=== TASK 1: Configure Sonner Toasts with Custom Styling ===

In app/layout.tsx, find where <Toaster /> from 'sonner' is rendered.
If it doesn't exist, add it.

Configure with rich styling:

<Toaster
  position="top-right"
  expand={true}
  richColors={false}
  toastOptions={{
    style: {
      background: '#1A3C5E',
      color: 'white',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 8px 32px rgba(26,60,94,0.35)',
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      padding: '14px 18px',
    },
    success: {
      style: {
        background: '#1E7E34',
        border: '1px solid rgba(255,255,255,0.1)',
      },
      icon: '✓',
    },
    error: {
      style: {
        background: '#C0392B',
        border: '1px solid rgba(255,255,255,0.1)',
      },
    },
    warning: {
      style: {
        background: '#E67E22',
        border: '1px solid rgba(255,255,255,0.1)',
      },
    },
  }}
  closeButton
  gap={8}
/>

=== TASK 2: Upgrade GlobalErrorBoundary.tsx ===

Read the existing file.

Make the error screen visually premium:

DESIGN:
  Full screen: bg-[#FAF7F4] flex flex-col items-center justify-center min-h-screen px-6
  
  ILLUSTRATION (CSS only, no image needed):
    A large circle: w-32 h-32 rounded-full bg-red-100 flex items-center justify-center mx-auto
    Inside: AlertTriangle icon, 64px, text-red-400
    Rotating orbit ring:
    <div className="absolute w-40 h-40 rounded-full border-2 border-dashed border-red-200 animate-spin" style={{animationDuration:'8s'}} />
  
  Title: "Oops, something went wrong" — text-2xl font-bold text-gray-900 mt-8
  
  Subtitle: text-gray-500 text-sm mt-2 max-w-sm text-center
  
  Error code (in dev): 
    <code className="text-xs bg-red-50 text-red-400 px-3 py-1 rounded-lg font-mono mt-4">
      {errorCode || 'RUNTIME_ERROR'}
    </code>
  
  Buttons row (mt-8, gap-3):
    [Reload Page] btn btn-primary
    [Go Home] btn btn-outline

=== TASK 3: Upgrade PageLoader.tsx ===

Read the existing file. Current: spinning ring.

NEW DESIGN:
  Full screen: fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center

  LOGO ANIMATION:
    The DineLuxe logo (or a fork+knife icon) that pulses in gold:
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-lg">
        <Utensils className="text-white" size={28} />
      </div>
      {/* Orbiting ring */}
      <div className="absolute -inset-3 rounded-3xl border-2 border-[#E8A020]/30 animate-spin" 
           style={{animationDuration:'2s'}} />
      <div className="absolute -inset-5 rounded-full border border-[#1A3C5E]/10 animate-spin"
           style={{animationDuration:'3s', animationDirection:'reverse'}} />
    </div>
  
  Tagline below: "DineLuxe" text-xl font-bold text-[#1A3C5E] mt-5
  
  Loading message (if provided): text-sm text-gray-400 mt-2 animate-pulse

=== TASK 4: Add page background pattern to body ===

In globals.css, update the body styles:

body {
  background: var(--background);
  /* Subtle dot pattern for depth */
  background-image: radial-gradient(rgba(26,60,94,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

NOTE: The pattern should be barely visible — just adds texture.
For white card surfaces (bg-white), the pattern won't show inside cards.

Return all 3 updated files + the globals.css body update.
```

---

# ═══════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════

## 🎨 COMPLETE STYLING PROMPT MAP

| Prompt | Target Area | Key Visual Upgrade |
|---|---|---|
| **ST-1** | globals.css + tailwind.config | Glass, gradients, button layer, input layer |
| **ST-2** | Sidebar | Dark navy, gold active state, collapse animations |
| **ST-3** | PageWrapper + BottomNav | Gradient headers, glass nav bar, floating scan button |
| **ST-4** | Auth pages | Split screen login, upgraded OTP boxes, step wizard |
| **ST-5** | Customer Home + FoodCard | Restaurant cards with hover lift, spring add-to-cart |
| **ST-6** | Owner + Admin Dashboards | Gradient KPIs, chart gradients, heatmap gold peaks |
| **ST-7** | Waiter Grid + Host Queue | Rich table status cells, queue urgency system |
| **ST-8** | Kitchen Display (KDS) | Professional dark ticket cards, timer urgency colors |
| **ST-9** | Cashier POS + PaymentModal | Navy bill panel, POS layout, payment method tiles |
| **ST-10** | DataTable + Skeleton + Dialogs | Hover rows, shimmer upgrades, delayed confirm |
| **ST-11** | Owner Pages (Menu, Staff, Branding) | Grid cards, phone mockup preview, gradient avatars |
| **ST-12** | Delivery + Admin Polish | Online toggle, health score hero, pending restaurant banner |
| **ST-13** | Toasts + Loading States + Global | Custom sonner, branded loader, dot pattern background |

## 📁 FILES MODIFIED BY STYLING PROMPTS

```
GLOBAL:
  app/globals.css                         ← ST-1, ST-13
  tailwind.config.ts                      ← ST-1

LAYOUT:
  components/layout/Sidebar.tsx           ← ST-2
  components/layout/PageWrapper.tsx       ← ST-3
  components/layout/BottomNav.tsx         ← ST-3
  app/layout.tsx                          ← ST-13

AUTH:
  app/auth/login/page.tsx                 ← ST-4
  components/auth/LoginForm.tsx           ← ST-4
  components/auth/OTPInput.tsx            ← ST-4
  components/auth/RestaurantSignupWizard.tsx ← ST-4

CUSTOMER:
  app/customer/home/page.tsx              ← ST-5
  components/shared/FoodCard.tsx          ← ST-5

DASHBOARDS:
  components/shared/KPICard.tsx           ← ST-6
  app/owner/dashboard/page.tsx            ← ST-6
  app/admin/dashboard/page.tsx            ← ST-6

STAFF OPERATIONAL:
  components/floor/FloorMap.tsx           ← ST-7
  components/shared/TableUnit.tsx         ← ST-7
  app/staff/waiter/page.tsx              ← ST-7
  app/staff/host/queue/page.tsx          ← ST-7
  components/shared/QueueCard.tsx         ← ST-7
  app/staff/chef/kitchen/page.tsx        ← ST-8
  app/staff/cashier/page.tsx             ← ST-9
  components/payment/PaymentModal.tsx     ← ST-9

SHARED COMPONENTS:
  components/shared/DataTable.tsx         ← ST-10
  components/shared/SkeletonCard.tsx      ← ST-10
  components/shared/EmptyState.tsx        ← ST-10
  components/shared/ConfirmDialog.tsx     ← ST-10

OWNER PAGES:
  components/owner/MenuManagement.tsx     ← ST-11
  app/owner/branding/page.tsx            ← ST-11
  components/owner/StaffManagement.tsx    ← ST-11

DELIVERY + ADMIN:
  app/delivery/page.tsx                  ← ST-12
  app/delivery/earnings/page.tsx         ← ST-12
  app/admin/platform-health/page.tsx     ← ST-12
  app/admin/restaurants/page.tsx         ← ST-12

GLOBAL POLISH:
  components/error/GlobalErrorBoundary.tsx ← ST-13
  components/shared/PageLoader.tsx        ← ST-13
```

## 📐 EXECUTION ORDER

```
Run in this exact order (each builds on the previous):

1. ST-1  → globals.css + tailwind.config  [FOUNDATION — run FIRST]
2. ST-2  → Sidebar
3. ST-3  → PageWrapper + BottomNav
4. ST-4  → Auth pages
5. ST-5  → Customer app
6. ST-6  → Dashboards
7. ST-7  → Staff operational interfaces
8. ST-8  → Kitchen display
9. ST-9  → Cashier POS
10. ST-10 → Shared components
11. ST-11 → Owner pages
12. ST-12 → Delivery + Admin
13. ST-13 → Global polish [run LAST]
```

---

*Restaurant OS — Complete UI/UX Styling Prompts*
*13 prompts covering every screen, every component, every interaction*
*Priyanshu Kumar Gupta & Ronit Gupta | DineLuxe 2025*

---

# ═══════════════════════════════════════════════
# ST-14 — CUSTOMER ORDER FLOW
# Order History + Cart + Payment Success
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/customer/order/history/page.tsx       (full — 4.8KB)
app/customer/payment/success/page.tsx     (full — 9.2KB)
app/customer/cart/page.tsx                (full — if exists)
app/globals.css                           (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are styling the customer order flow — the most important customer journey.

=== ENHANCE 1: app/customer/order/history/page.tsx ===

Read the full file. It shows a list of past orders with Reorder buttons.

CURRENT STATE: Uses PageWrapper + basic white cards.
TARGET: Rich timeline-style order history.

PAGE HEADER:
  Hero section matching the customer app style:
  bg-gradient-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-10 pb-6 relative
  Title: "Order History" in white, bold
  Subtitle: "Your past meals" in white/60
  Order count chip: "[n] orders" in gold pill

ORDER CARDS (each past order):
  bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3
  
  TOP ROW (px-4 pt-4):
    Left: Restaurant name (font-semibold) + branch
    Right: StatusBadge + date (text-xs text-gray-400)
  
  MIDDLE ROW (px-4 py-2 bg-gray-50/50):
    Items summary: "Butter Chicken × 1, Dal Makhani × 2..." truncated
    text-sm text-gray-600, line-clamp-1
  
  BOTTOM ROW (px-4 pb-4 flex items-center justify-between):
    Order total: font-bold text-lg text-[#1A3C5E]
    Order type chip: "Dine-In" / "Delivery" (rounded-full text-xs)
    [Reorder] button: btn-gold btn-sm with ↺ icon

  PAID orders: green left border accent (2px)
  CANCELLED orders: opacity-60, red left border

  Entrance animation: staggered fade-in (0.05s per item)

=== ENHANCE 2: app/customer/payment/success/page.tsx ===

Read the full file. It has a success animation with green circle.

CURRENT: Green circle + check icon, basic layout.
TARGET: Celebratory, memorable success moment.

FULL PAGE:
  Background: bg-[#FAF7F4]
  
  SUCCESS ANIMATION (top section):
    Centered circle with rings:
    - Inner circle: w-24 h-24 bg-green-500 rounded-full flex items-center justify-center
      White checkmark: CheckCircle2 icon 48px white
    - Ring 1: absolute -inset-4 rounded-full border-4 border-green-400/30 animate-ping (once)
    - Ring 2: absolute -inset-8 rounded-full border-2 border-green-300/20 animate-ping delay-150 (once)
    
    Confetti: use CSS animation only (no library):
      6 small colored squares positioned around the circle:
      <div className="absolute w-3 h-3 bg-[#E8A020] rounded-sm animate-confetti-1" />
      (positioned at different angles, animating outward and fading)
    
    Add to globals.css:
      @keyframes confetti-fly {
        0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) rotate(360deg); opacity: 0; }
      }
  
  "Order Confirmed!" title: text-2xl font-bold text-gray-900 mt-6
  Order ID: "#ABC-1234" text-sm text-gray-500 font-mono mt-1
  
  BILL SUMMARY CARD:
    bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-6
    Header: "Order Summary" text-sm font-semibold text-gray-400 uppercase
    Items: clean list with dividers
    Total: font-bold text-[#1A3C5E] text-xl
    
    "Loyalty points earned: +24 🏆" gold chip if applicable

  LOYALTY EARNED TOAST-STYLE BANNER (if points earned):
    bg-gradient-to-r from-[#E8A020]/10 to-[#E8A020]/5
    border border-[#E8A020]/20 rounded-2xl p-4
    🏆 icon + "You earned 48 DineLuxe Points!" text-sm font-semibold text-[#B8860B]

  ACTION BUTTONS (bottom):
    [Download Receipt] btn btn-outline full-width
    [View Order Status] btn btn-primary full-width mt-2
    [Back to Home] text button below, text-gray-500 text-sm

=== ENHANCE 3: Cart page (if it exists) ===

If app/customer/cart/page.tsx exists and has content:

CART HEADER:
  bg-[#1A3C5E] px-4 pt-10 pb-6
  "My Cart" white title + item count badge

RESTAURANT INFO BAR (if cart has items from a restaurant):
  White pill below header: restaurant name + "2.3km · 30 min delivery"

ITEMS LIST:
  Each cart item row:
    bg-white rounded-2xl p-4 mb-2 border border-gray-100 shadow-sm
    Left: food thumbnail (rounded-xl) or emoji fallback
    Middle: name + customizations/notes (text-xs text-gray-400)
    Right: [−] qty [+] stepper in gold pill
    Price: font-bold text-[#1A3C5E] below stepper
    Swipe-to-delete indicator (CSS only): red zone on right with trash icon

BILL SUMMARY (sticky bottom or at bottom of scroll):
  Card: bg-white rounded-2xl border-t-2 border-[#1A3C5E]/10 p-5
  Lines: Subtotal, Delivery fee, GST, Grand Total
  [Proceed to Payment] → btn btn-primary full-width h-14 text-lg

Return all 3 updated files.
```

---

# ═══════════════════════════════════════════════
# ST-15 — OWNER INVENTORY + SHIFTS CALENDAR
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/owner/inventory/page.tsx    (full — 20.7KB)
app/owner/shifts/page.tsx       (full — 18.5KB)
app/globals.css                 (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are polishing two critical owner operational pages.

=== ENHANCE 1: app/owner/inventory/page.tsx ===

Read the full file. It manages stock levels with add/edit/deduct functionality.

A) INVENTORY ITEM ROWS (the main list):

  Current: basic table rows or cards.
  New: each inventory item as a visual row card:
    flex items-center gap-4 bg-white rounded-xl px-5 py-4 border border-gray-100 shadow-sm mb-2
    hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
  
  STOCK LEVEL INDICATOR (the most important visual element):
    A mini horizontal bar showing stock vs threshold:
    
    const stockPct = Math.min((currentStock / maxStock) * 100, 100)
    const isLow = currentStock <= alertThreshold
    const isCritical = currentStock <= alertThreshold * 0.5
    
    Bar container: h-2 bg-gray-100 rounded-full w-24 overflow-hidden
    Bar fill:
      isCritical: bg-red-500 + animate-pulse
      isLow:     bg-amber-400
      normal:    bg-green-400
    
    Stock text next to bar: 
      isCritical: text-red-600 font-bold text-sm
      isLow:      text-amber-600 font-semibold text-sm
      normal:     text-gray-700 text-sm
    
    Unit: text-xs text-gray-400 next to stock number

  CRITICAL ITEMS BANNER (if any items critical):
    At top of page: bg-red-50 border border-red-200 rounded-2xl p-4
    "⚠️ 3 items need restocking" with red text
    Scrollable horizontal list of critical items as chips:
    Each chip: bg-red-100 text-red-700 text-xs rounded-full px-3 py-1

B) CATEGORY FILTER TABS:
  Pill tabs matching the menu management pattern (from ST-11).

C) DEDUCT MODAL (when deducting stock):
  Modal: bg-white rounded-2xl shadow-xl p-6
  Input: large numeric input, centered, big font
  Preset buttons: [-1] [-5] [-10] [-25] quick deduct
  Each: bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 text-sm font-mono

=== ENHANCE 2: app/owner/shifts/page.tsx ===

Read the full shifts page (weekly calendar grid).

The shifts page already has some brand styling.
TARGET: A premium work schedule calendar, like a professional HR tool.

A) CALENDAR HEADER:
  Week navigation row:
    [← Prev Week] | "Mon 10 – Sun 16 Jun 2025" | [Next Week →]
    Each nav button: btn btn-ghost btn-sm with ChevronLeft/Right icon
    Date range: font-semibold text-gray-900 text-lg
    
    Today button: "Jump to Today" text button (text-[#E8A020])

B) COLUMN HEADERS (days of week):
  Each day column header:
    Day name (Mon, Tue...): text-sm font-semibold text-gray-500 uppercase tracking-wide
    Date number: text-xl font-bold text-gray-900
    TODAY: text-white, bg circle behind the date number:
      w-9 h-9 rounded-full bg-[#1A3C5E] flex items-center justify-center

C) STAFF ROWS:
  Each staff row:
    Left: Staff name card (sticky left):
      bg-white border-r border-gray-100 px-3 py-3 min-w-[140px]
      Avatar circle (role-colored, matching ST-11)
      Name: text-sm font-semibold
      Role badge: small, 1-2 words

  SHIFT CELLS (for each day of the week):
    Has shift: 
      bg-gradient-to-r from-[#1A3C5E] to-[#1E4D78] rounded-xl p-2 text-white
      Start time: text-xs font-mono font-bold
      End time: text-xs font-mono text-white/70
      Duration: text-[10px] text-white/50
      Hover: opacity-90 + tooltip showing "Click to edit"
    
    No shift (day off):
      bg-gray-50 rounded-xl border border-dashed border-gray-200
      "—" centered, text-gray-300
      Hover: bg-gray-100, shows "+" button to add shift
    
    TODAY COLUMN: subtle gold background tint: bg-[#E8A020]/4

D) ADD SHIFT BUTTON/MODAL:
  Each empty cell hover shows a + icon → clicking opens AddShiftModal
  Modal: bg-white rounded-2xl p-6 shadow-xl
  "Add Shift for [Staff Name] on [Date]"
  Time picker: large styled inputs for start/end time
  Duration preview: "8 hours" calculated live

Return both fully updated files.
```

---

# ═══════════════════════════════════════════════
# ST-16 — FINAL ANIMATION PASS + RESPONSIVENESS
# Polish Every Transition and Mobile Experience
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/layout.tsx                       (root layout)
app/customer/layout.tsx              (customer layout)
app/owner/layout.tsx                 (owner layout)
app/staff/layout.tsx                 (staff layout)
components/layout/Sidebar.tsx        (ST-2 updated version)
components/layout/BottomNav.tsx      (ST-3 updated version)
app/globals.css                      (ST-1 updated)
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are completing the final polish pass — animation consistency and mobile experience.

=== TASK 1: Page Transition System ===

Read app/layout.tsx and customer/layout.tsx.

ADD a page transition wrapper using framer-motion AnimatePresence.

In app/layout.tsx (root):
  Wrap {children} with a page transition provider.
  
  The simplest effective approach:
  In each role layout (owner, staff, customer, admin):
  
  'use client'
  import { motion, AnimatePresence } from 'framer-motion'
  import { usePathname } from 'next/navigation'
  
  const pathname = usePathname()
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )

Apply this pattern to all 4 role layouts.

=== TASK 2: Mobile Safe Area Padding ===

Add to globals.css:
  /* Safe area insets for mobile notch/home indicator */
  .safe-top    { padding-top: env(safe-area-inset-top); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  .safe-left   { padding-left: env(safe-area-inset-left); }
  .safe-right  { padding-right: env(safe-area-inset-right); }
  
  /* Content padding to avoid BottomNav overlap */
  .pb-nav { padding-bottom: calc(4rem + env(safe-area-inset-bottom)); }

Update BottomNav container to include safe-area-inset-bottom in its height.
Update all customer pages that use pb-24 → use pb-nav instead.

=== TASK 3: Scroll Behavior + Overscroll ===

Add to globals.css:
  html {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
  }
  
  /* Prevent overscroll bounce on full-page containers */
  .no-overscroll {
    overscroll-behavior: contain;
  }
  
  /* Smooth scrollable list */
  .scroll-container {
    overflow-y: auto;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

=== TASK 4: Focus Accessibility ===

Add to globals.css:
  /* Visible focus rings for keyboard navigation */
  :focus-visible {
    outline: 2px solid #E8A020;
    outline-offset: 2px;
    border-radius: 6px;
  }
  
  /* Remove focus ring for mouse/touch users */
  :focus:not(:focus-visible) {
    outline: none;
  }

=== TASK 5: Reduce Motion for Accessibility ===

Add to globals.css:
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

=== TASK 6: Print Styles (for Receipts) ===

Add to globals.css:
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    body { background: white !important; }
    .card, .surface-card {
      border: 1px solid #ddd !important;
      box-shadow: none !important;
      break-inside: avoid;
    }
  }

=== TASK 7: Touch Interaction Improvements ===

Add to globals.css:
  /* Larger tap targets on mobile */
  @media (max-width: 768px) {
    .btn-sm { min-height: 36px; }
    .btn { min-height: 44px; }
    
    /* Touch feedback */
    .btn:active,
    .card-interactive:active {
      opacity: 0.85;
      transform: scale(0.98);
    }
  }

  /* Prevent text selection on interactive elements */
  .btn,
  .card-interactive,
  button {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

=== TASK 8: Dark Mode Sidebar Scroll Indicator ===

In Sidebar.tsx (ST-2 version):
  The scrollable nav area should show a subtle gradient fade at bottom
  when there are more items below:
  
  <div className="relative flex-1 overflow-hidden">
    <div className="h-full overflow-y-auto no-scrollbar px-3 py-2">
      {/* nav items */}
    </div>
    {/* Gradient fade at bottom */}
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 
                    bg-gradient-to-t from-[#0D2A45] to-transparent" />
  </div>

=== TASK 9: Image Loading Optimization ===

For all img tags that use loading="lazy" (like FoodCard, restaurant cards):
  Add blur placeholder pattern:
  
  State: const [isLoaded, setIsLoaded] = useState(false)
  
  <div className="relative overflow-hidden">
    {!isLoaded && (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-shimmer" />
    )}
    <img
      src={src}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      className={cn(
        "w-full h-full object-cover transition-opacity duration-300",
        isLoaded ? "opacity-100" : "opacity-0"
      )}
      loading="lazy"
    />
  </div>
  
  (This pattern is already in FoodCard — confirm it's consistent everywhere)

Return:
- Updated app/globals.css (all task additions)
- Updated customer/layout.tsx, owner/layout.tsx, staff/layout.tsx (page transitions)
- Updated BottomNav.tsx (safe area fix)
```

---

# ═══════════════════════════════════════════════
# COMPLETE UPDATED FILE MAP (All 16 Prompts)
# ═══════════════════════════════════════════════

## 📁 COMPLETE STYLING FILE LIST

```
FOUNDATION (must run first):
  app/globals.css                              ← ST-1, ST-14 (confetti), ST-16 (polish)
  tailwind.config.ts                           ← ST-1

LAYOUT SYSTEM:
  components/layout/Sidebar.tsx               ← ST-2
  components/layout/PageWrapper.tsx            ← ST-3
  components/layout/BottomNav.tsx              ← ST-3, ST-16
  app/layout.tsx                              ← ST-13
  app/customer/layout.tsx                     ← ST-16
  app/owner/layout.tsx                        ← ST-16
  app/staff/layout.tsx                        ← ST-16

AUTH SCREENS:
  app/auth/login/page.tsx                     ← ST-4
  components/auth/LoginForm.tsx               ← ST-4
  components/auth/OTPInput.tsx                ← ST-4
  components/auth/RestaurantSignupWizard.tsx  ← ST-4

CUSTOMER APP:
  app/customer/home/page.tsx                  ← ST-5
  app/customer/order/history/page.tsx         ← ST-14
  app/customer/payment/success/page.tsx       ← ST-14
  app/customer/cart/page.tsx                  ← ST-14 (if exists)

SHARED COMPONENTS:
  components/shared/FoodCard.tsx              ← ST-5
  components/shared/KPICard.tsx               ← ST-6
  components/shared/DataTable.tsx             ← ST-10
  components/shared/SkeletonCard.tsx          ← ST-10
  components/shared/EmptyState.tsx            ← ST-10
  components/shared/ConfirmDialog.tsx         ← ST-10
  components/shared/QueueCard.tsx             ← ST-7
  components/shared/TableUnit.tsx             ← ST-7

DASHBOARDS:
  app/owner/dashboard/page.tsx               ← ST-6
  app/admin/dashboard/page.tsx               ← ST-6

STAFF OPERATIONAL:
  components/floor/FloorMap.tsx              ← ST-7
  app/staff/waiter/page.tsx                 ← ST-7
  app/staff/host/queue/page.tsx             ← ST-7
  app/staff/chef/kitchen/page.tsx           ← ST-8
  app/staff/cashier/page.tsx               ← ST-9
  components/payment/PaymentModal.tsx        ← ST-9

OWNER PAGES:
  components/owner/MenuManagement.tsx        ← ST-11
  app/owner/branding/page.tsx              ← ST-11
  components/owner/StaffManagement.tsx      ← ST-11
  app/owner/inventory/page.tsx             ← ST-15
  app/owner/shifts/page.tsx               ← ST-15

DELIVERY + ADMIN:
  app/delivery/page.tsx                    ← ST-12
  app/delivery/earnings/page.tsx           ← ST-12
  app/admin/platform-health/page.tsx       ← ST-12
  app/admin/restaurants/page.tsx           ← ST-12

GLOBAL POLISH:
  components/error/GlobalErrorBoundary.tsx  ← ST-13
  components/shared/PageLoader.tsx          ← ST-13
```

## 📐 FINAL EXECUTION ORDER

```
ROUND 1 — FOUNDATION (no dependencies)
  ST-1  → globals.css + tailwind.config       [START HERE]

ROUND 2 — CORE LAYOUT (ST-1 required)
  ST-2  → Sidebar
  ST-3  → PageWrapper + BottomNav
  ST-13 → Toasts + PageLoader + Error Boundary

ROUND 3 — AUTH + CUSTOMER (ST-1, ST-3 required)
  ST-4  → Auth pages
  ST-5  → Customer Home + FoodCard
  ST-14 → Customer Order Flow

ROUND 4 — DASHBOARDS (ST-1, ST-6 required)
  ST-6  → Owner + Admin dashboards + KPICard

ROUND 5 — STAFF OPERATIONAL (ST-1, ST-7 required)
  ST-7  → Waiter + Host + Table Grid
  ST-8  → Kitchen Display
  ST-9  → Cashier POS

ROUND 6 — SHARED + OWNER (ST-1 required)
  ST-10 → DataTable + Skeleton + Dialogs
  ST-11 → Owner Menu + Branding + Staff
  ST-15 → Owner Inventory + Shifts

ROUND 7 — DELIVERY + ADMIN
  ST-12 → Delivery + Admin pages

ROUND 8 — FINAL PASS (all previous required)
  ST-16 → Animations + Mobile + Accessibility  [RUN LAST]
```

---

**TOTAL: 16 Styling Prompts | 42 Files Modified**
*Every screen in Restaurant OS is covered.*
*From the login portal to the kitchen display to the receipt success page.*

*Restaurant OS — Complete UI/UX Styling Library*
*Priyanshu Kumar Gupta & Ronit Gupta | DineLuxe 2025*
