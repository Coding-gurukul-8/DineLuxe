"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetDemandPrediction = handleGetDemandPrediction;
exports.handleGetRecommendation = handleGetRecommendation;
exports.handleGetWeeklyForecast = handleGetWeeklyForecast;
const response_1 = require("../../utils/response");
const staffing_service_1 = require("./staffing.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function handleKnownError(err, res, next) {
    const code = err.statusCode ?? err.status;
    if (code && code >= 400 && code < 600) {
        return res.status(code).json((0, response_1.error)(err.message));
    }
    next(err);
}
/** Validate a YYYY-MM-DD string. Returns true if valid. */
function isValidDate(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
}
// ─── GET /staffing/prediction?branch_id=&date= ───────────────────────────────
/**
 * Returns hourly demand predictions for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
async function handleGetDemandPrediction(req, res, next) {
    try {
        if (!req.restaurantId)
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        const { branch_id, date } = req.query;
        if (!branch_id)
            return res.status(400).json((0, response_1.error)('branch_id query param is required'));
        if (!date)
            return res.status(400).json((0, response_1.error)('date query param is required (YYYY-MM-DD)'));
        if (!isValidDate(date)) {
            return res.status(400).json((0, response_1.error)('date must be a valid YYYY-MM-DD string'));
        }
        const predictions = await (0, staffing_service_1.predictDemand)(branch_id, req.restaurantId, date);
        res.json((0, response_1.success)(predictions));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
// ─── GET /staffing/recommendation?branch_id=&date= ───────────────────────────
/**
 * Returns staffing recommendations with warnings for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
async function handleGetRecommendation(req, res, next) {
    try {
        if (!req.restaurantId)
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        const { branch_id, date } = req.query;
        if (!branch_id)
            return res.status(400).json((0, response_1.error)('branch_id query param is required'));
        if (!date)
            return res.status(400).json((0, response_1.error)('date query param is required (YYYY-MM-DD)'));
        if (!isValidDate(date)) {
            return res.status(400).json((0, response_1.error)('date must be a valid YYYY-MM-DD string'));
        }
        const recommendation = await (0, staffing_service_1.getStaffingRecommendation)(branch_id, req.restaurantId, date);
        res.json((0, response_1.success)(recommendation));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
// ─── GET /staffing/weekly?branch_id=&week_start= ────────────────────────────
/**
 * Returns a 7-day staffing forecast starting from week_start.
 * Query params: branch_id (required), week_start (YYYY-MM-DD, required)
 */
async function handleGetWeeklyForecast(req, res, next) {
    try {
        if (!req.restaurantId)
            return res.status(403).json((0, response_1.error)('Missing tenant context'));
        const { branch_id, week_start } = req.query;
        if (!branch_id)
            return res.status(400).json((0, response_1.error)('branch_id query param is required'));
        if (!week_start)
            return res.status(400).json((0, response_1.error)('week_start query param is required (YYYY-MM-DD)'));
        if (!isValidDate(week_start)) {
            return res.status(400).json((0, response_1.error)('week_start must be a valid YYYY-MM-DD string'));
        }
        const forecast = await (0, staffing_service_1.getWeeklyForecast)(branch_id, req.restaurantId, week_start);
        res.json((0, response_1.success)(forecast));
    }
    catch (err) {
        handleKnownError(err, res, next);
    }
}
//# sourceMappingURL=staffing.controller.js.map