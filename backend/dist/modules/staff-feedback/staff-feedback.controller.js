"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFeedbackHandler = submitFeedbackHandler;
exports.getFeedbackForRestaurantHandler = getFeedbackForRestaurantHandler;
exports.getFeedbackForAdminHandler = getFeedbackForAdminHandler;
exports.flagFeedbackHandler = flagFeedbackHandler;
const response_1 = require("../../utils/response");
const staff_feedback_service_1 = require("./staff-feedback.service");
// ---------------------------------------------------------------------------
// POST /staff-feedback
// Any authenticated staff member can submit feedback
// ---------------------------------------------------------------------------
async function submitFeedbackHandler(req, res, next) {
    try {
        const authReq = req;
        const { feedback_text, branch_id } = req.body;
        const result = await (0, staff_feedback_service_1.submitFeedback)(authReq.user.id, authReq.restaurantId, branch_id, authReq.user.role, feedback_text);
        res.status(201).json((0, response_1.success)(result));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// GET /staff-feedback
// Owner sees feedback for their own restaurant (restaurantId from JWT)
// ---------------------------------------------------------------------------
async function getFeedbackForRestaurantHandler(req, res, next) {
    try {
        const authReq = req;
        const query = req.query;
        const result = await (0, staff_feedback_service_1.getFeedbackForRestaurant)(authReq.restaurantId, {
            branch_id: query.branch_id,
            sentiment: query.sentiment,
            page: query.page ? parseInt(query.page, 10) : 1,
            limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 20,
        });
        res.json((0, response_1.success)(result));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// GET /staff-feedback/admin
// Super admin — can query across all restaurants
// ---------------------------------------------------------------------------
async function getFeedbackForAdminHandler(req, res, next) {
    try {
        const query = req.query;
        const result = await (0, staff_feedback_service_1.getFeedbackForAdmin)({
            restaurant_id: query.restaurant_id,
            branch_id: query.branch_id,
            sentiment: query.sentiment,
            page: query.page ? parseInt(query.page, 10) : 1,
            limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 20,
        });
        res.json((0, response_1.success)(result));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// PATCH /staff-feedback/:id/flag
// Owner or super_admin can flag/unflag a feedback entry
// ---------------------------------------------------------------------------
async function flagFeedbackHandler(req, res, next) {
    try {
        const authReq = req;
        const { is_flagged } = req.body;
        if (typeof is_flagged !== 'boolean') {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'is_flagged must be a boolean' } });
            return;
        }
        // Super admins pass '' as restaurantId — service skips ownership check
        const restaurantId = authReq.user.role === 'super_admin' ? '' : authReq.restaurantId;
        const result = await (0, staff_feedback_service_1.flagFeedback)(req.params.id, restaurantId, is_flagged);
        res.json((0, response_1.success)(result, `Feedback ${is_flagged ? 'flagged' : 'unflagged'} successfully`));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=staff-feedback.controller.js.map