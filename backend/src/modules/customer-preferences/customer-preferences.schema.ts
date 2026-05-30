import { z } from 'zod';

// ─── Table Preference ─────────────────────────────────────────────────────────

export const saveTablePreferenceSchema = z.object({
  branch_id: z.string().uuid(),
  preferred_table_id: z.string().uuid(),
  preferred_table_label: z.string().max(10),
});

// ─── Dietary Profile ──────────────────────────────────────────────────────────

export const upsertDietaryProfileSchema = z
  .object({
    preferences: z
      .array(
        z.enum([
          'vegan',
          'vegetarian',
          'halal',
          'jain',
          'gluten_free',
          'keto',
          'high_protein',
        ]),
      )
      .optional(),
    allergies: z
      .array(
        z.enum(['nuts', 'dairy', 'gluten', 'eggs', 'soy', 'shellfish', 'fish']),
      )
      .optional(),
  })
  .refine((d) => d.preferences !== undefined || d.allergies !== undefined, {
    message: 'At least one field (preferences or allergies) is required',
  });

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveTablePreferenceInput = z.infer<typeof saveTablePreferenceSchema>;
export type UpsertDietaryProfileInput = z.infer<typeof upsertDietaryProfileSchema>;