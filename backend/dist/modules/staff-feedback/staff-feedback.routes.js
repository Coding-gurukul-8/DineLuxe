"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const staff_feedback_schema_1 = require("./staff-feedback.schema");
const staff_feedback_controller_1 = require("./staff-feedback.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// POST /staff-feedback
// Any authenticated staff role can submit feedback
router.post('/', (0, rbac_middleware_1.requireRole)('manager', 'host', 'waiter', 'chef', 'cashier'), (0, validate_middleware_1.validate)(staff_feedback_schema_1.submitFeedbackSchema), staff_feedback_controller_1.submitFeedbackHandler);
// GET /staff-feedback/admin
// MUST be declared BEFORE GET / to prevent Express matching 'admin' as a param
// Super admin only — cross-restaurant view
router.get('/admin', (0, rbac_middleware_1.requireRole)('super_admin'), staff_feedback_controller_1.getFeedbackForAdminHandler);
// GET /staff-feedback
// Owner or super_admin — sees their own restaurant's feedback
router.get('/', (0, rbac_middleware_1.requireRole)('owner', 'super_admin'), staff_feedback_controller_1.getFeedbackForRestaurantHandler);
// PATCH /staff-feedback/:id/flag
// Owner or super_admin can flag entries for follow-up
router.patch('/:id/flag', (0, rbac_middleware_1.requireRole)('owner', 'super_admin'), staff_feedback_controller_1.flagFeedbackHandler);
exports.default = router;
//# sourceMappingURL=staff-feedback.routes.js.map