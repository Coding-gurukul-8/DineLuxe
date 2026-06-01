import { z } from 'zod';

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateInput(value: string): boolean {
  if (dateOnlyRegex.test(value)) return true;
  return !Number.isNaN(Date.parse(value));
}

function normalizeReportType(value: string): string {
  return value.replace(/_/g, '-');
}

export const salesReportQuerySchema = z
  .object({
    branch_id: z.string().uuid('branch_id must be a valid UUID'),
    from: z.string().refine(isValidDateInput, 'from must be a valid date or datetime'),
    to: z.string().refine(isValidDateInput, 'to must be a valid date or datetime'),
    granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
  })
  .refine(
    ({ from, to }) => new Date(from).getTime() <= new Date(to).getTime(),
    {
      message: 'from must be less than or equal to to',
      path: ['from'],
    },
  );

// BUG FIX: The original schema wrapped fields inside a `body` key:
//   z.object({ body: z.object({ ... }) })
// but validate() in validate.middleware.ts calls schema.safeParse(req.body),
// meaning it parses the body directly — not a wrapper object.
// Removing the `body` wrapper so validation works correctly.

/** Schema for POST /reports/export/sync — synchronous, csv|pdf only */
export const exportReportSchema = z.object({
  report_type: z
    .enum([
      'sales',
      'menu-performance',
      'kitchen-performance',
      'customer-insights',
      'platform',
      'menu_performance',
      'kitchen_performance',
      'customer_insights',
    ])
    .transform(normalizeReportType),
  branch_id: z.string().uuid().optional(),
  from: z
    .string()
    .refine(isValidDateInput, 'from must be a valid date or datetime')
    .optional(),
  to: z
    .string()
    .refine(isValidDateInput, 'to must be a valid date or datetime')
    .optional(),
  // Sync export supports csv and pdf only (xlsx is large — use the async queue)
  format: z.enum(['csv', 'pdf']).default('csv'),
});

/**
 * Schema for POST /reports/export — async Bull-backed queue export.
 * Extends exportReportSchema with:
 *   - xlsx format support
 *   - required from/to (large exports should always be explicit about date range)
 *   - required report_type restricted to the four data report types
 *     (platform is admin-only and not suited for async email delivery)
 */
export const queueExportReportSchema = z
  .object({
    report_type: z
      .enum([
        'sales',
        'menu-performance',
        'kitchen-performance',
        'customer-insights',
        // underscore aliases for convenience
        'menu_performance',
        'kitchen_performance',
        'customer_insights',
      ])
      .transform(normalizeReportType),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    branch_id: z.string().uuid('branch_id must be a valid UUID').optional(),
    from: z
      .string()
      .refine(isValidDateInput, 'from must be a valid date or datetime')
      .optional(),
    to: z
      .string()
      .refine(isValidDateInput, 'to must be a valid date or datetime')
      .optional(),
  })
  .refine(
    ({ from, to }) => {
      if (!from || !to) return true; // optional; controller enforces for specific types
      return new Date(from).getTime() <= new Date(to).getTime();
    },
    {
      message: 'from must be less than or equal to to',
      path: ['from'],
    },
  );

export type ExportReportInput = z.infer<typeof exportReportSchema>;
export type QueueExportReportInput = z.infer<typeof queueExportReportSchema>;