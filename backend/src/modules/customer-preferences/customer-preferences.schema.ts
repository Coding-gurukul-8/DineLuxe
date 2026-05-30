import { z } from 'zod';

export const createCustomerPreferenceSchema = z.object({}).passthrough();
export const updateCustomerPreferenceSchema = z.object({}).passthrough();

export type CreateCustomerPreferenceInput = z.infer<typeof createCustomerPreferenceSchema>;
export type UpdateCustomerPreferenceInput = z.infer<typeof updateCustomerPreferenceSchema>;
