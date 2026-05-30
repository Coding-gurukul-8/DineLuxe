import { z } from 'zod';

// ---------------------------------------------------------------------------
// submitFeedbackSchema
// POST /staff-feedback — called by any staff member
// ---------------------------------------------------------------------------
export const submitFeedbackSchema = z.object({
  feedback_text: z
    .string()
    .min(10, 'Feedback must be at least 10 characters')
    .max(2000, 'Feedback cannot exceed 2000 characters'),
  branch_id: z.string().uuid('Invalid branch_id').optional(),
});

// ---------------------------------------------------------------------------
// listFeedbackSchema
// GET /staff-feedback — used as query-param validator
// ---------------------------------------------------------------------------
export const listFeedbackSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant_id').optional(),
  branch_id: z.string().uuid('Invalid branch_id').optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 1))
    .pipe(z.number().int().positive().default(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().positive().max(50).default(20)),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type ListFeedbackInput = z.infer<typeof listFeedbackSchema>;