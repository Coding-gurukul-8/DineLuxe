"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertDietaryProfileSchema = exports.saveTablePreferenceSchema = void 0;
const zod_1 = require("zod");
// ─── Table Preference ─────────────────────────────────────────────────────────
exports.saveTablePreferenceSchema = zod_1.z.object({
    branch_id: zod_1.z.string().uuid(),
    preferred_table_id: zod_1.z.string().uuid(),
    preferred_table_label: zod_1.z.string().max(10),
});
// ─── Dietary Profile ──────────────────────────────────────────────────────────
exports.upsertDietaryProfileSchema = zod_1.z
    .object({
    preferences: zod_1.z
        .array(zod_1.z.enum([
        'vegan',
        'vegetarian',
        'halal',
        'jain',
        'gluten_free',
        'keto',
        'high_protein',
    ]))
        .optional(),
    allergies: zod_1.z
        .array(zod_1.z.enum(['nuts', 'dairy', 'gluten', 'eggs', 'soy', 'shellfish', 'fish']))
        .optional(),
})
    .refine((d) => d.preferences !== undefined || d.allergies !== undefined, {
    message: 'At least one field (preferences or allergies) is required',
});
//# sourceMappingURL=customer-preferences.schema.js.map