import { z } from 'zod';

export const createShiftSchema = z.object({}).passthrough();
export const updateShiftSchema = z.object({}).passthrough();

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
