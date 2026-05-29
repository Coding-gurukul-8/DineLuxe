import { z } from 'zod';
export declare const createOrderSchema: z.ZodObject<{
    table_id: z.ZodString;
    order_type: z.ZodEnum<["dine_in", "takeaway", "delivery"]>;
    items: z.ZodArray<z.ZodObject<{
        menu_item_id: z.ZodString;
        quantity: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
        addons: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            quantity: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            quantity: number;
        }, {
            name: string;
            quantity?: number | undefined;
        }>, "many">>>;
    }, "strip", z.ZodTypeAny, {
        menu_item_id: string;
        quantity: number;
        addons: {
            name: string;
            quantity: number;
        }[];
        notes?: string | undefined;
    }, {
        menu_item_id: string;
        quantity: number;
        notes?: string | undefined;
        addons?: {
            name: string;
            quantity?: number | undefined;
        }[] | undefined;
    }>, "many">;
    special_instructions: z.ZodOptional<z.ZodString>;
    /** Waiter/manager/cashier: place order on behalf of this customer */
    customer_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        menu_item_id: string;
        quantity: number;
        addons: {
            name: string;
            quantity: number;
        }[];
        notes?: string | undefined;
    }[];
    table_id: string;
    order_type: "delivery" | "dine_in" | "takeaway";
    customer_id?: string | undefined;
    special_instructions?: string | undefined;
}, {
    items: {
        menu_item_id: string;
        quantity: number;
        notes?: string | undefined;
        addons?: {
            name: string;
            quantity?: number | undefined;
        }[] | undefined;
    }[];
    table_id: string;
    order_type: "delivery" | "dine_in" | "takeaway";
    customer_id?: string | undefined;
    special_instructions?: string | undefined;
}>;
export declare const cancelOrderSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
//# sourceMappingURL=orders.schema.d.ts.map