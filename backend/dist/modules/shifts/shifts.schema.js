"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShiftsQuerySchema = exports.updateShiftSchema = exports.createShiftForStaffSchema = exports.createShiftSchema = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const timeRegex = /^\d{2}:\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
// Transforms "HH:MM" → "HH:MM:00" for storage in the DB (VARCHAR(8))
const timeField = zod_1.z
    .string()
    .regex(timeRegex, 'Time must be HH:MM')
    .transform((t) => `${t}:00`);
// ---------------------------------------------------------------------------
// createShiftSchema
// Used for POST /shifts
// ---------------------------------------------------------------------------
exports.createShiftSchema = zod_1.z
    .object({
    branch_id: zod_1.z.string().uuid('Invalid branch_id'),
    staff_id: zod_1.z.string().uuid('Invalid staff_id'),
    date: zod_1.z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
    start_time: timeField,
    end_time: timeField,
    notes: zod_1.z.string().max(500).optional(),
})
    .refine((data) => data.start_time < data.end_time, {
    message: 'start_time must be before end_time',
    path: ['start_time'],
});
// ---------------------------------------------------------------------------
// createShiftForStaffSchema
// Used for POST /staff/:staffId/shifts (staff_id comes from URL param)
// ---------------------------------------------------------------------------
exports.createShiftForStaffSchema = zod_1.z
    .object({
    date: zod_1.z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
    start_time: timeField,
    end_time: timeField,
    notes: zod_1.z.string().max(500).optional(),
})
    .refine((data) => data.start_time < data.end_time, {
    message: 'start_time must be before end_time',
    path: ['start_time'],
});
// ---------------------------------------------------------------------------
// updateShiftSchema
// Used for PATCH /shifts/:id
// ---------------------------------------------------------------------------
exports.updateShiftSchema = zod_1.z
    .object({
    start_time: timeField.optional(),
    end_time: timeField.optional(),
    notes: zod_1.z.string().max(500).optional(),
})
    .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
});
// ---------------------------------------------------------------------------
// getShiftsQuerySchema
// Used for GET /shifts?branch_id=&week_start=&staff_id=
// ---------------------------------------------------------------------------
exports.getShiftsQuerySchema = zod_1.z.object({
    branch_id: zod_1.z.string().uuid('Invalid branch_id'),
    week_start: zod_1.z.string().regex(dateRegex, 'week_start must be YYYY-MM-DD'),
    staff_id: zod_1.z.string().uuid('Invalid staff_id').optional(),
});
//# sourceMappingURL=shifts.schema.js.map