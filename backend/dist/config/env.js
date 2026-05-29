"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // Frontend
    FRONTEND_URL: zod_1.z.string().url('FRONTEND_URL must be a valid URL'),
    FRONTEND_URLS: zod_1.z.string().optional(),
    // Supabase
    SUPABASE_URL: zod_1.z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    // ISSUE 5 — Why SUPABASE_JWT_SECRET and not JWT_SECRET:
    // This secret is used to sign and verify all JWTs in the system (access
    // tokens + refresh tokens). It is named SUPABASE_JWT_SECRET because it must
    // be the same value as the "JWT Secret" shown in the Supabase dashboard
    // (Project Settings → API → JWT Settings). If you ever connect a Supabase
    // client that also validates JWTs, they must share this secret.
    // The redundant JWT_SECRET key that used to exist in .env has been removed
    // to avoid confusion — only SUPABASE_JWT_SECRET is authoritative.
    SUPABASE_JWT_SECRET: zod_1.z.string().min(1, 'SUPABASE_JWT_SECRET is required'),
    // Redis
    REDIS_URL: zod_1.z.string().min(1, 'REDIS_URL is required'),
    // Email
    RESEND_API_KEY: zod_1.z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: zod_1.z.string().email('EMAIL_FROM must be a valid email'),
    // Auth / Security
    BCRYPT_SALT_ROUNDS: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(10).max(14)),
    OTP_EXPIRY_SECONDS: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().int().min(60)),
    GEO_FENCE_RADIUS_METERS: zod_1.z
        .string()
        .transform(Number)
        .pipe(zod_1.z.number().positive()),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');
    throw new Error(`\n❌ Invalid environment variables:\n${issues}\n`);
}
exports.config = parsed.data;
//# sourceMappingURL=env.js.map