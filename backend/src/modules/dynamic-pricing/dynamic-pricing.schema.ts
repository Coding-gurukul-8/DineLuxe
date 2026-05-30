import { z } from 'zod';

// ─── Create Rule ───────────────────────────────────────────────────────────────

export const createRuleSchema = z
  .object({
    menu_item_id: z.string().uuid().optional().nullable(),
    menu_category_id: z.string().uuid().optional().nullable(),
    rule_name: z.string().min(1).max(100),
    discount_type: z.enum(['percentage', 'fixed_amount']),
    discount_value: z
      .number()
      .positive()
      .refine(
        (val) => true, // range validated in refine below per discount_type
        { message: 'Invalid discount value' },
      ),
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM')
      .transform((t) => t + ':00'),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM')
      .transform((t) => t + ':00'),
  })
  .refine((d) => d.menu_item_id || d.menu_category_id, {
    message: 'Either menu_item_id or menu_category_id is required',
  })
  .refine(
    (d) => {
      if (d.discount_type === 'percentage' && d.discount_value > 100) return false;
      return true;
    },
    { message: 'Percentage discount cannot exceed 100' },
  )
  .refine((d) => d.start_time < d.end_time, {
    message: 'start_time must be before end_time',
  });

// ─── Update Rule ──────────────────────────────────────────────────────────────

export const updateRuleSchema = z
  .object({
    rule_name: z.string().min(1).max(100).optional(),
    discount_type: z.enum(['percentage', 'fixed_amount']).optional(),
    discount_value: z.number().positive().optional(),
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM')
      .transform((t) => t + ':00')
      .optional(),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM')
      .transform((t) => t + ':00')
      .optional(),
  })
  .refine(
    (d) => {
      if (d.discount_type === 'percentage' && d.discount_value !== undefined && d.discount_value > 100) {
        return false;
      }
      return true;
    },
    { message: 'Percentage discount cannot exceed 100' },
  )
  .refine(
    (d) => {
      if (d.start_time && d.end_time) return d.start_time < d.end_time;
      return true;
    },
    { message: 'start_time must be before end_time' },
  );

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;