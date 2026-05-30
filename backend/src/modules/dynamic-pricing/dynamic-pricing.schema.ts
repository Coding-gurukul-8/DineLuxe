import { z } from 'zod';

export const createDynamicPricingSchema = z.object({}).passthrough();
export const updateDynamicPricingSchema = z.object({}).passthrough();

export type CreateDynamicPricingInput = z.infer<typeof createDynamicPricingSchema>;
export type UpdateDynamicPricingInput = z.infer<typeof updateDynamicPricingSchema>;
