import { z } from 'zod';

export const createCouponSchema = z.object({
  code: z.string().min(3).max(20).transform((value) => value.toUpperCase()),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().positive(),
  min_order_amount: z.number().min(0).optional().default(0),
  max_uses: z.number().int().positive().optional(),
  expires_at: z.string().datetime().optional(),
  is_active: z.boolean().default(true),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1).transform((value) => value.toUpperCase()),
  order_amount: z.number().positive(),
  order_type: z.enum(['dine_in', 'delivery', 'takeaway']),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;