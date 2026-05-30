"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetDietaryProfile = handleGetDietaryProfile;
exports.handleUpsertDietaryProfile = handleUpsertDietaryProfile;
exports.handleGetAllPreferences = handleGetAllPreferences;
exports.handleGetTablePreference = handleGetTablePreference;
exports.handleSaveTablePreference = handleSaveTablePreference;
const response_1 = require("../../utils/response");
const customer_preferences_service_1 = require("./customer-preferences.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function handleKnownError(err, res, next) {
    const code = err.statusCode ?? err.status;
    if (code && code >= 400 && code < 600) {
        return res.status(code).json((0, response_1.error)(err.message));
    }
    next(err);
}
// ─── Dietary Profile Handlers ─────────────────────────────────────────────────
/**
 * GET /customer-preferences/dietary
 * Returns the authenticated customer's dietary profile.
 */
async function handleGetDietaryProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const profile = await (0, customer_preferences_service_1.getDietaryProfile)(userId);
        res.json((0, response_1.success)(profile));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * PATCH /customer-preferences/dietary
 * Create or update the authenticated customer's dietary profile.
 */
async function handleUpsertDietaryProfile(req, res, next) {
    try {
        const userId = req.user.id;
        const profile = await (0, customer_preferences_service_1.upsertDietaryProfile)(userId, req.body);
        res.json((0, response_1.success)(profile, 'Dietary profile updated'));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
// ─── Table Preference Handlers ────────────────────────────────────────────────
/**
 * GET /customer-preferences/tables
 * Returns all table preferences for the customer across all branches.
 */
async function handleGetAllPreferences(req, res, next) {
    try {
        const userId = req.user.id;
        const preferences = await (0, customer_preferences_service_1.getAllPreferences)(userId);
        res.json((0, response_1.success)(preferences));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * GET /customer-preferences/tables/:branchId
 * Returns the customer's saved table preference for a specific branch, or null.
 */
async function handleGetTablePreference(req, res, next) {
    try {
        const userId = req.user.id;
        const { branchId } = req.params;
        if (!branchId)
            return res.status(400).json((0, response_1.error)('branchId is required'));
        const preference = await (0, customer_preferences_service_1.getTablePreference)(userId, branchId);
        res.json((0, response_1.success)(preference));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
/**
 * POST /customer-preferences/tables
 * Save or update the customer's preferred table for a branch.
 */
async function handleSaveTablePreference(req, res, next) {
    try {
        const userId = req.user.id;
        const { branch_id, preferred_table_id, preferred_table_label } = req.body;
        const preference = await (0, customer_preferences_service_1.saveTablePreference)(userId, branch_id, preferred_table_id, preferred_table_label);
        res.status(201).json((0, response_1.success)(preference, 'Table preference saved'));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
//# sourceMappingURL=customer-preferences.controller.js.map