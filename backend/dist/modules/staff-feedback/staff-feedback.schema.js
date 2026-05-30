"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFeedbackSchema = exports.submitFeedbackSchema = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// submitFeedbackSchema
// POST /staff-feedback — called by any staff member
// ---------------------------------------------------------------------------
exports.submitFeedbackSchema = zod_1.z.object({
    feedback_text: zod_1.z
        .string()
        .min(10, 'Feedback must be at least 10 characters')
        .max(2000, 'Feedback cannot exceed 2000 characters'),
    branch_id: zod_1.z.string().uuid('Invalid branch_id').optional(),
});
// ---------------------------------------------------------------------------
// listFeedbackSchema
// GET /staff-feedback — used as query-param validator
// ---------------------------------------------------------------------------
exports.listFeedbackSchema = zod_1.z.object({
    restaurant_id: zod_1.z.string().uuid('Invalid restaurant_id').optional(),
    branch_id: zod_1.z.string().uuid('Invalid branch_id').optional(),
    sentiment: zod_1.z.enum(['positive', 'neutral', 'negative']).optional(),
    page: zod_1.z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : 1))
        .pipe(zod_1.z.number().int().positive().default(1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
        .pipe(zod_1.z.number().int().positive().max(50).default(20)),
});
//# sourceMappingURL=staff-feedback.schema.js.map