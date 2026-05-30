"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyShifts = getWeeklyShifts;
exports.createShift = createShift;
exports.createShiftForStaff = createShiftForStaff;
exports.updateShift = updateShift;
exports.deleteShift = deleteShift;
const response_1 = require("../../utils/response");
const shiftsService = __importStar(require("./shifts.service"));
// ---------------------------------------------------------------------------
// GET /shifts?branch_id=&week_start=&staff_id=
// Also mounted as GET /staff/shifts (same handler, same query params)
// ---------------------------------------------------------------------------
async function getWeeklyShifts(req, res, next) {
    try {
        const authReq = req;
        const { branch_id, week_start, staff_id } = req.query;
        const data = await shiftsService.getShiftsForWeek(branch_id, week_start, authReq.restaurantId, staff_id);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// POST /shifts
// body: { branch_id, staff_id, date, start_time, end_time, notes? }
// ---------------------------------------------------------------------------
async function createShift(req, res, next) {
    try {
        const authReq = req;
        const shift = await shiftsService.createShift(req.body, authReq.user.id, authReq.restaurantId);
        res.status(201).json((0, response_1.success)(shift, 'Shift created successfully'));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// POST /staff/:staffId/shifts
// body: { date, start_time, end_time, notes? }
// staff_id comes from URL param; branch_id from JWT (req.branchId)
// ---------------------------------------------------------------------------
async function createShiftForStaff(req, res, next) {
    try {
        const authReq = req;
        const shift = await shiftsService.createShiftForStaff(req.params.staffId, req.body, authReq.user.id, authReq.branchId, authReq.restaurantId);
        res.status(201).json((0, response_1.success)(shift, 'Shift created successfully'));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// PATCH /shifts/:id
// body: { start_time?, end_time?, notes? }
// ---------------------------------------------------------------------------
async function updateShift(req, res, next) {
    try {
        const authReq = req;
        const shift = await shiftsService.updateShift(req.params.id, req.body, authReq.restaurantId);
        res.json((0, response_1.success)(shift, 'Shift updated successfully'));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// DELETE /shifts/:id
// ---------------------------------------------------------------------------
async function deleteShift(req, res, next) {
    try {
        const authReq = req;
        const result = await shiftsService.deleteShift(req.params.id, authReq.restaurantId);
        res.json((0, response_1.success)(result, 'Shift deleted successfully'));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=shifts.controller.js.map