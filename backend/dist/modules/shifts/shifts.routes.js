"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffShiftsRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const shifts_schema_1 = require("./shifts.schema");
const shifts_controller_1 = require("./shifts.controller");
// ============================================================
// PRIMARY ROUTER — mounted at /api/v1/shifts in app.ts
// ============================================================
// app.use(`${API}/shifts`, shiftsRoutes);   ← already in app.ts
// ============================================================
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// GET  /shifts?branch_id=&week_start=&staff_id=
router.get('/', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(shifts_schema_1.getShiftsQuerySchema, 'query'), shifts_controller_1.getWeeklyShifts);
// POST /shifts
router.post('/', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(shifts_schema_1.createShiftSchema), shifts_controller_1.createShift);
// PATCH /shifts/:id
router.patch('/:id', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(shifts_schema_1.updateShiftSchema), shifts_controller_1.updateShift);
// DELETE /shifts/:id
router.delete('/:id', (0, rbac_middleware_1.requireRole)('manager', 'owner'), shifts_controller_1.deleteShift);
exports.default = router;
// ============================================================
// STAFF SUB-RESOURCE ROUTER
// These two routes match the frontend call pattern:
//   POST /staff/:staffId/shifts
//   GET  /staff/shifts
//
// HOW TO MOUNT (in backend/src/modules/staff/staff.routes.ts):
//
//   import { staffShiftsRouter } from '../shifts/shifts.routes';
//   router.use('/', staffShiftsRouter);     // after existing staff routes
//
// OR in app.ts directly (both work):
//
//   import { staffShiftsRouter } from './modules/shifts/shifts.routes';
//   app.use(`${API}/staff`, staffShiftsRouter);
// ============================================================
exports.staffShiftsRouter = (0, express_1.Router)();
exports.staffShiftsRouter.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// GET  /staff/shifts?branch_id=&week_start=&staff_id=
// NOTE: This route MUST be declared before /:staffId routes in staff.routes.ts
//       to prevent Express matching "shifts" as a :staffId param.
exports.staffShiftsRouter.get('/shifts', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(shifts_schema_1.getShiftsQuerySchema, 'query'), shifts_controller_1.getWeeklyShifts);
// POST /staff/:staffId/shifts
exports.staffShiftsRouter.post('/:staffId/shifts', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(shifts_schema_1.createShiftForStaffSchema), shifts_controller_1.createShiftForStaff);
//# sourceMappingURL=shifts.routes.js.map