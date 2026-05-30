import { z } from 'zod';

export const createWasteLogSchema = z.object({}).passthrough();
export const updateWasteLogSchema = z.object({}).passthrough();

export type CreateWasteLogInput = z.infer<typeof createWasteLogSchema>;
export type UpdateWasteLogInput = z.infer<typeof updateWasteLogSchema>;
