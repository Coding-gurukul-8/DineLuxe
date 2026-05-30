import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const timeRegex = /^\d{2}:\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Transforms "HH:MM" → "HH:MM:00" for storage in the DB (VARCHAR(8))
const timeField = z
  .string()
  .regex(timeRegex, 'Time must be HH:MM')
  .transform((t) => `${t}:00`);

// ---------------------------------------------------------------------------
// createShiftSchema
// Used for POST /shifts
// ---------------------------------------------------------------------------
export const createShiftSchema = z
  .object({
    branch_id: z.string().uuid('Invalid branch_id'),
    staff_id: z.string().uuid('Invalid staff_id'),
    date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
    start_time: timeField,
    end_time: timeField,
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.start_time < data.end_time, {
    message: 'start_time must be before end_time',
    path: ['start_time'],
  });

// ---------------------------------------------------------------------------
// createShiftForStaffSchema
// Used for POST /staff/:staffId/shifts (staff_id comes from URL param)
// ---------------------------------------------------------------------------
export const createShiftForStaffSchema = z
  .object({
    date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
    start_time: timeField,
    end_time: timeField,
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.start_time < data.end_time, {
    message: 'start_time must be before end_time',
    path: ['start_time'],
  });

// ---------------------------------------------------------------------------
// updateShiftSchema
// Used for PATCH /shifts/:id
// ---------------------------------------------------------------------------
export const updateShiftSchema = z
  .object({
    start_time: timeField.optional(),
    end_time: timeField.optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });

// ---------------------------------------------------------------------------
// getShiftsQuerySchema
// Used for GET /shifts?branch_id=&week_start=&staff_id=
// ---------------------------------------------------------------------------
export const getShiftsQuerySchema = z.object({
  branch_id: z.string().uuid('Invalid branch_id'),
  week_start: z.string().regex(dateRegex, 'week_start must be YYYY-MM-DD'),
  staff_id: z.string().uuid('Invalid staff_id').optional(),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type CreateShiftForStaffInput = z.infer<typeof createShiftForStaffSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type GetShiftsQueryInput = z.infer<typeof getShiftsQuerySchema>;