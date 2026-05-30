import { z } from 'zod';
export declare const saveTablePreferenceSchema: z.ZodObject<{
    branch_id: z.ZodString;
    preferred_table_id: z.ZodString;
    preferred_table_label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    branch_id: string;
    preferred_table_id: string;
    preferred_table_label: string;
}, {
    branch_id: string;
    preferred_table_id: string;
    preferred_table_label: string;
}>;
export declare const upsertDietaryProfileSchema: z.ZodEffects<z.ZodObject<{
    preferences: z.ZodOptional<z.ZodArray<z.ZodEnum<["vegan", "vegetarian", "halal", "jain", "gluten_free", "keto", "high_protein"]>, "many">>;
    allergies: z.ZodOptional<z.ZodArray<z.ZodEnum<["nuts", "dairy", "gluten", "eggs", "soy", "shellfish", "fish"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    preferences?: ("vegan" | "vegetarian" | "halal" | "jain" | "gluten_free" | "keto" | "high_protein")[] | undefined;
    allergies?: ("nuts" | "dairy" | "gluten" | "eggs" | "soy" | "shellfish" | "fish")[] | undefined;
}, {
    preferences?: ("vegan" | "vegetarian" | "halal" | "jain" | "gluten_free" | "keto" | "high_protein")[] | undefined;
    allergies?: ("nuts" | "dairy" | "gluten" | "eggs" | "soy" | "shellfish" | "fish")[] | undefined;
}>, {
    preferences?: ("vegan" | "vegetarian" | "halal" | "jain" | "gluten_free" | "keto" | "high_protein")[] | undefined;
    allergies?: ("nuts" | "dairy" | "gluten" | "eggs" | "soy" | "shellfish" | "fish")[] | undefined;
}, {
    preferences?: ("vegan" | "vegetarian" | "halal" | "jain" | "gluten_free" | "keto" | "high_protein")[] | undefined;
    allergies?: ("nuts" | "dairy" | "gluten" | "eggs" | "soy" | "shellfish" | "fish")[] | undefined;
}>;
export type SaveTablePreferenceInput = z.infer<typeof saveTablePreferenceSchema>;
export type UpsertDietaryProfileInput = z.infer<typeof upsertDietaryProfileSchema>;
//# sourceMappingURL=customer-preferences.schema.d.ts.map