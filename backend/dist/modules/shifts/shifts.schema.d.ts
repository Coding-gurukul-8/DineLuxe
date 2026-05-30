import { z } from 'zod';
export declare const createShiftSchema: z.ZodEffects<z.ZodObject<{
    branch_id: z.ZodString;
    staff_id: z.ZodString;
    date: z.ZodString;
    start_time: z.ZodEffects<z.ZodString, string, string>;
    end_time: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branch_id: string;
    date: string;
    start_time: string;
    end_time: string;
    staff_id: string;
    notes?: string | undefined;
}, {
    branch_id: string;
    date: string;
    start_time: string;
    end_time: string;
    staff_id: string;
    notes?: string | undefined;
}>, {
    branch_id: string;
    date: string;
    start_time: string;
    end_time: string;
    staff_id: string;
    notes?: string | undefined;
}, {
    branch_id: string;
    date: string;
    start_time: string;
    end_time: string;
    staff_id: string;
    notes?: string | undefined;
}>;
export declare const createShiftForStaffSchema: z.ZodEffects<z.ZodObject<{
    date: z.ZodString;
    start_time: z.ZodEffects<z.ZodString, string, string>;
    end_time: z.ZodEffects<z.ZodString, string, string>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string | undefined;
}, {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string | undefined;
}>, {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string | undefined;
}, {
    date: string;
    start_time: string;
    end_time: string;
    notes?: string | undefined;
}>;
export declare const updateShiftSchema: z.ZodEffects<z.ZodObject<{
    start_time: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    end_time: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    start_time?: string | undefined;
    end_time?: string | undefined;
    notes?: string | undefined;
}, {
    start_time?: string | undefined;
    end_time?: string | undefined;
    notes?: string | undefined;
}>, {
    start_time?: string | undefined;
    end_time?: string | undefined;
    notes?: string | undefined;
}, {
    start_time?: string | undefined;
    end_time?: string | undefined;
    notes?: string | undefined;
}>;
export declare const getShiftsQuerySchema: z.ZodObject<{
    branch_id: z.ZodString;
    week_start: z.ZodString;
    staff_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branch_id: string;
    week_start: string;
    staff_id?: string | undefined;
}, {
    branch_id: string;
    week_start: string;
    staff_id?: string | undefined;
}>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type CreateShiftForStaffInput = z.infer<typeof createShiftForStaffSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type GetShiftsQueryInput = z.infer<typeof getShiftsQuerySchema>;
//# sourceMappingURL=shifts.schema.d.ts.map