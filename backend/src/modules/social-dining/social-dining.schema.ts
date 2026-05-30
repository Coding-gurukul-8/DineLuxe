import { z } from 'zod';

export const createGroupSchema = z.object({
  booking_id: z.string().uuid(),
  max_members: z.number().int().min(2).max(20).default(10),
});

export const joinGroupSchema = z.object({
  invite_code: z.string().min(6).max(12),
});

export const preOrderSchema = z.object({
  pre_orders: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().positive().max(20),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type PreOrderInput = z.infer<typeof preOrderSchema>;