import { z } from 'zod';
/** Flat shape — validates `req.body` directly */
export declare const registerDeviceSchema: z.ZodObject<{
    token: z.ZodString;
    platform: z.ZodOptional<z.ZodEnum<["ios", "android", "web"]>>;
}, "strip", z.ZodTypeAny, {
    token: string;
    platform?: "ios" | "android" | "web" | undefined;
}, {
    token: string;
    platform?: "ios" | "android" | "web" | undefined;
}>;
//# sourceMappingURL=notifications.schema.d.ts.map