"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetRulesForBranch = handleGetRulesForBranch;
exports.handleGetActiveRulesNow = handleGetActiveRulesNow;
exports.handleCreateRule = handleCreateRule;
exports.handleUpdateRule = handleUpdateRule;
exports.handleToggleRule = handleToggleRule;
exports.handleDeleteRule = handleDeleteRule;
const response_1 = require("../../utils/response");
const dynamic_pricing_service_1 = require("./dynamic-pricing.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function handleKnownError(err, res, next) {
    const code = err.statusCode ?? err.status;
    if (code && code >= 400 && code < 600) {
        return res.status(code).json((0, response_1.error)(err.message));
    }
    next(err);
}
// ─── Handlers ─────────────────────────────────────────────────────────────────
/**
 * GET /dynamic-pricing/branch/:branchId
 * Returns all pricing rules for a branch. Manager/owner only.
 */
async function handleGetRulesForBranch(req, res, next) {
    try {
        if (!req.restaurantId)
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        const { branchId } = req.params;
        const rules = await (0, dynamic_pricing_service_1.getRulesForBranch)(branchId, req.restaurantId);
        res.json((0, response_1.success)(rules));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * GET /dynamic-pricing/branch/:branchId/active
 * Returns currently active rules based on IST time. Public — used by menu service.
 */
async function handleGetActiveRulesNow(req, res, next) {
    try {
        const { branchId } = req.params;
        if (!branchId)
            return res.status(400).json((0, response_1.error)('branchId is required'));
        const rules = await (0, dynamic_pricing_service_1.getActiveRulesNow)(branchId);
        res.json((0, response_1.success)(rules));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * POST /dynamic-pricing
 * Create a new pricing rule. Manager/owner only.
 */
async function handleCreateRule(req, res, next) {
    try {
        if (!req.branchId || !req.restaurantId) {
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        }
        const rule = await (0, dynamic_pricing_service_1.createRule)(req.branchId, req.restaurantId, req.body, req.user.id);
        res.status(201).json((0, response_1.success)(rule, 'Pricing rule created'));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * PATCH /dynamic-pricing/:id
 * Update an existing pricing rule. Manager/owner only.
 */
async function handleUpdateRule(req, res, next) {
    try {
        if (!req.branchId || !req.restaurantId) {
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        }
        const rule = await (0, dynamic_pricing_service_1.updateRule)(req.params.id, req.branchId, req.restaurantId, req.body);
        res.json((0, response_1.success)(rule, 'Pricing rule updated'));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * PATCH /dynamic-pricing/:id/toggle
 * Toggle is_active on a rule and notify customer app via WebSocket. Manager/owner only.
 */
async function handleToggleRule(req, res, next) {
    try {
        if (!req.branchId || !req.restaurantId) {
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        }
        const rule = await (0, dynamic_pricing_service_1.toggleRule)(req.params.id, req.branchId, req.restaurantId);
        const state = rule.is_active ? 'activated' : 'deactivated';
        res.json((0, response_1.success)(rule, `Pricing rule ${state}`));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * DELETE /dynamic-pricing/:id
 * Delete a pricing rule. Manager/owner only.
 */
async function handleDeleteRule(req, res, next) {
    try {
        if (!req.branchId || !req.restaurantId) {
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        }
        const result = await (0, dynamic_pricing_service_1.deleteRule)(req.params.id, req.branchId, req.restaurantId);
        res.json((0, response_1.success)(result, 'Pricing rule deleted'));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
//# sourceMappingURL=dynamic-pricing.controller.js.map