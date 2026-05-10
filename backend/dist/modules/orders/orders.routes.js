"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const orders_schema_1 = require("./orders.schema");
const orders_controller_1 = require("./orders.controller");
const router = (0, express_1.Router)();
// All order routes require authentication + tenant injection
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// POST /orders — waiter or customer via QR
router.post('/', (0, rbac_middleware_1.requireRole)('waiter', 'customer', 'manager', 'owner', 'cashier'), 
// BUG FIX: validate({ body: schema }) passes a plain object — middleware calls
// schema.safeParse() which doesn't exist on a plain object. Pass schema directly.
(0, validate_middleware_1.validate)(orders_schema_1.createOrderSchema), orders_controller_1.handleCreateOrder);
// GET /orders/table/:tableId — FIX: must be BEFORE /:id (else 'table' parsed as order id)
router.get('/table/:tableId', (0, rbac_middleware_1.requireRole)('waiter', 'cashier', 'manager', 'owner'), orders_controller_1.handleGetOrdersByTable);
// GET /orders/branch/:branchId/active — FIX: must be BEFORE /:id
router.get('/branch/:branchId/active', (0, rbac_middleware_1.requireRole)('manager', 'owner', 'cashier'), orders_controller_1.handleGetActiveBranchOrders);
// GET /orders/:id — any authenticated user
router.get('/:id', orders_controller_1.handleGetOrder);
// PATCH /orders/:id/cancel — manager/owner only
router.patch('/:id/cancel', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)(orders_schema_1.cancelOrderSchema), orders_controller_1.handleCancelOrder);
exports.default = router;
//# sourceMappingURL=orders.routes.js.map