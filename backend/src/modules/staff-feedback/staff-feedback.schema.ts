import { z } from 'zod';

export const createStaffFeedbackSchema = z.object({}).passthrough();
export const updateStaffFeedbackSchema = z.object({}).passthrough();

export type CreateStaffFeedbackInput = z.infer<typeof createStaffFeedbackSchema>;
export type UpdateStaffFeedbackInput = z.infer<typeof updateStaffFeedbackSchema>;
