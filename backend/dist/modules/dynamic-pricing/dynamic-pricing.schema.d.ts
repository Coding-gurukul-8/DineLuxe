import { z } from 'zod';
export declare const createRuleSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    menu_item_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    menu_category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rule_name: z.ZodString;
    discount_type: z.ZodEnum<["percentage", "fixed_amount"]>;
    discount_value: z.ZodEffects<z.ZodNumber, number, number>;
    days_of_week: z.ZodArray<z.ZodNumber, "many">;
    start_time: z.ZodEffects<z.ZodString, string, string>;
    end_time: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}>, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}>, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}>, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}, {
    rule_name: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    menu_item_id?: string | null | undefined;
    menu_category_id?: string | null | undefined;
}>;
export declare const updateRuleSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    rule_name: z.ZodOptional<z.ZodString>;
    discount_type: z.ZodOptional<z.ZodEnum<["percentage", "fixed_amount"]>>;
    discount_value: z.ZodOptional<z.ZodNumber>;
    days_of_week: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    start_time: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    end_time: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}>, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}>, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}, {
    rule_name?: string | undefined;
    discount_type?: "percentage" | "fixed_amount" | undefined;
    discount_value?: number | undefined;
    days_of_week?: number[] | undefined;
    start_time?: string | undefined;
    end_time?: string | undefined;
}>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
//# sourceMappingURL=dynamic-pricing.schema.d.ts.map