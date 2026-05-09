import { z } from 'zod';
export declare const createTicketSchema: z.ZodObject<{
    subject: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["order", "payment", "delivery", "account", "other"]>;
    order_id: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
}, "strip", z.ZodTypeAny, {
    subject: string;
    description: string;
    category: "order" | "delivery" | "payment" | "other" | "account";
    priority: "high" | "medium" | "low";
    order_id?: string | undefined;
}, {
    subject: string;
    description: string;
    category: "order" | "delivery" | "payment" | "other" | "account";
    order_id?: string | undefined;
    priority?: "high" | "medium" | "low" | undefined;
}>;
export declare const updateTicketStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["open", "assigned", "resolved", "closed"]>;
    resolution_note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "closed" | "open" | "assigned" | "resolved";
    resolution_note?: string | undefined;
}, {
    status: "closed" | "open" | "assigned" | "resolved";
    resolution_note?: string | undefined;
}>;
export declare const postMessageSchema: z.ZodObject<{
    message: z.ZodString;
    attachments: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    attachments?: string[] | undefined;
}, {
    message: string;
    attachments?: string[] | undefined;
}>;
//# sourceMappingURL=support.schema.d.ts.map