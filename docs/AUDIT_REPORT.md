# API CONTRACT MISMATCH AUDIT REPORT
**Date:** 2026-06-02  
**Scope:** StaffManagement component, manager dashboard pages, supporting routes

---

## MISMATCH AUDIT REPORT

### StaffManagement (`components/owner/StaffManagement.tsx`)

**MISMATCH 1** — `StaffMember` interface declares `first_name` / `last_name`, but  
`GET /staff/branch/:branchId` (staff.service.ts `getByBranch`) selects the combined  
`name` column only. The component's `rows` mapping and `ConfirmDialog` copy would  
silently render `undefined undefined` for every name.  
→ **FIXED:** `StaffMember.name: string` (combined). `splitName()` helper derives  
`first_name`/`last_name` for display and edit defaults. Backend `PATCH /staff/:id`  
still accepts `first_name`/`last_name` separately (service `update()` recombines them).

**MISMATCH 2** — `POST /staff/create` body is missing `dob` and `gender`.  
`createStaffSchema` (staff.schema.ts) marks both as **required**:  
- `dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — used to generate the temp password  
- `gender: z.enum(['male','female','other','prefer_not_to_say'])`  
The old create form only collected `first_name`, `last_name`, `email`, `phone`, `role`.  
Every `POST /staff/create` would return a **422 Unprocessable Entity**.  
→ **FIXED:** `dob` (date picker) and `gender` (select) added to both the Zod schema  
and the create form; both sent in the mutation body.

**MISMATCH 3** — `STAFF_ROLES` and `API_ROLES` included `"delivery"`, but  
`createStaffSchema` / `updateStaffSchema` enums are  
`['manager', 'host', 'waiter', 'chef', 'cashier']` — no `delivery`.  
Submitting `role: "delivery"` would fail backend Zod validation with a 422.  
→ **FIXED:** `delivery` removed from `STAFF_ROLES` and `API_ROLES`.  
The `toRoleBadgeRole()` bridge is retained (staff fetched from elsewhere may carry  
the `delivery` role and still need the badge).

---

### `app/staff/manager/staff-duty/page.tsx`

**MISMATCH 4** — `GET /staff/branch/:branchId?on_duty=true`  
The backend `getByBranch` service ignores all query params; `on_duty` is not a  
column in the `users` table and not a filter in the service. The param is silently  
ignored and **all branch staff** are returned regardless.  
→ **FIXED:** Query param removed. All staff fetched; filtered client-side to  
`is_active === true` as the nearest available signal.

**MISMATCH 5** — `PATCH /staff/:staffId/duty  { on_duty: false }`  
`/staff/:id/duty` does **not exist** in `staff.routes.ts`. Would return **404**.  
The correct toggle endpoint is `PATCH /staff/:id/toggle-access` (no body required;  
the service flips `is_active` server-side).  
→ **FIXED:** Replaced with `apiClient.patch(\`/staff/${staffId}/toggle-access\`, {})`.  
Button label updated from "Off Duty" → "Deactivate" to reflect the actual action.  
`duty_start` display removed (field does not exist in DB or response).

---

### `app/staff/manager/queue/page.tsx`

**MISMATCH 6** — `DELETE /queue/branch/:branchId/clear`  
No such route in `queue.routes.ts`. Would return **404**.  
The only delete-like route is `DELETE /queue/:id` (soft-deletes one entry).  
→ **FIXED (noted as missing):** "Clear Queue" button and `clearQueue` mutation  
removed from the component. A bulk-clear endpoint must be added to the backend  
if this feature is required.  
**Backend gap:** `DELETE /queue/branch/:branchId/clear` — endpoint does not exist.

**MISMATCH 7** — `GET /branch/:branchId/tables?status=free` (in `AssignTableModal`)  
The path `/branch/:id/tables` does not exist in `branches.routes.ts` or  
`tables.routes.ts`. The `api-client.ts` normalizer does rewrite it, but relying on  
the normalizer for a path that is wrong at source is fragile.  
Correct path: `GET /tables/branch/:branchId`  
→ **FIXED:** Changed to `apiClient.get(\`/tables/branch/${branchId}?status=free\`)`.

---

### `app/staff/manager/orders/page.tsx`

**MISMATCH 8** — `GET /orders/branch/:branchId?status=active`  
The active-orders endpoint is **a path segment, not a query param**:  
`GET /orders/branch/:branchId/active` (orders.routes.ts line 62).  
`?status=active` on the base path hits no matching route → **404**.  
→ **FIXED:** Changed to `apiClient.get(\`/orders/branch/${branchId}/active\`)`.

**MISMATCH 9** — `PATCH /orders/:id/status  { status }`  
No such route in `orders.routes.ts`. The defined mutation routes are:  
- `PATCH /orders/:id/cancel` — cancellation only  
- `POST /orders/:id/call-waiter`  
- `POST /orders/:id/apply-coupon`  
Kitchen-stage transitions (`pending → preparing → ready → served`) belong to  
`PATCH /kitchen/orders/:id/status` (kitchen.routes.ts).  
→ **FIXED:** Mutation now branches:  
  - `status === "cancelled"` → `PATCH /orders/:id/cancel`  
  - all other statuses → `PATCH /orders/:id/kitchen-status`  
    (api-client normalizer maps this to `/kitchen/orders/:id/status`)

---

### `app/staff/manager/menu-status/page.tsx`

**MISMATCH 10** — `GET /menu/items?branch_id=:branchId`  
`GET /menu/items` (with a query param) is **not defined** in `menu.routes.ts`.  
The only `GET /menu/items` route is `GET /menu/items/:id` (single item by ID).  
Correct branch-menu endpoints:  
- `GET /menu/branch/:branchId` — full menu  
- `GET /menu/branch/:branchId/items` — items alias  
→ **FIXED:** Changed to `apiClient.get(\`/menu/branch/${branchId}/items\`)`.

**MISMATCH 11** — `PATCH /menu/items/:id  { is_available }`  
While `PATCH /menu/items/:id` (general update) *does* exist, the purpose-built  
availability-toggle endpoint is `PATCH /menu/items/:id/status`. Using the  
general update route bypasses the `updateItemStatusSchema` validation and any  
status-specific business logic.  
→ **FIXED:** Changed to `apiClient.patch(\`/menu/items/${itemId}/status\`, { is_available })`.

---

### `app/staff/manager/page.tsx` (manager dashboard overview)

All four API calls are **correct** — no changes needed:

| Call | Backend route | Status |
|------|--------------|--------|
| `GET /branches/:id/live-stats` | `branches.routes.ts` | ✅ |
| `GET /tables/branch/:branchId` | `tables.routes.ts` | ✅ (via normalizer) |
| `GET /orders/branch/:branchId/active` | `orders.routes.ts` | ✅ |
| `GET /queue/branch/:branchId` | `queue.routes.ts` | ✅ |

---

### `app/owner/staff/page.tsx`

Thin wrapper that delegates to `<StaffManagement />`. No direct API calls.  
The comment block accurately documents the old mismatches. No changes needed.

---

## SUMMARY TABLE

| # | File | Wrong call | Correct call | Status |
|---|------|-----------|-------------|--------|
| 1 | StaffManagement.tsx | `StaffMember.first_name/last_name` (field mismatch) | `StaffMember.name` + `splitName()` | **FIXED** |
| 2 | StaffManagement.tsx | `POST /staff/create` missing `dob`, `gender` | Add both required fields to form & body | **FIXED** |
| 3 | StaffManagement.tsx | `STAFF_ROLES` includes `"delivery"` | Remove `delivery` (not in backend enum) | **FIXED** |
| 4 | staff-duty/page.tsx | `GET /staff/branch/:id?on_duty=true` | Remove param; filter `is_active` client-side | **FIXED** |
| 5 | staff-duty/page.tsx | `PATCH /staff/:id/duty` (404) | `PATCH /staff/:id/toggle-access` | **FIXED** |
| 6 | queue/page.tsx | `DELETE /queue/branch/:id/clear` (404) | No backend endpoint — feature removed | **NOTED (missing backend)** |
| 7 | queue/page.tsx | `GET /branch/:id/tables?status=free` | `GET /tables/branch/:id?status=free` | **FIXED** |
| 8 | orders/page.tsx | `GET /orders/branch/:id?status=active` (404) | `GET /orders/branch/:id/active` | **FIXED** |
| 9 | orders/page.tsx | `PATCH /orders/:id/status` (404) | `PATCH /orders/:id/cancel` or `/orders/:id/kitchen-status` | **FIXED** |
| 10 | menu-status/page.tsx | `GET /menu/items?branch_id=:id` (404) | `GET /menu/branch/:id/items` | **FIXED** |
| 11 | menu-status/page.tsx | `PATCH /menu/items/:id` for availability | `PATCH /menu/items/:id/status` | **FIXED** |

---

## NOTED MISSING BACKEND ENDPOINTS

The following backend routes are called by the frontend but **do not exist** in
the current backend route files. They need to be implemented before the
corresponding features can work:

1. **`DELETE /queue/branch/:branchId/clear`** — bulk-clear all queue entries for a branch.  
   Needed by: `app/staff/manager/queue/page.tsx` (Clear Queue button, now removed).  
   Add to: `backend/src/modules/queue/queue.routes.ts` + `queue.controller.ts`.

---

## FIXED FILES (output mapping)

| Fixed file | Original path |
|-----------|--------------|
| `StaffManagement.tsx` | `components/owner/StaffManagement.tsx` |
| `staff-duty-page.tsx` | `app/staff/manager/staff-duty/page.tsx` |
| `manager-queue-page.tsx` | `app/staff/manager/queue/page.tsx` |
| `manager-orders-page.tsx` | `app/staff/manager/orders/page.tsx` |
| `manager-menu-status-page.tsx` | `app/staff/manager/menu-status/page.tsx` |
