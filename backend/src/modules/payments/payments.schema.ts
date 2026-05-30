import { z } from 'zod';

export const initiateSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(['upi', 'card', 'cash', 'wallet']),
  split_with: z.array(z.string().uuid()).optional(), // user IDs for split bill
  coupon_code: z.string().trim().min(1).max(50).optional(),
});

export const verifySchema = z.object({
  payment_id: z.string().uuid(),
  gateway_payment_id: z.string().optional(),
  status: z.enum(['success', 'failed', 'pending']),
  gateway_signature: z.string().optional(),
});

export const splitSchema = z.object({
  order_id: z.string().uuid(),
  splits: z.array(
    z.object({
      label: z.string().min(1).max(100), // e.g. "Person 1"
      amount: z.number().positive(),
      payment_method: z.enum(['upi', 'card', 'cash', 'wallet']),
    })
  ).min(2),
});

export const upiQRSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive().optional(), // override for partial/split
});

export const webhookSchema = z.object({
  event: z.string(),
  payment_id: z.string(),
  order_id: z.string().optional(),
  status: z.string(),
  amount: z.number().optional(),
  gateway_signature: z.string().optional(),
});

// ─── Refund Schemas ───────────────────────────────────────────────────────────

export const refundRequestSchema = z.object({
  reason: z.string().min(10, 'Please provide at least 10 characters describing the issue').max(2000),
  items: z.array(z.string().uuid()).optional(), // optional: specific order_item IDs
});

export const processRefundSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(1000).optional(),
});

export type InitiateInput = z.infer<typeof initiateSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type SplitInput = z.infer<typeof splitSchema>;
export type UPIQRInput = z.infer<typeof upiQRSchema>;
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;
export type ProcessRefundInput = z.infer<typeof processRefundSchema>;
