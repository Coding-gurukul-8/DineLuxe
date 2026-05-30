import { z } from 'zod';
export declare const upsertRecipeSchema: z.ZodObject<{
    menu_item_id: z.ZodString;
    ingredients: z.ZodArray<z.ZodObject<{
        inventory_item_id: z.ZodString;
        quantity_per_serving: z.ZodNumber;
        unit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        unit: string;
        inventory_item_id: string;
        quantity_per_serving: number;
    }, {
        unit: string;
        inventory_item_id: string;
        quantity_per_serving: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    menu_item_id: string;
    ingredients: {
        unit: string;
        inventory_item_id: string;
        quantity_per_serving: number;
    }[];
}, {
    menu_item_id: string;
    ingredients: {
        unit: string;
        inventory_item_id: string;
        quantity_per_serving: number;
    }[];
}>;
export declare const deleteIngredientSchema: z.ZodObject<{
    menu_item_id: z.ZodString;
    inventory_item_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    menu_item_id: string;
    inventory_item_id: string;
}, {
    menu_item_id: string;
    inventory_item_id: string;
}>;
export type UpsertRecipeInput = z.infer<typeof upsertRecipeSchema>;
export type DeleteIngredientInput = z.infer<typeof deleteIngredientSchema>;
//# sourceMappingURL=recipe-ingredients.schema.d.ts.map