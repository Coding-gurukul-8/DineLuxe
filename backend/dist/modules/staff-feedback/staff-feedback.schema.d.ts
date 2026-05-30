import { z } from 'zod';
export declare const submitFeedbackSchema: z.ZodObject<{
    feedback_text: z.ZodString;
    branch_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    feedback_text: string;
    branch_id?: string | undefined;
}, {
    feedback_text: string;
    branch_id?: string | undefined;
}>;
export declare const listFeedbackSchema: z.ZodObject<{
    restaurant_id: z.ZodOptional<z.ZodString>;
    branch_id: z.ZodOptional<z.ZodString>;
    sentiment: z.ZodOptional<z.ZodEnum<["positive", "neutral", "negative"]>>;
    page: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, z.ZodDefault<z.ZodNumber>>;
    limit: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    restaurant_id?: string | undefined;
    branch_id?: string | undefined;
    sentiment?: "positive" | "neutral" | "negative" | undefined;
}, {
    restaurant_id?: string | undefined;
    branch_id?: string | undefined;
    limit?: string | undefined;
    page?: string | undefined;
    sentiment?: "positive" | "neutral" | "negative" | undefined;
}>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type ListFeedbackInput = z.infer<typeof listFeedbackSchema>;
//# sourceMappingURL=staff-feedback.schema.d.ts.map