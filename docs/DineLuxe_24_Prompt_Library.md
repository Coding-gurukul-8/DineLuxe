# 🍽️ Restaurant OS — Complete Implementation Prompt Library
## Gap Analysis & Detailed Build Prompts
**Prepared for: Priyanshu Kumar Gupta & Ronit Gupta | Version 2.0 — 2025**

---

## 📋 HOW TO USE THIS DOCUMENT

Each **PROMPT BLOCK** below is a complete, self-contained instruction you give to Claude.

**Before each prompt:**
1. Open the listed **"FILES TO PROVIDE"** in your editor
2. Copy-paste their **full code contents** into the Claude chat along with the prompt text
3. Claude will analyse all provided files and return the **complete implementation** in one response

**Symbols used:**
- 🆕 = Brand new file that doesn't exist yet — create it
- ✏️ = Existing file that needs modification
- 📁 = Folder/directory to create

---

## 🗺️ GAP ANALYSIS SUMMARY

After comparing the product document with all provided ZIP files, here is what needs to be built:

### ❌ MISSING BACKEND MODULES (New files)
| Module | Files Needed | Priority |
|--------|-------------|---------|
| `recipe-ingredients` | routes, controller, service, schema | HIGH |
| `waste-log` | routes, controller, service, schema | HIGH |
| `shifts` | routes, controller, service, schema | HIGH |
| `recommendations` | routes, controller, service | MEDIUM |
| `chatbot` | routes, controller, service | MEDIUM |
| `staffing` | routes, controller, service | MEDIUM |
| `dynamic-pricing` | routes, controller, service, schema | MEDIUM |
| `customer-preferences` | routes, controller, service, schema | MEDIUM |
| `staff-feedback` | routes, controller, service, schema | MEDIUM |

### ❌ MISSING DATABASE TABLES (Schema additions)
| Table | Purpose |
|-------|---------|
| `shifts` | Staff shift scheduling |
| `dynamic_pricing_rules` | Happy hour pricing |
| `social_dining_groups` | Group booking feature |

### ❌ MISSING FRONTEND PAGES (New pages)
| Page Path | Purpose |
|-----------|---------|
| `app/owner/floor/page.tsx` | Floor layout manager |
| `app/owner/floor/[branchId]/page.tsx` | Branch floor designer |
| `app/admin/staff-reviews/page.tsx` | Anonymous staff feedback |

### ⚠️ STUB FRONTEND PAGES (Need real implementation)
| Page Path | Current Size | Fix Needed |
|-----------|-------------|------------|
| `app/staff/manager/floor/page.tsx` | 116 bytes (RouteShell) | Full live floor map |
| `app/staff/dashboard/page.tsx` | 136 bytes | Role-aware redirect |
| `app/staff/dasboard/page.tsx` | 146 bytes (typo!) | Delete or redirect |
| `app/owner/menu/page.tsx` | 126 bytes | Full menu management |
| `app/owner/settings/page.tsx` | 116 bytes (RouteShell) | Settings page |
| `app/auth/onboarding/step-2/page.tsx` | 184 bytes | Onboarding step content |
| `app/auth/onboarding/step-3/page.tsx` | 184 bytes | Onboarding step content |
| `app/auth/onboarding/step-4/page.tsx` | 184 bytes | Onboarding step content |
| `app/auth/onboarding/step-5/page.tsx` | 184 bytes | Onboarding step content |

### ❌ MISSING FRONTEND COMPONENTS
| Component Path | Purpose |
|---------------|---------|
| `components/floor/FloorLayoutDesigner.tsx` | Drag-and-drop floor plan editor |
| `components/ai/ChatbotWidget.tsx` | AI support chatbot UI |
| `components/ai/DemandPrediction.tsx` | Manager staffing prediction |
| `components/ai/SmartPricingWidget.tsx` | Dynamic pricing suggestions |
| `components/customer/SocialDining.tsx` | Group booking feature |
| `components/customer/DietaryProfile.tsx` | Dietary preferences editor |
| `components/admin/StaffFeedbackViewer.tsx` | Anonymous feedback list |

---

## 📁 NEW FOLDER/FILE STRUCTURE TO CREATE

The following directories and files need to be created in your project:

```
backend/src/modules/
├── 🆕 recipe-ingredients/
│   ├── recipe-ingredients.routes.ts
│   ├── recipe-ingredients.controller.ts
│   ├── recipe-ingredients.service.ts
│   └── recipe-ingredients.schema.ts
├── 🆕 waste-log/
│   ├── waste-log.routes.ts
│   ├── waste-log.controller.ts
│   ├── waste-log.service.ts
│   └── waste-log.schema.ts
├── 🆕 shifts/
│   ├── shifts.routes.ts
│   ├── shifts.controller.ts
│   ├── shifts.service.ts
│   └── shifts.schema.ts
├── 🆕 recommendations/
│   ├── recommendations.routes.ts
│   ├── recommendations.controller.ts
│   └── recommendations.service.ts
├── 🆕 chatbot/
│   ├── chatbot.routes.ts
│   ├── chatbot.controller.ts
│   └── chatbot.service.ts
├── 🆕 staffing/
│   ├── staffing.routes.ts
│   ├── staffing.controller.ts
│   └── staffing.service.ts
├── 🆕 dynamic-pricing/
│   ├── dynamic-pricing.routes.ts
│   ├── dynamic-pricing.controller.ts
│   ├── dynamic-pricing.service.ts
│   └── dynamic-pricing.schema.ts
├── 🆕 customer-preferences/
│   ├── customer-preferences.routes.ts
│   ├── customer-preferences.controller.ts
│   ├── customer-preferences.service.ts
│   └── customer-preferences.schema.ts
└── 🆕 staff-feedback/
    ├── staff-feedback.routes.ts
    ├── staff-feedback.controller.ts
    ├── staff-feedback.service.ts
    └── staff-feedback.schema.ts

frontend/
├── app/
│   ├── 🆕 owner/floor/
│   │   ├── page.tsx
│   │   └── [branchId]/
│   │       └── page.tsx
│   └── 🆕 admin/staff-reviews/
│       └── page.tsx
└── components/
    ├── 🆕 floor/FloorLayoutDesigner.tsx
    ├── 🆕 ai/ChatbotWidget.tsx
    ├── 🆕 ai/DemandPrediction.tsx
    ├── 🆕 ai/SmartPricingWidget.tsx
    ├── 🆕 customer/SocialDining.tsx
    ├── 🆕 customer/DietaryProfile.tsx
    └── 🆕 admin/StaffFeedbackViewer.tsx
```

---

# ═══════════════════════════════════════════════
# GROUP 1: DATABASE SCHEMA ADDITIONS
# ═══════════════════════════════════════════════

---

## PROMPT 1 — Complete Prisma Schema: Add Missing Tables

### 📂 Files to Provide to Claude

```
backend/prisma/schema.prisma   (the full 32KB file from backend.zip)
```

### 🎯 Task for Claude

```
You are working on Restaurant OS — a multi-tenant real-time restaurant operating system 
built with Node.js/Express backend using Supabase/PostgreSQL.

I am giving you the full existing Prisma schema file: `backend/prisma/schema.prisma`

Please read it completely, then ADD the following MISSING models to the end of the 
schema file. Do NOT change or remove any existing models — only append new ones.

=== NEW MODELS TO ADD ===

1. MODEL: Shift
   Purpose: Staff shift scheduling — the owner/manager assigns work shifts to staff
   Table name: shifts
   Fields:
     - id: UUID primary key (gen_random_uuid())
     - branch_id: UUID FK → branches(id) ON DELETE CASCADE
     - staff_id: UUID FK → users(id) ON DELETE CASCADE  
     - date: Date (the specific working date, e.g. 2025-08-15)
     - start_time: String(8) — HH:MM:SS format, e.g. "09:00:00"
     - end_time: String(8) — HH:MM:SS format, e.g. "17:00:00"
     - role_for_shift: String(50)? — optional role override for that shift
     - notes: String(500)?
     - created_by: UUID FK → users(id) — who created this shift entry
     - created_at: DateTime @default(now())
     - updated_at: DateTime @default(now()) @updatedAt
   Relations:
     - branch → Branch
     - staff → User (named "shiftStaff")
     - created_by_user → User (named "shiftCreator")
   Indexes: (branch_id, date), (staff_id, date)
   @@map("shifts")
   @@unique([staff_id, branch_id, date]) — one shift per staff per day per branch

2. MODEL: DynamicPricingRule
   Purpose: Happy hour pricing — items discounted during off-peak hours
   Table name: dynamic_pricing_rules
   Fields:
     - id: UUID primary key
     - branch_id: UUID FK → branches(id) ON DELETE CASCADE
     - menu_item_id: UUID FK → menu_items(id) ON DELETE CASCADE — null means applies to whole category
     - menu_category_id: UUID FK → menu_categories(id) ON DELETE SET NULL — null means per item
     - rule_name: String(100) — e.g. "Happy Hour", "Weekend Special"
     - discount_type: Enum → "percentage" | "fixed_amount"
     - discount_value: Decimal(10,2) — e.g. 20.00 for 20% or ₹20
     - days_of_week: Int[] — e.g. [1,2,3,4,5] for Mon-Fri (0=Sun, 6=Sat)
     - start_time: String(8) — "15:00:00" (3 PM)
     - end_time: String(8) — "17:00:00" (5 PM)
     - is_active: Boolean @default(true)
     - created_by: UUID FK → users(id)
     - created_at: DateTime @default(now())
     - updated_at: DateTime @default(now()) @updatedAt
   Relations:
     - branch → Branch
     - menu_item (optional) → MenuItem
     - menu_category (optional) → MenuCategory
   Indexes: (branch_id, is_active)
   @@map("dynamic_pricing_rules")

3. MODEL: SocialDiningGroup
   Purpose: Group pre-ordering — friends join the same table booking
   Table name: social_dining_groups
   Fields:
     - id: UUID primary key
     - booking_id: UUID FK → bookings(id) ON DELETE CASCADE
     - invite_code: String(12) UNIQUE — random alphanumeric code
     - organizer_id: UUID FK → users(id) — the person who created the group
     - max_members: Int @default(10)
     - is_open: Boolean @default(true) — can new members join?
     - created_at: DateTime @default(now())
   Relations:
     - booking → Booking
     - organizer → User
     - members → SocialDiningMember[]
   @@map("social_dining_groups")

4. MODEL: SocialDiningMember
   Purpose: Individual member of a social dining group
   Table name: social_dining_members
   Fields:
     - id: UUID primary key
     - group_id: UUID FK → social_dining_groups(id) ON DELETE CASCADE
     - user_id: UUID FK → users(id) ON DELETE CASCADE
     - joined_at: DateTime @default(now())
     - pre_orders: Json? — array of { menu_item_id, quantity, notes }
   Relations:
     - group → SocialDiningGroup
     - user → User
   @@unique([group_id, user_id]) — one membership per user per group
   @@map("social_dining_members")

=== ALSO ADD THESE RELATIONS ON EXISTING MODELS ===

On model User — add these relation fields (without changing existing fields):
  shifts_assigned     Shift[] @relation("shiftStaff")
  shifts_created      Shift[] @relation("shiftCreator")
  social_dining_organized SocialDiningGroup[] @relation("SocialDiningOrganizer")
  social_dining_memberships SocialDiningMember[]
  dynamic_pricing_created DynamicPricingRule[]

On model Booking — add:
  social_dining_group SocialDiningGroup?

On model MenuItem — add:
  dynamic_pricing_rules DynamicPricingRule[]

On model MenuCategory — add:
  dynamic_pricing_rules DynamicPricingRule[]

On model Branch — add:
  shifts               Shift[]
  dynamic_pricing_rules DynamicPricingRule[]

=== ALSO: Create a new Enum ===

enum DiscountType {
  percentage
  fixed_amount
}

Use this enum for DynamicPricingRule.discount_type field.

=== OUTPUT ===

Return ONLY the additions — the new models, enum, and the updated relation lines 
to add to existing models. Format as a clearly labeled diff/addition so I can 
copy-paste each piece into the correct location in the schema file.

Include SQL migration comments at the top of each new model for documentation.
```

### 📤 Expected Output
- Updated additions to `backend/prisma/schema.prisma` 
- SQL migration snippet for running in Supabase dashboard

---

# ═══════════════════════════════════════════════
# GROUP 2: BACKEND — INVENTORY EXTENSIONS
# ═══════════════════════════════════════════════

---

## PROMPT 2 — Recipe Ingredients Module (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/inventory/inventory.service.ts
backend/src/modules/inventory/inventory.routes.ts
backend/src/modules/inventory/inventory.schema.ts
backend/src/modules/inventory/inventory.controller.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — a Node.js/Express/TypeScript backend with Supabase 
(PostgreSQL) as the database. You do NOT use Prisma at runtime; all DB queries use the 
Supabase JS admin client (`supabaseAdmin`).

I am providing the full existing inventory module as a reference pattern for 
architecture, error handling, middleware usage, and code style.

Please create a COMPLETE brand-new module: recipe-ingredients
This module handles the mapping of ingredients to menu items 
(e.g., "Butter Chicken requires 200g chicken, 30g butter, 50ml cream").

=== CREATE THESE 4 FILES ===

FILE 1: backend/src/modules/recipe-ingredients/recipe-ingredients.schema.ts
  Export these Zod schemas:
  
  upsertRecipeSchema: z.object({
    menu_item_id: z.string().uuid(),
    ingredients: z.array(z.object({
      inventory_item_id: z.string().uuid(),
      quantity_per_serving: z.number().positive().max(10000),
      unit: z.string().min(1).max(20)  // "g", "ml", "pieces"
    })).min(1).max(50)
  })
  
  deleteIngredientSchema: z.object({
    menu_item_id: z.string().uuid(),
    inventory_item_id: z.string().uuid()
  })

FILE 2: backend/src/modules/recipe-ingredients/recipe-ingredients.service.ts
  Import supabaseAdmin from '../../config/supabase'
  Table name: 'recipe_ingredients'
  
  Export these async functions:
  
  getRecipeForMenuItem(menuItemId: string, branchId: string):
    - Fetch all recipe_ingredients WHERE menu_item_id = menuItemId
    - JOIN with inventory_items to get ingredient name, unit, current_quantity
    - Verify the menu item belongs to the branch via menu_items.branch_id = branchId
    - Return array: { inventory_item_id, ingredient_name, quantity_per_serving, unit, current_stock }
  
  getRecipesForBranch(branchId: string):
    - Fetch all recipe mappings for the branch
    - Group by menu_item_id, include menu item name
    - Return: { menu_item_id, menu_item_name, ingredients: [...] }[]
  
  upsertRecipe(menuItemId: string, ingredients: Array<{inventory_item_id, quantity_per_serving, unit}>, branchId: string):
    - Verify menu item belongs to branchId (check menu_items table)
    - Verify all inventory_item_ids belong to branchId (check inventory_items table)  
    - Use supabaseAdmin.from('recipe_ingredients').upsert() with onConflict: 'menu_item_id,inventory_item_id'
    - Return the upserted count and the full updated recipe
  
  deleteIngredient(menuItemId: string, inventoryItemId: string, branchId: string):
    - Verify ownership (menu_item belongs to branch)
    - DELETE FROM recipe_ingredients WHERE menu_item_id = ? AND inventory_item_id = ?
  
  getRecipeIngredientRequirements(menuItemId: string, quantity: number):
    - Used internally by the orders/inventory pipeline
    - Returns: Array<{ inventory_item_id, total_quantity_needed, unit }>
    - Multiplies quantity_per_serving by the order quantity

FILE 3: backend/src/modules/recipe-ingredients/recipe-ingredients.controller.ts
  Import express Request, Response
  Import all service functions
  Import the { success, error } helpers from '../../utils/response'
  
  Wrap each service call in try/catch
  
  Controllers:
  - getByMenuItem: GET handler — calls getRecipeForMenuItem(req.params.menuItemId, req.branchId)
  - getByBranch: GET handler — calls getRecipesForBranch(req.branchId)
  - upsert: POST handler — calls upsertRecipe(body.menu_item_id, body.ingredients, req.branchId)
  - deleteIngredient: DELETE handler — calls deleteIngredient(body.menu_item_id, body.inventory_item_id, req.branchId)

FILE 4: backend/src/modules/recipe-ingredients/recipe-ingredients.routes.ts
  All routes require: authenticate, injectTenant, requireRole('manager', 'owner', 'chef')
  
  Routes:
  GET    /recipe-ingredients/branch          → getByBranch
  GET    /recipe-ingredients/menu-item/:menuItemId  → getByMenuItem
  POST   /recipe-ingredients                 → validate(upsertRecipeSchema), upsert
  DELETE /recipe-ingredients                 → validate(deleteIngredientSchema), deleteIngredient
  
  Export: export default router;

=== IMPORTANT CODE STYLE RULES ===
- All service functions must return typed data, never raw supabase responses
- Use the same error throwing pattern as inventory.service.ts:
  throw Object.assign(new Error('message'), { status: 404, code: 'NOT_FOUND' })
- Use const router: import('express').Router = Router(); for the router declaration
- Follow the exact same middleware import paths as shown in inventory.routes.ts
- No console.log in production code — use proper error propagation

Return all 4 complete files, clearly labeled with their full path.
```

### 📤 Expected Output
4 new files in `backend/src/modules/recipe-ingredients/`

---

## PROMPT 3 — Shifts Module (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/staff/staff.service.ts
backend/src/modules/staff/staff.routes.ts
backend/src/modules/staff/staff.schema.ts
backend/src/modules/staff/staff.controller.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
backend/src/config/supabase.ts
backend/src/utils/response.ts
backend/src/utils/pagination.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Node.js/Express/TypeScript backend with Supabase.
I provide the full staff module as a reference pattern for architecture and style.

The owner/manager shifts page (app/owner/shifts/page.tsx) already exists and calls:
  - GET  /staff/branch/:branchId  → (already exists in staff module)
  - POST /staff/:staffId/shifts   → body: { date, start_time, end_time }
  - GET  /staff/shifts?branch_id=&week_start=  → returns shifts for a week

I need to ADD shift management to the existing staff module AND create a dedicated 
shifts endpoint. Please create these files:

=== CREATE THESE 4 FILES ===

FILE 1: backend/src/modules/shifts/shifts.schema.ts
  Zod schemas:
  
  createShiftSchema: z.object({
    branch_id: z.string().uuid(),
    staff_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM').transform(t => t + ':00'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).transform(t => t + ':00'),
    notes: z.string().max(500).optional(),
  }).refine(data => data.start_time < data.end_time, {
    message: 'start_time must be before end_time'
  })
  
  updateShiftSchema: z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/).transform(t => t + ':00').optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).transform(t => t + ':00').optional(),
    notes: z.string().max(500).optional(),
  }).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' })
  
  getShiftsQuerySchema: z.object({
    branch_id: z.string().uuid(),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    staff_id: z.string().uuid().optional(),
  })

FILE 2: backend/src/modules/shifts/shifts.service.ts
  Table: 'shifts'
  
  Functions:
  
  getShiftsForWeek(branchId: string, weekStart: string, restaurantId: string):
    - weekStart is the Monday of the week (YYYY-MM-DD)
    - Fetch shifts WHERE branch_id = branchId AND date >= weekStart AND date <= addDays(weekStart, 6)
    - JOIN with users table to get staff name, role, employee_id
    - Verify branchId belongs to restaurantId (security check)
    - Returns: Array<{ id, staff_id, staff_name, staff_role, date, start_time, end_time, notes }>
    - Group by staff_id for calendar view
  
  createShift(data: { branch_id, staff_id, date, start_time, end_time, notes? }, createdBy: string, restaurantId: string):
    - Verify branch belongs to restaurantId
    - Verify staff member belongs to the same branch
    - Check for conflicting shift: SELECT WHERE staff_id = ? AND date = ? (one shift per day per staff)
    - If conflict: throw 409 error with code 'SHIFT_CONFLICT'
    - INSERT into shifts table with created_by = createdBy
    - Return the created shift with staff details
  
  createShiftForStaff(staffId: string, data: { date, start_time, end_time, notes? }, createdBy: string, branchId: string, restaurantId: string):
    - Verify staffId belongs to branchId and restaurantId
    - Calls createShift internally
  
  updateShift(shiftId: string, updates: object, restaurantId: string):
    - Verify shift belongs to restaurantId (via branch → restaurant)
    - UPDATE shifts SET ... WHERE id = shiftId
    - Return updated shift
  
  deleteShift(shiftId: string, restaurantId: string):
    - Verify ownership
    - DELETE FROM shifts WHERE id = shiftId

FILE 3: backend/src/modules/shifts/shifts.controller.ts
  Controllers for all service functions, proper try/catch error handling.
  
  getWeeklyShifts: GET — queries req.query for branch_id and week_start
  createShift: POST — uses req.body, req.user.id as createdBy
  updateShift: PATCH — uses req.params.id, req.body
  deleteShift: DELETE — uses req.params.id

FILE 4: backend/src/modules/shifts/shifts.routes.ts
  All routes: authenticate, injectTenant, requireRole('manager', 'owner')
  
  GET    /shifts           → validate query, getWeeklyShifts
  POST   /shifts           → validate(createShiftSchema), createShift
  PATCH  /shifts/:id       → validate(updateShiftSchema), updateShift
  DELETE /shifts/:id       → deleteShift

  ALSO: Add these routes as a sub-resource of staff (to match the frontend call pattern):
  POST   /staff/:staffId/shifts    → validate schema subset, createShiftForStaff
  GET    /staff/shifts             → validate query, getWeeklyShifts (same as /shifts GET)
  
  Note: The /staff/:staffId/shifts and /staff/shifts routes should be exported separately 
  for mounting in the staff routes file OR you can add a note explaining they need to 
  be registered separately in app.ts.

Return all 4 complete files with full file paths.
```

### 📤 Expected Output
4 new files in `backend/src/modules/shifts/`

---

## PROMPT 4 — Dynamic Pricing + Customer Preferences Modules (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/menu/menu.service.ts
backend/src/modules/menu/menu.routes.ts
backend/src/modules/menu/menu.schema.ts
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/utils/response.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Node.js/Express/TypeScript with Supabase + Redis.
I provide the menu module as reference. Please create TWO new backend modules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE A: dynamic-pricing  
Purpose: Happy hour / off-peak discounted pricing rules for menu items
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/dynamic-pricing/dynamic-pricing.schema.ts
  
  createRuleSchema: z.object({
    menu_item_id: z.string().uuid().optional().nullable(),
    menu_category_id: z.string().uuid().optional().nullable(),
    rule_name: z.string().min(1).max(100),
    discount_type: z.enum(['percentage', 'fixed_amount']),
    discount_value: z.number().positive().max(100, 'Percentage cannot exceed 100').or(z.number().positive()),
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).transform(t => t + ':00'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).transform(t => t + ':00'),
  }).refine(d => d.menu_item_id || d.menu_category_id, {
    message: 'Either menu_item_id or menu_category_id is required'
  }).refine(d => d.start_time < d.end_time, {
    message: 'start_time must be before end_time'
  })

FILE: backend/src/modules/dynamic-pricing/dynamic-pricing.service.ts
  Table: 'dynamic_pricing_rules'
  Redis cache key pattern: 'dynamic_pricing:{branchId}'  TTL: 5 minutes
  
  getRulesForBranch(branchId: string, restaurantId: string):
    - Check Redis cache first
    - Fetch active rules from dynamic_pricing_rules WHERE branch_id = branchId
    - JOIN menu_items for item name, menu_categories for category name
    - Cache result, return array of rules
  
  getActiveRulesNow(branchId: string): 
    - Get current time (IST: UTC+5:30)
    - Get current day of week (0-6)
    - Filter rules WHERE is_active=true AND current_day IN days_of_week 
    - AND current_time BETWEEN start_time AND end_time
    - Returns array of currently active discount rules
    - Used by: menu service to calculate discounted prices in real-time
  
  createRule(branchId: string, restaurantId: string, data: object, createdBy: string):
    - Verify branch belongs to restaurantId
    - If menu_item_id provided: verify it belongs to branchId
    - INSERT into dynamic_pricing_rules
    - Invalidate Redis cache for this branchId
    - Return the created rule
  
  updateRule(ruleId: string, branchId: string, restaurantId: string, updates: object):
    - Verify ownership (rule.branch_id === branchId, branch.restaurant_id === restaurantId)
    - UPDATE dynamic_pricing_rules SET ...
    - Invalidate cache
  
  toggleRule(ruleId: string, branchId: string, restaurantId: string):
    - Toggle is_active boolean
    - Invalidate cache
    - Emit WebSocket event 'menu_updated' to branch room (so customer app refreshes)
  
  deleteRule(ruleId: string, branchId: string, restaurantId: string):
    - Verify ownership, DELETE, invalidate cache

FILE: backend/src/modules/dynamic-pricing/dynamic-pricing.controller.ts
  Standard controller pattern with try/catch for all functions above.

FILE: backend/src/modules/dynamic-pricing/dynamic-pricing.routes.ts
  All routes: authenticate, injectTenant
  
  GET    /dynamic-pricing/branch/:branchId        → getRulesForBranch (role: manager, owner)
  GET    /dynamic-pricing/branch/:branchId/active → getActiveRulesNow (public — for menu)
  POST   /dynamic-pricing                         → requireRole(manager, owner), validate, createRule
  PATCH  /dynamic-pricing/:id                     → requireRole(manager, owner), validate, updateRule
  PATCH  /dynamic-pricing/:id/toggle              → requireRole(manager, owner), toggleRule
  DELETE /dynamic-pricing/:id                     → requireRole(manager, owner), deleteRule

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE B: customer-preferences  
Purpose: Table preference memory + dietary profiles for customers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/customer-preferences/customer-preferences.schema.ts
  
  saveTablePreferenceSchema: z.object({
    branch_id: z.string().uuid(),
    preferred_table_id: z.string().uuid(),
    preferred_table_label: z.string().max(10),
  })
  
  upsertDietaryProfileSchema: z.object({
    preferences: z.array(z.enum(['vegan', 'vegetarian', 'halal', 'jain', 'gluten_free', 'keto', 'high_protein'])).optional(),
    allergies: z.array(z.enum(['nuts', 'dairy', 'gluten', 'eggs', 'soy', 'shellfish', 'fish'])).optional(),
  }).refine(d => d.preferences || d.allergies, { message: 'At least one field required' })

FILE: backend/src/modules/customer-preferences/customer-preferences.service.ts
  Tables: 'customer_preferences', 'user_dietary_profiles'
  
  getTablePreference(userId: string, branchId: string):
    - SELECT FROM customer_preferences WHERE user_id = userId AND branch_id = branchId
    - Returns the preferred table info or null if none saved
    - Used by booking service to pre-select preferred table
  
  saveTablePreference(userId: string, branchId: string, tableId: string, tableLabel: string):
    - UPSERT customer_preferences with ON CONFLICT (user_id, branch_id)
    - On conflict: update preferred_table_id, preferred_table_label, increment times_selected, update last_selected
    - Return the preference record
  
  getAllPreferences(userId: string):
    - Get all table preferences for this user across all branches
    - JOIN branches for branch name
    - Returns: Array<{ branch_id, branch_name, preferred_table_label, times_selected }>
  
  getDietaryProfile(userId: string):
    - SELECT FROM user_dietary_profiles WHERE user_id = userId
    - Returns: { preferences: string[], allergies: string[] } or empty defaults
  
  upsertDietaryProfile(userId: string, data: { preferences?, allergies? }):
    - UPSERT user_dietary_profiles ON CONFLICT (user_id) DO UPDATE
    - Returns the updated profile

FILE: backend/src/modules/customer-preferences/customer-preferences.controller.ts
  Standard controller pattern.

FILE: backend/src/modules/customer-preferences/customer-preferences.routes.ts
  All routes: authenticate (customer auth)
  
  GET    /customer-preferences/dietary            → getDietaryProfile
  PATCH  /customer-preferences/dietary            → validate, upsertDietaryProfile
  GET    /customer-preferences/tables             → getAllPreferences
  GET    /customer-preferences/tables/:branchId   → getTablePreference
  POST   /customer-preferences/tables             → validate, saveTablePreference

Return all 8 complete files (4 per module) with full file paths.
```

### 📤 Expected Output
8 new files across 2 new backend modules

---

# ═══════════════════════════════════════════════
# GROUP 3: BACKEND — AI & SMART FEATURE MODULES
# ═══════════════════════════════════════════════

---

## PROMPT 5 — AI Recommendations + Staff Feedback Modules (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/reviews/reviews.service.ts
backend/src/modules/restaurants/restaurants.service.ts
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/utils/response.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Node.js/Express/TypeScript with Supabase + Redis.

Please create TWO new backend modules. Use the reviews and restaurants services as 
reference for code patterns, error handling, and supabaseAdmin usage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE A: recommendations
Purpose: AI-powered restaurant recommendations for the customer app home page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/recommendations/recommendations.service.ts

  Function getPersonalizedRecommendations(userId: string, lat: number, lon: number, radiusKm: number = 5):
    
    Step 1 — Get user's order history (last 20 orders):
      SELECT restaurant_id, cuisine_type, COUNT(*) as visit_count 
      FROM orders JOIN restaurants ON orders.restaurant_id = restaurants.id
      WHERE orders.customer_id = userId
      GROUP BY restaurant_id, cuisine_type
      ORDER BY visit_count DESC LIMIT 20
    
    Step 2 — Get user's dietary profile:
      SELECT preferences, allergies FROM user_dietary_profiles WHERE user_id = userId
    
    Step 3 — Get nearby active restaurants using Haversine distance:
      (Since PostGIS may not be enabled, use manual Haversine in JS)
      SELECT r.id, r.name, r.cuisine_type, rb.logo_url, rb.primary_color,
             b.lat, b.lon, b.id as branch_id, b.operating_hours,
             AVG(rv.overall_rating) as avg_rating,
             COUNT(o.id) as orders_last_7d
      FROM restaurants r 
      JOIN branches b ON r.id = b.restaurant_id
      LEFT JOIN restaurant_branding rb ON r.id = rb.restaurant_id
      LEFT JOIN reviews rv ON r.id = rv.restaurant_id
      LEFT JOIN orders o ON b.id = o.branch_id AND o.created_at > NOW() - INTERVAL '7 days'
      WHERE r.status = 'active' AND b.is_active = true
      GROUP BY r.id, b.id, rb.logo_url, rb.primary_color
    
    Step 4 — Calculate match score for each restaurant:
      const scoreRestaurant = (restaurant) => {
        const dist = haversineDistance(lat, lon, restaurant.lat, restaurant.lon);
        if (dist > radiusKm * 1000) return null; // outside radius
        
        const distanceScore = 1 - (dist / (radiusKm * 1000));
        const ratingScore = (restaurant.avg_rating ?? 3) / 5;
        const popularityScore = Math.min((restaurant.orders_last_7d ?? 0) / 100, 1);
        
        // Cuisine preference bonus
        const visitedRestaurants = orderHistory.map(o => o.restaurant_id);
        const orderCount = orderHistory.find(o => o.restaurant_id === restaurant.id)?.visit_count ?? 0;
        const returnBonus = Math.min(orderCount / 10, 0.2); // max 0.2 bonus for loyal customer
        
        // Dietary match bonus
        const hasDietaryMatch = userPreferences?.preferences?.length > 0; // simplified
        const dietaryBonus = hasDietaryMatch ? 0.1 : 0;
        
        const score = (0.4 * distanceScore) + (0.35 * ratingScore) + (0.25 * popularityScore) + returnBonus + dietaryBonus;
        
        // Generate match reason
        let match_reason = '';
        if (orderCount > 2) match_reason = 'You\'ve visited before';
        else if (distanceScore > 0.8) match_reason = 'Very close to you';
        else if (ratingScore > 0.8) match_reason = 'Highly rated';
        else match_reason = 'Popular in your area';
        
        return { ...restaurant, distance_meters: dist, score, match_reason };
      };
    
    Step 5 — Sort by score, return top 10 with time-aware adjustments:
      - Get current hour (IST: add 5.5 hours to UTC)
      - 6-11am: boost breakfast restaurants by 0.15
      - 12-15pm: boost fast casual by 0.1
      - 19-23pm: boost fine dining by 0.1
    
    Return: sorted array of restaurant objects with match_reason and distance_meters
  
  Function getPopularNearby(lat: number, lon: number, radiusKm: number, cuisine?: string):
    - No auth required (public/guest users)
    - Same query as above but without personalization
    - Sort by: (rating × 0.5) + (recent_orders × 0.5)
    - Filter by cuisine if provided
    - Return top 20

FILE: backend/src/modules/recommendations/recommendations.controller.ts
  getPersonalized: requires auth, extracts userId from req.user
  getPopular: no auth required, reads lat/lon/radius from query params

FILE: backend/src/modules/recommendations/recommendations.routes.ts
  GET /recommendations/personalized?lat=&lon=&radius=  → authenticate, getPersonalized
  GET /recommendations/popular?lat=&lon=&radius=&cuisine=  → getPopular (no auth)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE B: staff-feedback  
Purpose: Anonymous staff feedback management (submit + view with sentiment)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/staff-feedback/staff-feedback.schema.ts
  
  submitFeedbackSchema: z.object({
    feedback_text: z.string().min(10).max(2000),
    branch_id: z.string().uuid().optional(),
  })
  
  listFeedbackSchema: z.object({
    restaurant_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(50).default(20),
  })

FILE: backend/src/modules/staff-feedback/staff-feedback.service.ts
  Table: 'staff_feedback'
  
  IMPORTANT — Anonymity guarantee:
    - NEVER return user_id or any identifying information in the API response
    - role_label is auto-generated from user's role (e.g., 'A Waiter', 'A Chef')
    - The user_id is stored internally for one-time session linkage only
  
  submitFeedback(userId: string, restaurantId: string, branchId: string | undefined, role: string, feedbackText: string):
    - Generate role_label: 'A ' + capitalize(role) — e.g., 'A Waiter'
    - Run basic sentiment analysis (keyword-based, no external API):
      POSITIVE_WORDS = ['great', 'excellent', 'amazing', 'love', 'happy', 'good', 'wonderful', 'fantastic', 'best', 'perfect', 'awesome']
      NEGATIVE_WORDS = ['terrible', 'awful', 'bad', 'worst', 'hate', 'horrible', 'unfair', 'toxic', 'bullying', 'abusive', 'threatening']
      const words = feedbackText.toLowerCase().split(/\W+/)
      const posScore = words.filter(w => POSITIVE_WORDS.includes(w)).length
      const negScore = words.filter(w => NEGATIVE_WORDS.includes(w)).length
      const sentiment = posScore > negScore ? 'positive' : negScore > posScore ? 'negative' : 'neutral'
      const sentiment_score = Math.abs(posScore - negScore) / (words.length || 1)
    - INSERT into staff_feedback with sentiment_label, sentiment_score
    - Return: { message: 'Feedback submitted anonymously' } — never return the record
  
  getFeedbackForRestaurant(restaurantId: string, options: { branch_id?, sentiment?, page, limit }):
    - Accessible by: owner (sees all their branches) or super_admin
    - SELECT id, branch_id, role_label, feedback_text, sentiment_label, sentiment_score, is_flagged, created_at
    - NEVER select user_id
    - Filter by branch_id and sentiment if provided
    - Return paginated results with sentiment summary stats:
      { items, total, positive_pct, neutral_pct, negative_pct, high_negative_branches: [branchId] }
  
  getFeedbackForAdmin(options: { restaurant_id?, branch_id?, sentiment?, page, limit }):
    - Super admin only — can see across all restaurants
    - Same fields, never include user_id
  
  flagFeedback(feedbackId: string, restaurantId: string, isFlagged: boolean):
    - Owner or admin can flag for follow-up
    - Update is_flagged field

FILE: backend/src/modules/staff-feedback/staff-feedback.controller.ts

FILE: backend/src/modules/staff-feedback/staff-feedback.routes.ts
  POST /staff-feedback         → authenticate, validate, submitFeedback (all staff roles)
  GET  /staff-feedback         → authenticate, requireRole(owner, super_admin), getFeedbackForRestaurant
  GET  /staff-feedback/admin   → authenticate, requireRole(super_admin), getFeedbackForAdmin  
  PATCH /staff-feedback/:id/flag → authenticate, requireRole(owner, super_admin), flagFeedback

Return all 6 files (3 per module) with full file paths.
```

### 📤 Expected Output
6 new files across 2 new backend modules

---

## PROMPT 6 — Chatbot + Staffing Prediction Modules (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/support/support.service.ts
backend/src/modules/analytics/analytics.service.ts
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/config/env.ts
backend/src/utils/response.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Node.js/Express/TypeScript with Supabase + Redis.
Reference the support and analytics services for code patterns.

Create TWO new backend modules:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE A: chatbot  
Purpose: AI customer support chatbot (Phase 1: rule-based; Phase 2: OpenAI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/chatbot/chatbot.service.ts

  KEY TYPES:
  interface ChatMessage {
    role: 'user' | 'ai' | 'agent'
    content: string
    timestamp: string
  }
  
  interface ChatContext {
    userId: string
    restaurantId?: string
    recentOrders: Array<{ id: string; status: string; restaurant_name: string; total: number }>
    activeBooking: { id: string; branch_name: string; arrival_time: string; status: string } | null
    ticketId: string | null
  }
  
  Function initSession(userId: string, restaurantId?: string): Promise<ChatContext>
    - Fetch user's last 3 orders (join with restaurants for name)
    - Fetch user's active booking (status = pending|confirmed|arrived)
    - Check Redis for existing ticket: key='chat_ticket:{userId}', TTL=30min
    - Return context object
  
  Function analyzeIntent(message: string): 
    { intent: string; shouldEscalate: boolean; dataRef?: string }
    
    INTENT DETECTION RULES (in priority order):
    1. ESCALATION (shouldEscalate: true) if message contains ANY of:
       ['refund', 'complaint', 'wrong order', 'damaged', 'cold food', 'rude staff', 
        'overcharged', 'never arrived', 'inedible', 'food poisoning', 'billing error']
       → intent: 'escalation'
    
    2. ORDER_STATUS if message contains:
       ['order status', 'where is my order', 'when will', 'track order', 'delivery']
       → intent: 'order_status'
    
    3. BOOKING_STATUS if message contains:
       ['booking', 'reservation', 'table booked', 'my table']
       → intent: 'booking_status'
    
    4. MENU if message contains:
       ['menu', 'what do you serve', 'food items', 'what can i order', 'ingredients']
       → intent: 'menu_info'
    
    5. HOURS if message contains:
       ['timing', 'open', 'close', 'hours', 'when are you']
       → intent: 'hours_info'
    
    6. GREETING if message is very short (< 10 words) or contains ['hi', 'hello', 'hey']
       → intent: 'greeting'
    
    7. DEFAULT → intent: 'general', shouldEscalate: false
  
  Function generateResponse(intent: string, context: ChatContext, message: string): string
    Intent-based responses:
    - 'greeting': 'Hi! I am your DineLuxe assistant. How can I help you today? 
       You can ask about your order status, bookings, menu, or restaurant timings.'
    - 'order_status': 
       if context.recentOrders.length > 0:
         const order = recentOrders[0]
         return 'Your most recent order from {order.restaurant_name} is currently {order.status}. 
         Order total: ₹{order.total}. Order ID: #{order.id.slice(-8)}'
       else: 'I don't see any recent orders on your account.'
    - 'booking_status':
       if context.activeBooking:
         return 'Your booking at {branch_name} on {arrival_time} is {status}.'
       else: 'I don't see any active bookings on your account.'
    - 'menu_info': 'You can view the full menu on the restaurant page. 
       Would you like me to help you navigate there?'
    - 'hours_info': 'Restaurant timings vary by location. 
       You can find exact hours on each restaurant's profile page.'
    - 'general': 'I am here to help! Could you provide more details about your query? 
       For complex issues, I can connect you with a support agent.'
  
  Function sendMessage(userId: string, message: string, restaurantId?: string): 
    Promise<{ response: string; isEscalated: boolean; ticketId: string | null }>
    - Get or create context via initSession
    - Detect intent
    - If shouldEscalate: create support_ticket in DB, store ticketId in Redis session
      INSERT INTO support_tickets: { user_id, restaurant_id, subject: 'Customer support request', 
      conversation: [{ role:'user', content: message, timestamp }], status: 'open' }
    - Generate response
    - Store message in conversation history (Redis for session, DB for escalated tickets)
    - Return { response, isEscalated, ticketId }

FILE: backend/src/modules/chatbot/chatbot.controller.ts
  sendMessage: POST — req.body.message, req.body.restaurant_id (optional), req.user.id
  getHistory: GET — fetches conversation history for current user/ticket

FILE: backend/src/modules/chatbot/chatbot.routes.ts
  POST /chatbot/message    → authenticate, sendMessage
  GET  /chatbot/history    → authenticate, getHistory

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE B: staffing  
Purpose: Demand prediction + staffing recommendations for managers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: backend/src/modules/staffing/staffing.service.ts
  Redis cache key: 'staffing_prediction:{branchId}:{dateStr}'  TTL: 2 hours
  
  Function predictDemand(branchId: string, restaurantId: string, targetDate: string):
    Returns: Array<{ hour: number; predicted_orders: number; confidence: 'high' | 'medium' | 'low' }>
    
    - targetDate is YYYY-MM-DD
    - Get day of week from targetDate (0-6)
    - Query historical orders for same day of week, last 8 weeks:
      SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as order_count
      FROM orders WHERE branch_id = branchId
      AND EXTRACT(DOW FROM created_at) = targetDayOfWeek
      AND created_at > NOW() - INTERVAL '8 weeks'
      GROUP BY hour ORDER BY hour
    - For each hour 9-23: avg_orders_this_hour = (total orders this hour across 8 weeks / 8)
    - Confidence: 'high' if we have ≥ 6 weeks of data, 'medium' if 3-5, 'low' if < 3
    - Cache result, return predictions
  
  Function getStaffingRecommendation(branchId: string, restaurantId: string, targetDate: string):
    Returns: {
      date: string,
      peak_hours: number[],
      recommendations: { hour: number; waiters: number; chefs: number; cashiers: number }[],
      current_scheduled: { waiter: number; chef: number; cashier: number; host: number },
      warnings: string[]  // e.g., "Saturday dinner needs 4 waiters, only 2 scheduled"
    }
    
    - Get demand predictions
    - For each hour:
      waiters = Math.max(1, Math.ceil(predicted_orders / 15))  // 1 waiter per 15 orders
      chefs = Math.max(1, Math.ceil(predicted_orders / 20))    // 1 chef per 20 orders
      cashiers = Math.max(1, Math.ceil(predicted_orders / 40)) // 1 cashier per 40 orders
    - Get current scheduled staff from shifts table for that date
    - Compare and generate warnings if understaffed
  
  Function getWeeklyForecast(branchId: string, restaurantId: string, weekStart: string):
    - Loop through 7 days of the week
    - Call getStaffingRecommendation for each day
    - Return array of 7 day forecasts

FILE: backend/src/modules/staffing/staffing.controller.ts
  getDemandPrediction: returns hourly prediction for a date
  getRecommendation: returns staffing recommendation with warnings
  getWeeklyForecast: returns 7-day forecast

FILE: backend/src/modules/staffing/staffing.routes.ts
  All routes: authenticate, injectTenant, requireRole('manager', 'owner')
  
  GET /staffing/prediction?branch_id=&date=   → getDemandPrediction
  GET /staffing/recommendation?branch_id=&date= → getRecommendation
  GET /staffing/weekly?branch_id=&week_start= → getWeeklyForecast

Return all 6 files (3 per module) with full file paths.
```

### 📤 Expected Output
6 new files across 2 new backend modules

---

# ═══════════════════════════════════════════════
# GROUP 4: BACKEND — WIRE ALL NEW MODULES
# ═══════════════════════════════════════════════

---

## PROMPT 7 — Update app.ts to Register All New Modules

### 📂 Files to Provide to Claude

```
backend/src/app.ts        (the full existing file)
```

### 🎯 Task for Claude

```
You are updating Restaurant OS backend app.ts to register all new modules.
I am giving you the FULL current app.ts file.

Please add the following new route registrations. 
IMPORTANT: Keep ALL existing code exactly as-is. Only ADD the new imports and route 
registrations. Do not remove, rename, or rearrange anything.

=== ADD THESE IMPORTS at the end of the existing imports block ===

import recipeIngredientsRoutes from './modules/recipe-ingredients/recipe-ingredients.routes';
import shiftsRoutes from './modules/shifts/shifts.routes';
import dynamicPricingRoutes from './modules/dynamic-pricing/dynamic-pricing.routes';
import customerPreferencesRoutes from './modules/customer-preferences/customer-preferences.routes';
import staffFeedbackRoutes from './modules/staff-feedback/staff-feedback.routes';
import recommendationsRoutes from './modules/recommendations/recommendations.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import staffingRoutes from './modules/staffing/staffing.routes';

=== ADD THESE ROUTE REGISTRATIONS after the existing routes block ===

// New modules — Phase 2
app.use(`${API}/recipe-ingredients`, recipeIngredientsRoutes);
app.use(`${API}/shifts`, shiftsRoutes);
app.use(`${API}/dynamic-pricing`, dynamicPricingRoutes);
app.use(`${API}/customer-preferences`, customerPreferencesRoutes);
app.use(`${API}/staff-feedback`, staffFeedbackRoutes);
app.use(`${API}/recommendations`, recommendationsRoutes);
app.use(`${API}/chatbot`, chatbotRoutes);
app.use(`${API}/staffing`, staffingRoutes);

// Note for shifts: The staff module also needs to forward /staff/:staffId/shifts
// Add this inside the staff routes file after reviewing prompt 3.

=== IMPORTANT ===
Also check: Is the `waste-log` endpoint currently registered? 
The inventory module already handles waste logs at /inventory/waste-log 
(check inventory.routes.ts). If it's there, no new registration is needed.

Return the COMPLETE updated app.ts file with all additions clearly marked with 
// NEW — Phase 2 comments.
```

### 📤 Expected Output
Updated `backend/src/app.ts` with all new route imports and registrations

---

# ═══════════════════════════════════════════════
# GROUP 5: FRONTEND — FLOOR LAYOUT DESIGNER
# ═══════════════════════════════════════════════

---

## PROMPT 8 — Floor Layout Designer Component (Frontend)

### 📂 Files to Provide to Claude

```
components/floor/FloorMap.tsx           (full file)
components/floor/TableUnit.tsx          (full file)
components/floor/CustomerTableSelector.tsx (full file)
components/shared/StatusBadge.tsx
lib/api-client.ts
types/api.ts
lib/constants.ts
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS frontend — Next.js 14 with TypeScript, TailwindCSS, 
@dnd-kit, react-query, and framer-motion.

The project uses TailwindCSS with a custom design system:
  Primary navy: #1A3C5E
  Accent amber: #E8A020
  Status colors: Green=#1E7E34, Orange=#E67E22, Red=#C0392B, Yellow=#F1C40F, Gray=#7F8C8D

I am providing the existing FloorMap.tsx (read-only/drag-drop live view) and related 
components. These are for the LIVE operational view.

I need you to create a SEPARATE component: 
components/floor/FloorLayoutDesigner.tsx

This is the DESIGN MODE editor used by owners/managers to create the restaurant floor plan.
It is DIFFERENT from FloorMap.tsx — FloorMap shows live status, FloorLayoutDesigner 
lets you create/edit the layout.

=== COMPONENT SPECIFICATION ===

Props interface:
  interface FloorLayoutDesignerProps {
    branchId: string
    initialLayout?: FloorLayout | null  // existing layout to edit
    onSave?: (layout: FloorLayout) => void
    onPublish?: (layout: FloorLayout) => void
    readOnly?: boolean
  }

Internal State:
  - floors: Array<{ floor_number: number; name: string; tables: DesignTable[] }>
  - activeFloor: number (0 = ground, 1 = first, etc.)
  - selectedTable: DesignTable | null
  - isDirty: boolean (unsaved changes)
  - showConfigModal: boolean
  - pendingTableDrop: { x: number; y: number } | null (position of table being configured)
  - history: FloorState[] (for undo/redo, max 20 states)
  - historyIndex: number

Types:
  interface DesignTable {
    id: string           // temp UUID for new tables, real UUID for existing
    label: string        // T1, T2, VIP1, etc.
    x: number            // grid column (0-23)
    y: number            // grid row (0-17)
    capacity: 2 | 4 | 6 | 8 | 10 | 12
    shape: 'round' | 'square' | 'rectangle' | 'booth'
    zone: 'indoor' | 'outdoor' | 'vip' | 'family' | 'bar'
    photo_url?: string
    isNew?: boolean      // true if not yet saved to DB
  }

=== LAYOUT (3-column) ===

LEFT SIDEBAR (w-48, fixed) — Table Palette:
  - Section title: "Add Tables"
  - 4 draggable table shapes as visual cards:
    🔵 Round  (circle icon)  →  Default capacity: 4
    ⬜ Square (square icon) →  Default capacity: 4
    ▬  Rectangle (wide rect icon) → Default capacity: 6
    🛋️ Booth   (U-shape icon)     → Default capacity: 6
  - Each is a drag source using @dnd-kit/core useDraggable
  - Also: Zone selector (color swatches: indoor=gray, outdoor=green, vip=purple, family=blue, bar=amber)
  
  Below palette:
  - Floor tabs: "Ground", "1F", "2F", "3F" buttons
  - "+ Add Floor" button (max 4 floors)
  - "- Remove Floor" button (only if floor is empty)

MAIN CANVAS (flex-1, bg-gray-50):
  - Grid: 24 columns × 18 rows, each cell = 48×48px
  - Subtle grid lines: 1px solid rgba(26,60,94,0.08)
  - Canvas dimensions: 1152×864px minimum, scrollable
  - Drop target for table shapes using @dnd-kit/core useDroppable
  - DndContext wraps the whole component (NOT just canvas)
  
  On shape drop:
    1. Calculate which cell was dropped on (use DragEndEvent delta)
    2. Check for collision with existing tables
    3. If collision: show toast "Position occupied, try another spot"
    4. If free: open TableConfigModal with the position pre-filled
  
  Placed tables render as:
    - Round: circle div, capacity label centered
    - Square: square div
    - Rectangle: 2×1 grid span  
    - Booth: rectangle with rounded corner on one side
    - Color by zone: indoor=slate-100, outdoor=green-100, vip=purple-100, family=blue-100, bar=amber-100
    - Border: 2px solid matching zone color
    - Selected state: ring-2 ring-[#1A3C5E] shadow-lg scale-105 transition
    - Click to select, click again to deselect
  
  Empty state (no tables on canvas):
    - Dashed border rectangle in center
    - Text: "Drag a table shape here to start"

RIGHT PANEL (w-64) — Table Properties:
  - Shows when a table is selected
  - Shows "Select a table to edit" when nothing selected
  
  When table selected:
    - Label input: T1, T2, VIP-01 etc. (auto-generated, editable)
    - Capacity selector: radio buttons for 2/4/6/8/10/12
    - Zone selector: dropdown
    - Shape display (read-only after placed)
    - Photo upload button (placeholder — triggers file input)
    - "Delete Table" button (red, with confirmation)
    - Position display: "Position: col 5, row 3" (read-only)

TABLE CONFIG MODAL (slides up from bottom):
  - Opens after dropping a shape on canvas
  - Fields: Label (auto-generated like T{n+1}), Capacity (2/4/6/8), Zone
  - "Place Table" button → closes modal, adds to canvas
  - "Cancel" → removes the pending drop

BOTTOM TOOLBAR:
  - Left: "Undo" button (Ctrl+Z), "Redo" button — show grayed if at history boundary
  - Center: Total tables count, e.g. "12 tables across 2 floors"  
  - Right: "Save Draft" button (outlined), "Publish Layout" button (filled navy)
  - Save Draft → POST /floor-layout/branch/:branchId with status: 'draft'
  - Publish → POST /floor-layout/branch/:branchId/publish — shows confirmation dialog first

=== API CALLS ===

On component mount:
  GET /api/v1/floor-layout/branch/:branchId → loads existing active layout
  Transform DB layout to DesignTable array

Save Draft:
  POST /api/v1/floor-layout/branch/:branchId
  Body: { floors: [{ floor_number, tables: [{ label, x, y, capacity, shape, zone, photo_url }] }] }

Publish:
  POST /api/v1/floor-layout/branch/:branchId/publish
  On success: show success toast, call onPublish callback

=== UX RULES ===
- Prevent closing the browser if isDirty=true (window.onbeforeunload)
- Auto-generate labels: T1, T2, T3... or VIP1, VIP2... based on zone
- Prevent duplicate labels within the same floor
- Smooth CSS transitions on all interactions (0.15s ease)
- Mobile: show a "Desktop recommended" banner, still functional but warn user
- Keyboard shortcut: Delete key when table selected = delete table
- Keyboard shortcut: Escape = deselect table

=== DEPENDENCIES AVAILABLE ===
@dnd-kit/core, @dnd-kit/utilities, framer-motion, 
@tanstack/react-query, sonner (toast), lucide-react

Return the COMPLETE FloorLayoutDesigner.tsx file. 
It will be ~300-500 lines. Write production-quality TypeScript.
```

### 📤 Expected Output
- 🆕 `components/floor/FloorLayoutDesigner.tsx` — Complete new component

---

## PROMPT 9 — Owner Floor Layout Pages (Frontend)

### 📂 Files to Provide to Claude

```
components/floor/FloorLayoutDesigner.tsx    (the file you just created in Prompt 8)
app/owner/dashboard/page.tsx               (for layout/import pattern reference)
app/owner/layout.tsx
components/layout/PageWrapper.tsx
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS frontend — Next.js 14 with TypeScript, TailwindCSS.

I provide the FloorLayoutDesigner component and owner layout files for reference.

Please create TWO new pages:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 1: app/owner/floor/page.tsx
Purpose: Branch selector — owner picks which branch to design floor for
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

This page:
1. Fetches owner's branches: GET /api/v1/branches (filtered by restaurant from JWT)
2. Shows a page header: "Floor Layout Designer" with subtitle "Set up your restaurant floor plan"
3. Shows a card grid of branches — each card:
   - Branch name (large text)
   - Address (small text, gray)
   - Status badge: Active/Inactive
   - "Has Layout" badge (green checkmark) if branch has an active floor layout
     (fetch from GET /api/v1/floor-layout/branch/:branchId/status — returns { has_active_layout: boolean })
   - "Design Floor" button → navigates to /owner/floor/[branchId]
4. If no branches: EmptyState with "No branches yet. Add a branch first." and link to /owner/branches
5. Loading state: SkeletonCard grid

Use useQuery for branches, useAuth for restaurant context.
Import PageWrapper, SkeletonCard, EmptyState, StatusBadge from existing components.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE 2: app/owner/floor/[branchId]/page.tsx
Purpose: The actual floor layout designer for a specific branch
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Props: { params: { branchId: string } }

This page:
1. Fetches the branch details: GET /api/v1/branches/:branchId
2. Fetches existing layout: GET /api/v1/floor-layout/branch/:branchId
3. Shows breadcrumb: "Floor Layout > [Branch Name]"
4. Shows a header with:
   - Branch name as title
   - "Back to Branches" link (arrow left)
   - Layout status chip: "Draft" (amber) or "Published" (green) or "No Layout" (gray)
   - "View Live Map" button → opens the FloorMap component in a modal

5. Renders: <FloorLayoutDesigner branchId={branchId} initialLayout={existingLayout} />

6. On publish callback: invalidate floor layout query, show success toast:
   "Floor layout published! All staff will see the updated floor plan."

Handle loading/error states with proper skeletons.

=== IMPORTANT ===
Both pages must be proper Next.js App Router pages with "use client" directive.
Import FloorLayoutDesigner with dynamic import to avoid SSR issues:
  const FloorLayoutDesigner = dynamic(() => import('@/components/floor/FloorLayoutDesigner'), { ssr: false })

Also create: app/owner/floor/layout.tsx (minimal — just PageWrapper + title)

Return all 3 files with full paths.
```

### 📤 Expected Output
- 🆕 `app/owner/floor/page.tsx`
- 🆕 `app/owner/floor/[branchId]/page.tsx`
- 🆕 `app/owner/floor/layout.tsx`

---

# ═══════════════════════════════════════════════
# GROUP 6: FRONTEND — STUB PAGE FIXES
# ═══════════════════════════════════════════════

---

## PROMPT 10 — Fix Stub Pages: Onboarding Steps 2–5 (Frontend)

### 📂 Files to Provide to Claude

```
app/auth/onboarding/page.tsx           (the entry, renders RestaurantSignupWizard)
components/auth/RestaurantSignupWizard.tsx    (the full wizard component)
app/auth/onboarding/step-2/page.tsx    (current 184-byte stub)
app/auth/onboarding/step-3/page.tsx    (current 184-byte stub)
app/auth/onboarding/step-4/page.tsx    (current 184-byte stub)
app/auth/onboarding/step-5/page.tsx    (current 184-byte stub)
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are working on Restaurant OS — Next.js 14 frontend.
Restaurant owner onboarding is a 5-step wizard at /auth/onboarding

Step 1 is handled by the main page (app/auth/onboarding/page.tsx) which renders 
RestaurantSignupWizard.

Currently steps 2-5 are stub pages (just 184 bytes each, probably just redirects).

Please analyze:
1. The RestaurantSignupWizard component to understand what data is collected at each step
2. What the stub pages currently contain

Then for each step 2-5, create a proper page.tsx that:
  - Is NOT a full re-implementation (the wizard handles state)
  - Instead, redirects properly to the wizard with the correct initialStep prop
  - Each page should render: <RestaurantSignupWizard initialStep={N} />
    where N = 1 for step-2, 2 for step-3, 3 for step-4, 4 for step-5
  - Import from "@/components/auth/RestaurantSignupWizard"
  - Add metadata export (for Next.js SEO)
  - Step title names: 
    step-2: "Restaurant Details"
    step-3: "Branch Setup"
    step-4: "Branding"
    step-5: "Review & Submit"

Also: check if there should be URL-based step persistence — i.e., if a user 
navigates directly to /auth/onboarding/step-3, should the wizard show step 3?
If the wizard supports initialStep prop, implement it. Otherwise explain the limitation.

Return all 4 updated step pages (2,3,4,5) with full file paths.
```

### 📤 Expected Output
4 properly implemented step pages replacing stubs

---

## PROMPT 11 — Fix Stub Pages: Staff Dashboard + Manager Floor + Owner Menu (Frontend)

### 📂 Files to Provide to Claude

```
app/staff/manager/dashboard/page.tsx     (full existing manager dashboard)
app/staff/manager/floor/page.tsx         (STUB - RouteShell, 116 bytes)
app/staff/dashboard/page.tsx             (STUB, 136 bytes)
app/staff/host/floor/page.tsx            (full existing host floor - for reference)
components/floor/FloorMap.tsx            (full existing component)
app/owner/menu/page.tsx                  (STUB, 126 bytes)
components/owner/MenuManagement.tsx      (full existing component)
hooks/useAuth.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are working on Restaurant OS — Next.js 14 frontend.

I need you to fix 3 stub pages. Read all provided files carefully to understand 
the patterns used in this project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 1: app/staff/manager/floor/page.tsx  (currently RouteShell stub)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This page should show the MANAGER's live floor map view.
Look at how app/staff/host/floor/page.tsx does it (that's the host's floor view).

The manager's floor view should:
1. Have "use client" directive
2. Use useAuth to get branchId
3. Fetch tables: GET /api/v1/branches/:branchId/live-layout
4. Show a page header: "Live Floor Map" with real-time update indicator
5. Render FloorMap component with:
   - readOnly=true (manager can see but not drag tables in this view)
   - tables={mappedTables} 
   - onTableClick — opens a TableDetailsSheet (slide-up panel) showing:
     * Table label, capacity, zone
     * Current status with StatusBadge
     * Current occupants (if any): order summary
     * Action buttons: Override Status (dropdown), View Order, Reassign Waiter
6. Floor selector tabs at top if multiple floors
7. Legend: color key for all 5 statuses
8. Auto-refresh every 30 seconds as fallback
9. Real-time updates via useTableStatus hook (from hooks/useTableStatus.ts)

Use similar code structure as host/floor/page.tsx but adapted for manager context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 2: app/staff/dashboard/page.tsx  (currently tiny stub)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is the GENERIC staff landing page. When staff logs in, they arrive here.
It should redirect to the correct role-specific dashboard:

"use client"

Use useAuth hook → get user.role
Use useRouter → redirect based on role:
  - 'manager'  → /staff/manager/dashboard
  - 'host'     → /staff/host/queue
  - 'waiter'   → /staff/waiter/tables
  - 'chef'     → /staff/chef/kitchen
  - 'cashier'  → /staff/cashier/tables
  - default    → /auth/login

Show a brief loading spinner while the redirect happens:
  "Redirecting to your dashboard..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX 3: app/owner/menu/page.tsx  (currently 126-byte stub)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This page shows the full menu management UI.
Look at components/owner/MenuManagement.tsx — that's the component to render.

The page should:
1. "use client"
2. Use useAuth to get branchId (or restaurant context)
3. Show PageWrapper with title "Menu Management"
4. If user has multiple branches: show a branch selector dropdown at top
5. Render: <MenuManagement branchId={activeBranchId} />
6. Add a breadcrumb: "Menu > All Items"
7. Handle loading state if branchId is not yet available

Also look at whether MenuManagement accepts a branchId prop — if not, 
note this in a comment and render it without props.

Return all 3 fixed pages with their full file paths.
```

### 📤 Expected Output
3 properly implemented pages replacing stubs

---

## PROMPT 12 — Owner Settings Page (Frontend)

### 📂 Files to Provide to Claude

```
app/owner/dashboard/page.tsx            (for style reference)
app/owner/branding/page.tsx             (full branding page — for API pattern ref)
app/owner/layout.tsx
components/layout/PageWrapper.tsx
components/ui/input.tsx
components/ui/button.tsx
components/shared/ConfirmDialog.tsx
hooks/useAuth.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Next.js 14 frontend.
The owner settings page at /owner/settings currently shows just a RouteShell stub.

Create a FULL implementation of app/owner/settings/page.tsx

This page allows the restaurant owner to manage platform-level settings for their restaurant.

=== PAGE SECTIONS ===

SECTION 1 — Restaurant Profile (card)
  - Restaurant name (text input, editable)
  - Cuisine type (text input or dropdown)
  - GST/Registration number (text input)
  - Contact phone, contact email
  - "Save Profile" button (PATCH /api/v1/restaurants/:restaurantId)

SECTION 2 — Notification Preferences (card)
  Toggle switches for:
  ✅ Email notifications for new orders
  ✅ Push notifications for staff actions
  ✅ Daily sales summary email
  ✅ Low inventory alerts
  ✅ New customer review alerts
  Save button (PATCH /api/v1/users/:userId/notification-preferences)

SECTION 3 — Cancellation Policy (card)
  - "Allow cancellations within X hours of booking" (number input, default 2)
  - "Cancellation grace period for walk-ins (minutes)" (number input, default 10)
  - "Auto-cancel no-shows after X minutes" (number input, default 15)
  Save button (PATCH /api/v1/restaurants/:restaurantId/settings)

SECTION 4 — Security (card)
  - Change password section:
    Current password, New password, Confirm new password
    "Update Password" button
  - "Active Sessions" — show count of active JWT sessions with "Revoke All" button
  - Two-factor authentication: coming soon badge

SECTION 5 — Danger Zone (card, red border)
  - "Temporarily close restaurant for operations" toggle
    On toggle on: confirmation dialog "This will mark your restaurant as temporarily closed.
    Customers will not be able to make new bookings or orders."
  - Below toggle: shows "Restaurant is: OPEN" or "Restaurant is: TEMPORARILY CLOSED (red)"

=== DESIGN REQUIREMENTS ===
- Page title: "Settings"
- Each section is a white card with a section header
- Form states: loading spinner on each save button during API call
- Success: show green inline message "Saved!" next to button for 2 seconds
- Error: show red inline error message
- Use react-hook-form for form management in each section
- Use useAuth for owner context (restaurantId, userId)

Return the complete settings page file.
```

### 📤 Expected Output
- ✏️ `app/owner/settings/page.tsx` — Full implementation (replacing stub)

---

# ═══════════════════════════════════════════════
# GROUP 7: FRONTEND — NEW ADMIN PAGES
# ═══════════════════════════════════════════════

---

## PROMPT 13 — Admin Staff Reviews Page (Frontend)

### 📂 Files to Provide to Claude

```
app/admin/dashboard/page.tsx             (for layout pattern reference)
app/admin/restaurants/page.tsx           (for data grid pattern reference)
app/admin/layout.tsx
components/shared/StatusBadge.tsx
components/shared/SentimentBadge.tsx
components/shared/DataTable.tsx
components/shared/EmptyState.tsx
components/shared/KPICard.tsx
components/shared/AlertBanner.tsx
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Next.js 14 frontend.
Create a NEW page: app/admin/staff-reviews/page.tsx

Also create its companion component: components/admin/StaffFeedbackViewer.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT: components/admin/StaffFeedbackViewer.tsx
Props: { restaurantId?: string; isAdminView: boolean }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This shows anonymous staff feedback with sentiment analysis.

PRIVACY RULES (very important):
  ❌ NEVER show staff member's name, employee ID, or any identifying information
  ✅ Only show: role_label (e.g., "A Waiter"), branch name, feedback text, sentiment, date
  
LAYOUT:
  Top row — Summary stats (3 KPI cards):
    🟢 Positive: X%  |  🟡 Neutral: X%  |  🔴 Negative: X%
    (fetch from GET /api/v1/staff-feedback?restaurant_id=X)

  Warning banner (if negative > 30%):
    "⚠️ High negative sentiment detected across some branches. 
     Consider reviewing operations or conducting staff meetings."

  Filter row:
    - Branch selector dropdown (if admin view: also restaurant selector)
    - Sentiment filter: All | Positive | Neutral | Negative
    - Date range: Last 7 days | Last 30 days | All Time
  
  Feedback list (paginated, 20 per page):
    Each feedback card:
      - SentimentBadge (positive/neutral/negative)
      - Role label: "A Waiter says..." in small gray text
      - Branch name: small chip badge
      - Feedback text: main content
      - Date: relative ("3 days ago")
      - If is_flagged: 🚩 "Flagged for follow-up" badge (amber)
      - Admin action: Flag/Unflag button (subtle, icon only)
    
    Empty state: "No feedback submitted yet"
    
  API calls:
    - Admin view: GET /api/v1/staff-feedback/admin?{filters}
    - Owner view: GET /api/v1/staff-feedback?restaurant_id={restaurantId}&{filters}
    - Flag: PATCH /api/v1/staff-feedback/:id/flag

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE: app/admin/staff-reviews/page.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Shows:
1. Page header: "Staff Reviews" with subtitle "Anonymous workplace feedback"
2. Restaurant selector (admin sees all restaurants, dropdown)
3. <StaffFeedbackViewer restaurantId={selectedRestaurantId} isAdminView={true} />
4. On first load (no restaurant selected): placeholder with instruction
   "Select a restaurant to view feedback"

Use useAuth for admin context.
Import StaffFeedbackViewer from components/admin/StaffFeedbackViewer.

Return both files with full paths.
```

### 📤 Expected Output
- 🆕 `components/admin/StaffFeedbackViewer.tsx`
- 🆕 `app/admin/staff-reviews/page.tsx`

---

# ═══════════════════════════════════════════════
# GROUP 8: FRONTEND — AI FEATURE COMPONENTS
# ═══════════════════════════════════════════════

---

## PROMPT 14 — Chatbot Widget + Demand Prediction (Frontend)

### 📂 Files to Provide to Claude

```
components/ai/AIRecommendations.tsx         (existing AI component — for style ref)
app/customer/profile/support/page.tsx       (existing support page)
app/staff/manager/dashboard/page.tsx        (manager dashboard — for context)
components/shared/KPICard.tsx
lib/api-client.ts
lib/socket.ts
types/api.ts
hooks/useAuth.ts
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Next.js 14 frontend with TypeScript, TailwindCSS.

Please create TWO new AI feature components:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 1: components/ai/ChatbotWidget.tsx
Purpose: Floating AI customer support chatbot for the customer app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Props: { restaurantId?: string; className?: string }

STATE:
  - isOpen: boolean (floating window open/closed)
  - messages: Array<{ role: 'user' | 'ai' | 'agent'; content: string; timestamp: Date; isEscalated?: boolean }>
  - inputValue: string
  - isLoading: boolean (AI is typing)
  - isEscalated: boolean (routed to human agent)

DESIGN — FLOATING CHAT WIDGET:
  
  Closed state:
    - Floating button: bottom-right corner, 56×56px circle
    - Primary navy background (#1A3C5E) with white chat bubble icon
    - Unread badge if there are unread messages
    - Subtle pulse animation to attract attention on first load
  
  Open state (slides up with spring animation):
    - Card: 380×520px (mobile: 100% width, max-height 80vh)
    - Header: "DineLuxe Support" + restaurant name if provided + close button (X)
    - If escalated: show "🔴 Connected to Support Agent" indicator
    
    Messages area (flex-col, scrollable):
      - AI messages: left-aligned, gray bubble
      - User messages: right-aligned, navy bubble (#1A3C5E), white text
      - Agent messages: left-aligned, amber-tinted bubble
      - Typing indicator: 3 animated dots when isLoading=true
      - First message on open: AI greeting "Hi! I'm your assistant. 
        Ask me about your orders, bookings, or anything else!"
    
    Input area (pinned to bottom):
      - Text input (full width, rounded)
      - Send button (navy, arrow icon)
      - On Enter: sends message
      - Disable input while loading
      
      Quick reply chips (show on first message):
        "Order Status" | "My Booking" | "Menu Info"
        Clicking a chip sends that message automatically
  
  API call on send:
    POST /api/v1/chatbot/message
    Body: { message, restaurant_id? }
    On response: show AI response, if isEscalated=true show escalation notice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 2: components/ai/DemandPrediction.tsx
Purpose: Manager's staffing prediction widget on the manager dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Props: { branchId: string; className?: string }

PURPOSE: Shows today's and tomorrow's demand predictions with staffing warnings.

API calls:
  GET /api/v1/staffing/recommendation?branch_id=&date={today}
  GET /api/v1/staffing/recommendation?branch_id=&date={tomorrow}

DESIGN:
  Card with header: "📊 Smart Staffing Forecast" + "Today" / "Tomorrow" tabs
  
  For each day:
    1. Peak hours bar chart (simple CSS bars, no chart library needed):
       - X-axis: hours 10am-11pm
       - Bar height proportional to predicted_orders
       - Color: green for normal, orange for busy (>20 orders), red for peak (>35)
       - Hover tooltip showing predicted order count
    
    2. Recommended staffing table:
       Role      | Recommended | Currently Scheduled | Status
       Waiters   | 4           | 3                   | ⚠️ Under
       Chefs     | 2           | 2                   | ✅ OK
       Cashiers  | 1           | 1                   | ✅ OK
       
    3. Warning alerts (if any warnings from API):
       Each warning as an amber banner:
       "Saturday dinner (7-9pm) needs 4 waiters, only 2 scheduled"
       Action button: "Update Schedule" → navigates to /owner/shifts
    
    4. Confidence indicator:
       "Based on 6 weeks of historical data" or "Limited data — prediction may vary"
  
  Loading: skeleton for the whole card
  Error: "Could not load prediction — not enough historical data yet"

Return both complete component files with full paths.
```

### 📤 Expected Output
- 🆕 `components/ai/ChatbotWidget.tsx`
- 🆕 `components/ai/DemandPrediction.tsx`

---

## PROMPT 15 — Smart Pricing Widget + Social Dining Component (Frontend)

### 📂 Files to Provide to Claude

```
app/owner/menu/page.tsx                  (current menu page)
components/owner/MenuManagement.tsx      (full menu management component)
components/ai/AIRecommendations.tsx      (AI component style reference)
app/customer/booking/page.tsx            (customer booking page — for social dining context)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
components/ui/button.tsx
components/ui/input.tsx
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Next.js 14 frontend.
Create TWO new feature components:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 1: components/ai/SmartPricingWidget.tsx
Purpose: Shows AI-driven menu optimization suggestions to restaurant owners
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Props: { branchId: string; restaurantId: string }

PURPOSE: AI analysis of menu performance — suggests pricing changes, combos, and happy hours.

API Calls:
  GET /api/v1/reports/menu-performance?branch={branchId}&period=30d
  GET /api/v1/dynamic-pricing/branch/:branchId  (existing happy hour rules)

DESIGN (tall card widget, meant to be embedded in menu management page):

  Header: "🤖 Smart Suggestions" with a refresh button
  
  SECTION A — Slow Sellers:
    If any menu items have < 5 orders in 30 days:
    - Each shown as a suggestion card:
      📉 "[Item Name]" has only 3 orders this month
      Suggestion: "Consider adding a ₹20 discount or featuring it in promotions"
      [Apply 10% Discount] [Apply 20% Discount] [Skip] buttons
      Apply: creates a dynamic pricing rule for this item
  
  SECTION B — Bundle Opportunities:
    (Hardcoded examples for now — real co-occurrence analysis is complex backend work)
    🛒 "Create a combo deal"
    Show a form to create a custom combo: name, items, combo price
    [Create Combo] button (placeholder — navigates to menu management)
  
  SECTION C — Happy Hour Setup:
    If no active dynamic pricing rules:
    - Prompt: "Set up Happy Hour pricing to boost off-peak sales"
    - Quick form: Start time, End time, Days (checkboxes), Discount %
    - "Enable Happy Hour" → POST /api/v1/dynamic-pricing with the rule data
    
    If active rules exist:
    - List active rules with toggle buttons
    - "Manage Rules" link

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 2: components/customer/SocialDining.tsx
Purpose: Let customers create/join a group for pre-ordering at the same table
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Props: { bookingId: string; isOrganizer: boolean; inviteCode?: string }

PURPOSE: After making a booking, the customer can:
A) Create a dining group and share an invite link with friends
B) Join a friend's dining group via invite code  
C) Pre-order from the menu before arriving

STATE:
  - mode: 'create' | 'join' | 'group_view'
  - groupData: SocialDiningGroup | null
  - shareUrl: string

DESIGN:
  
  If no group exists (isOrganizer=true, no invite code):
    Card with title "Invite Friends to Your Table"
    Body: "Let friends join your booking and pre-order together. 
    Food will be ready when you arrive!"
    [Create Group] button → POST /api/v1/social-dining (creates group, returns invite_code)
  
  If group created (organizer view):
    - Large invite code display: "DINE-ABC123" in monospace
    - Share button: copies "Join my table: https://dineluxe.app/join/ABC123" to clipboard
    - Toast: "Link copied!"
    - Members list (live updates every 10s):
      [👤 You (Organizer)] [👤 Rahul has joined] [+ 2 more spots]
    - "Pre-order together" section:
      Each member can click [Add My Order] → opens menu sheet
      Shows each member's pre-order status: ✅ Ordered | ⏳ Pending
  
  If joining via invite code:
    Code input (auto-filled from URL if present)
    [Join Group] → POST /api/v1/social-dining/join
    On join: show group details and member list
  
  API shape:
    POST /api/v1/social-dining                     → creates group, returns { invite_code }
    POST /api/v1/social-dining/join/:invite_code   → joins group
    GET  /api/v1/social-dining/booking/:bookingId  → get group for this booking

Return both complete component files with full paths.
```

### 📤 Expected Output
- 🆕 `components/ai/SmartPricingWidget.tsx`
- 🆕 `components/customer/SocialDining.tsx`

---

# ═══════════════════════════════════════════════
# GROUP 9: FRONTEND — CUSTOMER DIETARY PROFILE
# ═══════════════════════════════════════════════

---

## PROMPT 16 — Customer Dietary Profile Component + Integration (Frontend)

### 📂 Files to Provide to Claude

```
app/customer/profile/edit/page.tsx          (full existing profile edit page)
app/customer/profile/page.tsx               (full customer profile page)
components/customer/FoodCard.tsx            (to understand how allergens are displayed)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
components/ui/button.tsx
components/ui/badge.tsx
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Next.js 14 frontend.

Create: components/customer/DietaryProfile.tsx

This is a reusable component that lets customers set their dietary preferences and allergies.
It should be embeddable in the profile edit page.

=== COMPONENT SPECIFICATION ===

Props: {
  initialPreferences?: string[]
  initialAllergies?: string[]  
  onSave?: (preferences: string[], allergies: string[]) => Promise<void>
  compact?: boolean  // smaller version for profile overview
}

=== FULL VERSION DESIGN ===

Section 1 — Dietary Preferences:
  Title: "My Dietary Preferences"
  Subtitle: "We'll filter restaurant menus to show compatible items"
  
  Multi-select pill buttons (toggleable):
    🌱 Vegan           🥗 Vegetarian      🕌 Halal
    🙏 Jain            🌾 Gluten-Free     🥑 Keto
    💪 High-Protein
  
  Selected pills: filled with primary navy color, white text, checkmark icon
  Unselected: outlined, navy text
  
Section 2 — Food Allergies:
  Title: "Allergen Warnings"
  Subtitle: "We'll warn you before ordering items containing these"
  
  Multi-select pill buttons (toggleable):
    🥜 Nuts           🥛 Dairy           🌾 Gluten
    🥚 Eggs           🫘 Soy             🦐 Shellfish
    🐟 Fish
  
  Warning note: "⚠️ Always verify allergen information with restaurant staff. 
  Our warnings are based on menu data provided by restaurants."
  
  Selected allergy pills: filled with red-100, red-700 text, warning icon

Save button: "Save Preferences"
  - On click: calls onSave(selectedPreferences, selectedAllergies)
  - Shows loading spinner while saving
  - Shows "✅ Saved!" for 2 seconds on success

API calls when onSave not provided (standalone usage):
  PATCH /api/v1/customer-preferences/dietary
  Body: { preferences: string[], allergies: string[] }

=== COMPACT VERSION (compact=true) ===
  Just shows active preferences as small badges (read-only)
  e.g., "🌱 Vegan  🥜 Nut-free  🌾 Gluten-Free"
  [Edit] button next to them

=== INTEGRATION INSTRUCTION ===
Also show me HOW to add this component to the existing 
app/customer/profile/edit/page.tsx — where to insert it 
(as a new section near the bottom of the profile form, 
above the Save button) and what import to add.

Return the complete DietaryProfile component and the integration diff.
```

### 📤 Expected Output
- 🆕 `components/customer/DietaryProfile.tsx`
- ✏️ Integration instructions for `app/customer/profile/edit/page.tsx`

---

# ═══════════════════════════════════════════════
# GROUP 10: FRONTEND — INTEGRATE AI INTO EXISTING PAGES
# ═══════════════════════════════════════════════

---

## PROMPT 17 — Add AI/Smart Features to Existing Pages (Frontend)

### 📂 Files to Provide to Claude

```
app/staff/manager/dashboard/page.tsx        (full manager dashboard)
app/owner/menu/page.tsx                     (the updated menu page from Prompt 11)
app/customer/profile/support/page.tsx       (full support page)
components/ai/DemandPrediction.tsx          (from Prompt 14)
components/ai/SmartPricingWidget.tsx        (from Prompt 15)
components/ai/ChatbotWidget.tsx             (from Prompt 14)
app/owner/layout.tsx
app/customer/layout.tsx
```

### 🎯 Task for Claude

```
You are integrating newly created AI components into existing pages in Restaurant OS.

Please make these MINIMAL targeted changes to existing files:

CHANGE 1 — app/staff/manager/dashboard/page.tsx
  Find the section that shows today's overview/alerts.
  Add the DemandPrediction widget BELOW the alert section:
  
  Import: import DemandPrediction from '@/components/ai/DemandPrediction';
  
  Add this block (find the right place, after the alerts/KPIs section):
  <div className="mt-6">
    <DemandPrediction branchId={branchId} className="w-full" />
  </div>
  
  Only add this if branchId is available from the auth context.
  Show the component only for managers, not other roles.

CHANGE 2 — app/owner/menu/page.tsx  
  Add SmartPricingWidget as a sidebar or collapsible section:
  
  If the menu page uses a single-column layout:
    Add a collapsible "Smart Suggestions" panel at the top:
    [AI Suggestions ✨] button that expands/collapses
    Shows <SmartPricingWidget branchId={...} restaurantId={...} />
  
  If it uses a multi-column layout:
    Add as a right sidebar panel.

CHANGE 3 — app/customer/layout.tsx (or the customer home page)
  Add ChatbotWidget as a floating element.
  The widget should appear on ALL customer pages.
  
  In app/customer/layout.tsx:
    Import ChatbotWidget
    Add at the bottom of the layout JSX (before closing div):
    <ChatbotWidget restaurantId={undefined} />
    (restaurantId is optional — undefined means platform support)
  
  Important: Only render on the client side (use dynamic import with ssr: false)

For each change, return:
1. The EXACT lines to add/modify (diff format)  
2. Where to insert them (before/after which existing code)
3. The full updated file content

Return all 3 modified files.
```

### 📤 Expected Output
3 modified existing files with AI components integrated

---

# ═══════════════════════════════════════════════
# GROUP 11: SHARED TYPES UPDATE
# ═══════════════════════════════════════════════

---

## PROMPT 18 — Update Shared Types & Frontend API Types (Frontend)

### 📂 Files to Provide to Claude

```
types/api.ts                             (full existing frontend types file)
shared/types/api.ts                      (shared package types)
shared/types/index.ts
shared/index.ts
```

### 🎯 Task for Claude

```
You are updating Restaurant OS TypeScript types to cover all new features.

Please APPEND (add to the end) of types/api.ts these NEW types.
Do NOT change existing types. Only add new interfaces.

=== TYPES TO ADD TO types/api.ts ===

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
  days_of_week: number[];           // 0=Sun, 1=Mon, ..., 6=Sat
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
export type DietaryPreference = 'vegan' | 'vegetarian' | 'halal' | 'jain' | 'gluten_free' | 'keto' | 'high_protein';
export type AllergenType = 'nuts' | 'dairy' | 'gluten' | 'eggs' | 'soy' | 'shellfish' | 'fish';

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

=== ALSO: Add MenuCategory type if it doesn't exist ===

If MenuCategory is missing from types/api.ts, add:
export interface MenuCategory {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

Return the COMPLETE updated types/api.ts with all additions clearly marked 
with a "// ─── [Section Name] ─────" comment header.
```

### 📤 Expected Output
- ✏️ Updated `types/api.ts` with all new type definitions

---

# ═══════════════════════════════════════════════
# GROUP 12: BACKEND SCRIPTS & MISSING FEATURES
# ═══════════════════════════════════════════════

---

## PROMPT 19 — Backend Supabase SQL Functions for Reports (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/reports/reports.service.ts   (full file — uses Supabase RPC)
backend/src/modules/analytics/analytics.service.ts
backend/prisma/schema.prisma
```

### 🎯 Task for Claude

```
You are building Restaurant OS — using Supabase (PostgreSQL) with RPC functions 
for complex analytics queries.

The reports service calls Supabase RPC functions that may not be created yet.
Looking at the reports.service.ts, it calls:
  - supabaseAdmin.rpc('get_sales_report', {...})
  - And potentially other RPCs

Please create the SQL function definitions that need to be run in Supabase SQL editor
to make the reports work.

=== SQL FUNCTIONS TO CREATE ===

1. Function: get_sales_report
   Parameters:
     p_restaurant_id UUID
     p_branch_id UUID (nullable)
     p_from TIMESTAMPTZ
     p_to TIMESTAMPTZ
     p_trunc TEXT ('hour', 'day', 'week', 'month')
   
   Returns: TABLE(
     period TIMESTAMPTZ,
     order_count BIGINT,
     revenue NUMERIC,
     avg_order_value NUMERIC,
     cancellation_count BIGINT
   )
   
   Logic:
     SELECT DATE_TRUNC(p_trunc, o.created_at) as period,
            COUNT(o.id) FILTER (WHERE o.status NOT IN ('cancelled')) as order_count,
            COALESCE(SUM(p.amount) FILTER (WHERE p.status='completed'), 0) as revenue,
            COALESCE(AVG(p.amount) FILTER (WHERE p.status='completed'), 0) as avg_order_value,
            COUNT(o.id) FILTER (WHERE o.status='cancelled') as cancellation_count
     FROM orders o
     LEFT JOIN payments p ON o.id = p.order_id
     WHERE o.restaurant_id = p_restaurant_id
       AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
       AND o.created_at BETWEEN p_from AND p_to
     GROUP BY period
     ORDER BY period ASC

2. Function: get_menu_performance
   Parameters: p_restaurant_id UUID, p_branch_id UUID (nullable), p_from DATE, p_to DATE
   
   Returns: TABLE(
     menu_item_id UUID,
     item_name TEXT,
     category_name TEXT,
     order_count BIGINT,
     revenue NUMERIC,
     avg_rating NUMERIC,
     is_slow_mover BOOLEAN
   )

3. Function: get_platform_stats (for Super Admin)
   No parameters
   
   Returns: JSON object with:
     active_restaurants INT
     total_customers INT
     orders_today INT
     revenue_today NUMERIC

4. Function: get_peak_hours
   Parameters: p_restaurant_id UUID (nullable), p_days INT (default 90)
   
   Returns: TABLE(day_of_week INT, hour INT, order_count BIGINT)
   Uses: EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)

=== FORMAT ===
Return each as a complete CREATE OR REPLACE FUNCTION statement.
Include DROP FUNCTION IF EXISTS before each CREATE.
Include a comment explaining each function.
Add necessary GRANTs for the supabase service_role.
Format as a complete .sql file that can be pasted into Supabase SQL editor.
```

### 📤 Expected Output
- 🆕 `supabase/functions.sql` — SQL file with all RPC function definitions

---

## PROMPT 20 — Missing Email Templates (Backend)

### 📂 Files to Provide to Claude

```
backend/src/email/send.ts
backend/src/email/templates/otp-verify.ts
backend/src/email/templates/welcome.ts
backend/src/email/templates/booking-confirmed.ts
backend/src/email/templates/order-receipt.ts
backend/src/email/templates/booking-reminder.ts
```

### 🎯 Task for Claude

```
You are building Restaurant OS — Node.js/Express with Resend for email sending.
I provide all 5 existing email templates as reference.

Please create 4 NEW email templates following the exact same code pattern 
(TypeScript, HTML string returns, same function signature style):

TEMPLATE 1: backend/src/email/templates/staff-welcome.ts
  Function: staffWelcomeEmail(staffName: string, restaurantName: string, role: string, tempPassword: string, loginUrl: string)
  Subject: `Welcome to ${restaurantName} — Your Staff Account is Ready`
  
  Content:
  - Restaurant logo placeholder / name header
  - "Welcome, [staffName]!"
  - "Your [role] account at [restaurantName] has been created."
  - Credentials section (styled box):
    Login: [their email/phone]
    Temporary Password: [tempPassword] (formatted clearly)
    ⚠️ You must change your password on first login
  - Login button linking to [loginUrl]
  - Security notice: "Do not share your password with anyone"
  - Note: DineLuxe branding footer

TEMPLATE 2: backend/src/email/templates/password-reset-success.ts
  Function: passwordResetSuccessEmail(userName: string, loginUrl: string)
  Subject: 'Your password has been changed'
  Content: Success confirmation, new login button, "If you didn't do this, contact support immediately"

TEMPLATE 3: backend/src/email/templates/refund-initiated.ts
  Function: refundInitiatedEmail(customerName: string, orderId: string, amount: number, restaurantName: string, estimatedDays: number)
  Subject: `Refund Initiated — ₹${amount} from ${restaurantName}`
  Content: Refund confirmation, order ID, amount, restaurant name, estimated processing time

TEMPLATE 4: backend/src/email/templates/weekly-report.ts
  Function: weeklyReportEmail(ownerName: string, restaurantName: string, reportData: { totalRevenue: number, totalOrders: number, topDish: string, avgRating: number, growthPct: number }, reportUrl: string)
  Subject: `${restaurantName} — Weekly Performance Report`
  Content: Summary table with the key metrics, trend arrows, "View Full Report" button

For each template, follow the exact same code structure as the existing templates:
  - TypeScript function
  - Returns: { subject: string, html: string }
  - Inline CSS styles (no Tailwind in email)
  - Brand colors: #1A3C5E (navy), #E8A020 (amber)
  - Professional responsive email design
  - Text fallback in all tags

Return all 4 new template files with full paths.
```

### 📤 Expected Output
4 new email template files

---

# ═══════════════════════════════════════════════
# GROUP 13: INTEGRATION VERIFICATION PROMPTS
# ═══════════════════════════════════════════════

---

## PROMPT 21 — Sidebar Navigation: Add New Routes (Frontend)

### 📂 Files to Provide to Claude

```
components/layout/Sidebar.tsx            (full existing sidebar)
components/layout/BottomNav.tsx          (full existing bottom nav for customers)
lib/role-routing.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are updating Restaurant OS navigation to include all new pages.

Analyze the existing Sidebar.tsx carefully to understand:
1. How nav items are defined (their structure/interface)
2. Which roles see which items
3. How active states work

Then make these specific additions:

=== FOR OWNER ROLE — Add to existing owner nav items ===
Find where owner navigation items are defined.
Add after the existing "Floor Layout" item (or if it doesn't exist, add it):

{ 
  label: 'Floor Layout', 
  href: '/owner/floor', 
  icon: LayoutGrid,      // from lucide-react
  roles: ['owner', 'manager'] 
}

If 'Floor Layout' already exists, check if the href is '/owner/floor' — if not, update it.

Also add:
{ 
  label: 'AI Settings', 
  href: '/owner/settings', 
  icon: Settings2,       // from lucide-react
  roles: ['owner'] 
}

Note: Settings icon may be different — use whatever icon is appropriate.

=== FOR ADMIN ROLE — Add to existing admin nav items ===
Add after "Restaurants" or "Customers":
{ 
  label: 'Staff Reviews', 
  href: '/admin/staff-reviews', 
  icon: MessageSquare,   // from lucide-react
  roles: ['super_admin'] 
}

=== FOR CUSTOMER ROLE — in BottomNav ===
The BottomNav is already set up for customers.
Check if there's a "Support" tab. If not, check if ChatbotWidget is already 
in the customer layout. The chatbot is floating so no nav item is needed.
If there IS a support link in BottomNav, verify it points to /customer/profile/support

=== IMPORTANT ===
Only make the minimal changes needed. Return the complete modified files 
for Sidebar.tsx and BottomNav.tsx with the additions clearly marked.
```

### 📤 Expected Output
- ✏️ Updated `components/layout/Sidebar.tsx`
- ✏️ Updated `components/layout/BottomNav.tsx` (if changes needed)

---

## PROMPT 22 — Backend: Wire Shift Routes Into Staff Module (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/staff/staff.routes.ts
backend/src/modules/shifts/shifts.routes.ts    (from Prompt 3)
backend/src/modules/shifts/shifts.service.ts   (from Prompt 3)
backend/src/modules/shifts/shifts.controller.ts (from Prompt 3)
backend/src/app.ts                             (updated from Prompt 7)
```

### 🎯 Task for Claude

```
You are integrating the new shifts module into the existing staff routes.

The frontend's shifts page (app/owner/shifts/page.tsx) calls these API endpoints:
  POST /api/v1/staff/:staffId/shifts   → create a shift for a specific staff member
  GET  /api/v1/staff/shifts            → get weekly shifts for a branch

These routes need to be added to the EXISTING staff routes file 
(NOT the shifts routes file, since the URL starts with /staff/).

Task:
1. Open staff.routes.ts
2. Import the necessary shift controllers/services
3. Add these two routes at the END of staff.routes.ts:
   
   // Shift management (sub-resource of staff)
   router.get('/shifts', authenticate, injectTenant, 
     requireRole('manager', 'owner'), getWeeklyShifts);
   
   router.post('/:staffId/shifts', authenticate, injectTenant,
     requireRole('manager', 'owner'), validate(createShiftForStaffSchema), 
     createShiftForStaff);

4. Import the required controllers from the shifts module:
   import { getWeeklyShifts, createShiftForStaff } from '../shifts/shifts.controller';
   import { createShiftForStaffSchema } from '../shifts/shifts.schema';
   (Adjust import if the schema export name differs)

IMPORTANT: Keep ALL existing staff routes exactly as-is.
Only append the shift routes at the bottom.

Return the COMPLETE updated staff.routes.ts file.
```

### 📤 Expected Output
- ✏️ Updated `backend/src/modules/staff/staff.routes.ts`

---

# ═══════════════════════════════════════════════
# QUICK REFERENCE: COMPLETE API ENDPOINT MAP
# ═══════════════════════════════════════════════

Below is the complete list of ALL API endpoints in Restaurant OS (existing + new):

## Existing Endpoints (Already Implemented)
| Method | Endpoint | Module |
|--------|----------|--------|
| POST | /api/v1/auth/signup | auth |
| POST | /api/v1/auth/login | auth |
| POST | /api/v1/auth/refresh | auth |
| POST | /api/v1/auth/logout | auth |
| POST | /api/v1/auth/forgot-password | auth |
| POST | /api/v1/auth/verify-otp | auth |
| POST | /api/v1/auth/reset-password | auth |
| GET | /api/v1/auth/check-email | auth |
| GET/PATCH | /api/v1/users/:id | users |
| GET/POST | /api/v1/restaurants | restaurants |
| GET/PATCH | /api/v1/branches/:id | branches |
| GET/PATCH | /api/v1/restaurant/:id/branding | branding |
| GET/POST/PATCH | /api/v1/tables | tables |
| GET/POST | /api/v1/floor-layout | floor-layout |
| GET/POST | /api/v1/menu | menu |
| GET/POST/PATCH | /api/v1/orders | orders |
| GET/PATCH | /api/v1/order-items/:id | order-items |
| GET/POST/PATCH | /api/v1/kitchen | kitchen |
| POST/GET | /api/v1/payments | payments |
| GET/POST | /api/v1/bookings | bookings |
| GET/POST/PATCH | /api/v1/queue | queue |
| GET/POST | /api/v1/delivery | delivery |
| GET/POST | /api/v1/reviews | reviews |
| GET/PATCH | /api/v1/inventory | inventory |
| GET/POST | /api/v1/staff | staff |
| GET | /api/v1/admin/dashboard | admin |
| GET | /api/v1/analytics | analytics |
| GET | /api/v1/reports | reports |
| GET | /api/v1/geo | geo |
| GET | /api/v1/loyalty | loyalty |
| GET/POST | /api/v1/support | support |
| GET | /api/v1/notifications | notifications |

## New Endpoints (Being Added via These Prompts)
| Method | Endpoint | Module | Prompt # |
|--------|----------|--------|----------|
| GET/POST/DELETE | /api/v1/recipe-ingredients | recipe-ingredients | P2 |
| GET/POST/PATCH/DELETE | /api/v1/shifts | shifts | P3 |
| POST | /api/v1/staff/:staffId/shifts | shifts (via staff) | P22 |
| GET | /api/v1/staff/shifts | shifts (via staff) | P22 |
| GET/POST/PATCH/DELETE | /api/v1/dynamic-pricing | dynamic-pricing | P4 |
| GET/POST/PATCH | /api/v1/customer-preferences | customer-preferences | P4 |
| GET/POST/PATCH | /api/v1/staff-feedback | staff-feedback | P5 |
| GET | /api/v1/recommendations | recommendations | P5 |
| POST/GET | /api/v1/chatbot | chatbot | P6 |
| GET | /api/v1/staffing | staffing | P6 |

---

# ═══════════════════════════════════════════════
# BONUS: PERFORMANCE & PRODUCTION CHECKLIST
# ═══════════════════════════════════════════════

## PROMPT 23 — Redis Caching Strategy Audit (Backend)

### 📂 Files to Provide to Claude

```
backend/src/config/redis.ts
backend/src/modules/branding/branding.service.ts
backend/src/modules/menu/menu.service.ts
backend/src/modules/orders/orders.service.ts
backend/src/modules/queue/queue.service.ts
```

### 🎯 Task for Claude

```
You are auditing the Redis caching strategy in Restaurant OS.

Analyze the provided service files and identify:
1. What is currently being cached (what keys, what TTLs)
2. Where Redis caching would help but is NOT yet implemented
3. Any cache invalidation gaps (cases where data changes but cache isn't cleared)

Then provide:
A) An audit report table: Cache Key | TTL | Invalidated When | Status (✅ Correct / ⚠️ Needs Fix)

B) Implementation patches for the top 3 most impactful caching improvements not yet done.
   For each, show the exact code to add (GET from cache, SET on miss, invalidate on update).

C) A Redis key naming convention document:
   Format: '{entity}:{identifier}:{variant?}'
   Examples:
     branding:{restaurantId} — restaurant branding config
     menu:{branchId} — full branch menu
     session:{userId} — active session
     otp:{email} — OTP verification code
     ratelimit:{ip}:{endpoint} — rate limiting counter
     dynamic_pricing:{branchId} — pricing rules
     staffing_prediction:{branchId}:{dateStr} — demand prediction

Return the audit report + code patches.
```

### 📤 Expected Output
Redis caching audit and improvements

---

## PROMPT 24 — WebSocket Event Coverage Verification (Backend + Frontend)

### 📂 Files to Provide to Claude

```
backend/src/server.ts
hooks/useRealtime.ts
hooks/useOrderStatus.ts
hooks/useTableStatus.ts
lib/socket.ts
components/layout/RealtimeToastHandler.tsx
```

### 🎯 Task for Claude

```
You are verifying WebSocket event coverage in Restaurant OS.

The product document specifies these WebSocket events must work:
  
  ORDER EVENTS:
  - order_created → kitchen room + cashier room
  - order_cancelled → kitchen room + customer order room
  - kitchen_status_updated → waiters room + customer order room
  - food_ready → waiters room (specific waiter)
  
  TABLE EVENTS:
  - table_status_changed → all branch staff
  
  QUEUE EVENTS:
  - queue_updated → host room + individual customer booking rooms
  - arrival_detected → host room
  - queue_position_update → individual customer room
  
  PAYMENT EVENTS:
  - payment_confirmed → all branch rooms
  
  ALERT EVENTS:
  - inventory_low → manager room
  - overdue_order → kitchen + manager rooms
  - customer_call_waiter → specific waiter socket
  
  DELIVERY EVENTS:
  - location_update → delivery tracking room
  - delivery_complete → customer order room
  
  SYSTEM EVENTS:
  - branding_updated → all branch rooms
  - menu_updated → customer app rooms
  - floor_layout_updated → all branch staff

Analyze:
1. Which of these events are correctly emitted in the backend? (check server.ts and service files)
2. Which are correctly handled in the frontend? (check the hook files)
3. List any gaps (events specified but not implemented)

For each gap, provide:
  - The backend emit code to add (where to add it in which service)
  - The frontend handler to add in the appropriate hook
  - Which React component should react to this event

Return a coverage table + implementation patches for the top 5 missing events.
```

### 📤 Expected Output
WebSocket coverage audit + implementation patches

---

*End of Restaurant OS Complete Prompt Library*

---

## 📊 IMPLEMENTATION SEQUENCE (Recommended Order)

```
Phase 1 — Database First
  → Prompt 1: Schema additions (shifts, dynamic pricing, social dining)
  → Prompt 19: Supabase SQL functions

Phase 2 — Backend New Modules
  → Prompt 2: Recipe Ingredients module
  → Prompt 3: Shifts module
  → Prompt 4: Dynamic Pricing + Customer Preferences
  → Prompt 5: Recommendations + Staff Feedback
  → Prompt 6: Chatbot + Staffing Prediction
  → Prompt 7: Wire all modules in app.ts
  → Prompt 22: Wire shift routes in staff module
  → Prompt 20: Email templates

Phase 3 — Frontend Core Gaps
  → Prompt 8: Floor Layout Designer component
  → Prompt 9: Owner Floor Layout pages
  → Prompt 10: Fix onboarding stub pages
  → Prompt 11: Fix staff dashboard + manager floor + owner menu
  → Prompt 12: Owner Settings page
  → Prompt 13: Admin Staff Reviews page

Phase 4 — Frontend AI Features
  → Prompt 14: Chatbot Widget + Demand Prediction components
  → Prompt 15: Smart Pricing Widget + Social Dining
  → Prompt 16: Customer Dietary Profile
  → Prompt 17: Integrate AI into existing pages

Phase 5 — Types & Navigation
  → Prompt 18: Update shared TypeScript types
  → Prompt 21: Update sidebar navigation

Phase 6 — Audit & Polish
  → Prompt 23: Redis caching audit
  → Prompt 24: WebSocket coverage verification
```

**Total: 24 Detailed Prompts | ~50+ New Files | ~20 Modified Files**

---

*Restaurant OS Implementation Guide | Priyanshu Kumar Gupta & Ronit Gupta | 2025*
