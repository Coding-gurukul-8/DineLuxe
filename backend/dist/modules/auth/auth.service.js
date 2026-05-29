"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.verifyOtp = verifyOtp;
exports.login = login;
exports.forgotPassword = forgotPassword;
exports.sendVerificationOtp = sendVerificationOtp;
exports.resetPassword = resetPassword;
exports.changePassword = changePassword;
exports.refreshToken = refreshToken;
exports.logout = logout;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const supabase_1 = require("../../config/supabase");
const redis_1 = require("../../config/redis");
const env_1 = require("../../config/env");
const otp_1 = require("../../utils/otp");
const send_1 = require("../../email/send");
// ─── Token helpers ────────────────────────────────────────────────────────────
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.config.SUPABASE_JWT_SECRET, { expiresIn: '15m' });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.config.SUPABASE_JWT_SECRET, { expiresIn: '7d' });
}
function refreshTokenKey(userId) {
    return `refresh_token:${userId}`;
}
function forgotPasswordRateLimitKey(email) {
    return `forgot_rl:${email}`;
}
function mapOtpError(err) {
    if (!(err instanceof Error))
        return err;
    const raw = err.message ?? '';
    const [codePart, ...rest] = raw.split(':');
    const code = codePart?.trim();
    if (!code || !code.startsWith('OTP_'))
        return err;
    const message = rest.join(':').trim() || raw;
    const mapped = new Error(message);
    mapped.code = code;
    switch (code) {
        case 'OTP_INVALID':
            mapped.status = 400;
            break;
        case 'OTP_EXPIRED':
            mapped.status = 410;
            break;
        case 'OTP_LOCKED':
            mapped.status = 429;
            break;
        default:
            mapped.status = 400;
            break;
    }
    return mapped;
}
// ─── Service methods ──────────────────────────────────────────────────────────
/**
 * Signup creates the account immediately and sends OTP for optional
 * email verification.
 */
async function signup(input) {
    // BUG FIX: normalise firstName/lastName from the flexible schema.
    // Clients may send `name` (e.g. "John Doe") OR firstName + lastName separately.
    let firstName;
    let lastName;
    if (input.firstName) {
        firstName = input.firstName;
        lastName = input.lastName ?? '';
    }
    else {
        // Split `name` field into first / last
        const parts = (input.name ?? '').trim().split(' ').filter(Boolean);
        firstName = parts[0] ?? '';
        lastName = parts.slice(1).join(' ');
    }
    const email = input.email.toLowerCase().trim();
    // Check email uniqueness in profile table
    const { data: existing, error: existingError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    if (existingError) {
        throw new Error(`Email lookup failed: ${existingError.message}`);
    }
    if (existing) {
        const err = new Error('Email is already registered');
        err.status = 409;
        throw err;
    }
    // Hash password for local auth table
    const hashedPassword = await bcryptjs_1.default.hash(input.password, env_1.config.BCRYPT_SALT_ROUNDS);
    // Create Supabase Auth user (unverified by default)
    const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: false,
        user_metadata: {
            first_name: firstName,
            last_name: lastName,
            phone: input.phone ?? null,
        },
    });
    let authUser = authData?.user ?? null;
    if (authError || !authUser) {
        const { data: usersList, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
        });
        if (listError) {
            throw new Error(authError?.message ?? listError.message ?? 'Failed to create user account');
        }
        authUser = usersList?.users?.find((u) => u.email === email) ?? null;
    }
    if (!authUser) {
        throw new Error(authError?.message ?? 'Failed to create user account');
    }
    const { data: existingProfile, error: existingProfileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    if (existingProfileError) {
        throw new Error(`User lookup failed: ${existingProfileError.message}`);
    }
    if (!existingProfile) {
        const now = new Date().toISOString();
        const { error: userInsertError } = await supabase_1.supabaseAdmin.from('users').insert({
            id: authUser.id,
            name: `${firstName} ${lastName}`.trim(),
            email,
            phone: input.phone ?? null,
            password_hash: hashedPassword,
            role: 'customer',
            created_by_restaurant: false,
            is_active: true,
            force_password_change: false,
            created_at: now,
            updated_at: now,
        });
        if (userInsertError) {
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => { });
            throw new Error(`User creation failed: ${userInsertError.message}`);
        }
    }
    // Send OTP for optional email verification (non-blocking)
    try {
        const otp = (0, otp_1.generateOTP)();
        await (0, otp_1.storeOTP)(email, otp, env_1.config.OTP_EXPIRY_SECONDS);
        (0, send_1.sendEmail)({
            to: email,
            templateName: 'otp-verify',
            data: { name: firstName, otp, expiryMinutes: Math.floor(env_1.config.OTP_EXPIRY_SECONDS / 60) },
        });
        console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
    catch (otpErr) {
        console.warn('[auth] failed to send verification OTP:', otpErr);
    }
    const tokenPayload = { sub: authUser.id, email, role: 'customer' };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    await redis_1.redis.set(refreshTokenKey(authUser.id), refreshToken, 'EX', 7 * 24 * 60 * 60);
    return { accessToken, refreshToken, verification_pending: true };
}
/** Verify OTP to mark the email as verified (account already exists). */
async function verifyOtp(input) {
    const email = input.email.toLowerCase().trim();
    try {
        await (0, otp_1.verifyOTP)(email, input.otp);
    }
    catch (err) {
        throw mapOtpError(err);
    }
    // Legacy fallback: complete pending signup if it exists
    const raw = await redis_1.redis.get(`pending_signup:${email}`);
    if (raw) {
        const pending = JSON.parse(raw);
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email: pending.email,
            email_confirm: true,
            user_metadata: {
                first_name: pending.firstName,
                last_name: pending.lastName,
                phone: pending.phone,
            },
        });
        let authUser = authData?.user ?? null;
        if (authError || !authUser) {
            const { data: usersList, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
            });
            if (listError) {
                throw new Error(authError?.message ?? listError.message ?? 'Failed to create user account');
            }
            authUser = usersList?.users?.find((u) => u.email === pending.email) ?? null;
        }
        if (!authUser) {
            throw new Error(authError?.message ?? 'Failed to create user account');
        }
        const { data: existingUser, error: existingUserError } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', pending.email)
            .maybeSingle();
        if (existingUserError) {
            throw new Error(`User lookup failed: ${existingUserError.message}`);
        }
        if (!existingUser) {
            const now = new Date().toISOString();
            const { error: userInsertError } = await supabase_1.supabaseAdmin.from('users').insert({
                id: authUser.id,
                name: `${pending.firstName} ${pending.lastName}`.trim(),
                email: pending.email,
                phone: pending.phone,
                password_hash: pending.hashedPassword,
                role: 'customer',
                created_by_restaurant: false,
                is_active: true,
                force_password_change: false,
                created_at: now,
                updated_at: now,
            });
            if (userInsertError) {
                throw new Error(`User creation failed: ${userInsertError.message}`);
            }
        }
        await (0, otp_1.deleteOTP)(email);
        await redis_1.redis.del(`pending_signup:${email}`);
        const tokenPayload = { sub: authUser.id, email: pending.email, role: 'customer' };
        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);
        await redis_1.redis.set(refreshTokenKey(authUser.id), refreshToken, 'EX', 7 * 24 * 60 * 60);
        return { accessToken, refreshToken };
    }
    const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id, email, role, restaurant_id, branch_id')
        .eq('email', email)
        .maybeSingle();
    if (profileError) {
        throw new Error(`User lookup failed: ${profileError.message}`);
    }
    if (!profile) {
        const err = new Error('Account not found for verification');
        err.status = 404;
        throw err;
    }
    try {
        await supabase_1.supabaseAdmin.auth.admin.updateUserById(profile.id, {
            email_confirm: true,
        });
    }
    catch (updateErr) {
        console.warn('[auth] email confirm update failed:', updateErr);
    }
    await (0, otp_1.deleteOTP)(email);
    const tokenPayload = {
        sub: profile.id,
        email: profile.email,
        role: profile.role,
    };
    if (profile.restaurant_id)
        tokenPayload.restaurant_id = profile.restaurant_id;
    if (profile.branch_id)
        tokenPayload.branch_id = profile.branch_id;
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    await redis_1.redis.set(refreshTokenKey(profile.id), refreshToken, 'EX', 7 * 24 * 60 * 60);
    return { accessToken, refreshToken };
}
/** Login with email or username + password. */
async function login(input) {
    // BUG FIX: schema now accepts both `email` and `emailOrUsername`.
    // Normalise to a single identifier here.
    const identifier = (input.email ?? input.emailOrUsername ?? '').trim();
    const isEmail = identifier.includes('@');
    const normalizedIdentifier = isEmail ? identifier.toLowerCase() : identifier;
    const query = supabase_1.supabaseAdmin
        .from('users')
        // BUG FIX: added is_active to the select so we can reject disabled accounts
        // before issuing a token. Previously a disabled staff member could still log
        // in because is_active was never checked.
        .select('id, email, role, password_hash, restaurant_id, branch_id, is_active');
    const { data: profile, error: profileError } = isEmail
        ? await query.eq('email', normalizedIdentifier).maybeSingle()
        : await query.eq('username', normalizedIdentifier).maybeSingle();
    if (profileError || !profile) {
        const err = new Error('Invalid credentials');
        err.status = 401;
        throw err;
    }
    if (profile.is_active === false) {
        const err = new Error('Account is disabled. Please contact your manager.');
        err.status = 403;
        throw err;
    }
    // BUG FIX: password_hash can be null for users created without a local
    // password (e.g. via restaurants/register before this fix, or OAuth users).
    // bcrypt.compare(string, null) throws "Illegal arguments: string, object".
    if (!profile.password_hash) {
        const err = new Error('Invalid credentials');
        err.status = 401;
        throw err;
    }
    const passwordMatch = await bcryptjs_1.default.compare(input.password, profile.password_hash);
    if (!passwordMatch) {
        const err = new Error('Invalid credentials');
        err.status = 401;
        throw err;
    }
    const tokenPayload = {
        sub: profile.id,
        email: profile.email,
        role: profile.role,
    };
    if (profile.restaurant_id)
        tokenPayload.restaurant_id = profile.restaurant_id;
    if (profile.branch_id)
        tokenPayload.branch_id = profile.branch_id;
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    await redis_1.redis.set(refreshTokenKey(profile.id), refreshToken, 'EX', 7 * 24 * 60 * 60);
    return { accessToken, refreshToken };
}
/** Send a password-reset OTP (rate limited to 3 per hour per email). */
async function forgotPassword(input) {
    const rlKey = forgotPasswordRateLimitKey(input.email);
    const attempts = await redis_1.redis.incr(rlKey);
    if (attempts === 1) {
        await redis_1.redis.expire(rlKey, 60 * 60); // 1 hour window
    }
    if (attempts > 3) {
        const err = new Error('Too many password reset requests. Try again in an hour.');
        err.status = 429;
        throw err;
    }
    const { data: profile } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id, name')
        .eq('email', input.email)
        .maybeSingle();
    if (profile) {
        const otp = (0, otp_1.generateOTP)();
        await (0, otp_1.storeOTP)(input.email, otp, env_1.config.OTP_EXPIRY_SECONDS);
        (0, send_1.sendEmail)({
            to: input.email,
            templateName: 'otp-verify',
            data: { name: profile.name ?? 'User', otp, expiryMinutes: Math.floor(env_1.config.OTP_EXPIRY_SECONDS / 60) },
        });
        console.log(`[DEV] Password reset OTP for ${input.email}: ${otp}`);
    }
    return { message: 'If that email exists, a reset OTP has been sent.' };
}
/** Send a verification OTP so users can verify their email later. */
async function sendVerificationOtp(input) {
    const email = input.email.toLowerCase().trim();
    const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id, name')
        .eq('email', email)
        .maybeSingle();
    if (profileError) {
        throw new Error(`Email lookup failed: ${profileError.message}`);
    }
    if (!profile) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
    }
    const otp = (0, otp_1.generateOTP)();
    await (0, otp_1.storeOTP)(email, otp, env_1.config.OTP_EXPIRY_SECONDS);
    (0, send_1.sendEmail)({
        to: email,
        templateName: 'otp-verify',
        data: {
            name: profile.name ?? 'User',
            otp,
            expiryMinutes: Math.floor(env_1.config.OTP_EXPIRY_SECONDS / 60),
        },
    });
    console.log(`[DEV] Verification OTP for ${email}: ${otp}`);
    return { message: 'Verification OTP sent.' };
}
/** Verify OTP and set new password, then invalidate all sessions. */
async function resetPassword(input) {
    const email = input.email.toLowerCase().trim();
    try {
        await (0, otp_1.verifyOTP)(email, input.otp);
    }
    catch (err) {
        throw mapOtpError(err);
    }
    const { data: profile } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    if (!profile) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }
    const hashedPassword = await bcryptjs_1.default.hash(input.newPassword, env_1.config.BCRYPT_SALT_ROUNDS);
    const { error: passwordError } = await supabase_1.supabaseAdmin
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', profile.id);
    if (passwordError) {
        throw new Error(`Password update failed: ${passwordError.message}`);
    }
    await supabase_1.supabaseAdmin.auth.admin.signOut(profile.id);
    await redis_1.redis.del(refreshTokenKey(profile.id));
    await (0, otp_1.deleteOTP)(input.email);
    return { message: 'Password reset successfully. Please log in again.' };
}
/** Change password for authenticated users and clear first-login flag. */
async function changePassword(userId, input) {
    if (!userId) {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
    }
    const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
        .from('users')
        .select('id, password_hash')
        .eq('id', userId)
        .maybeSingle();
    if (profileError || !profile) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }
    if (!profile.password_hash) {
        const err = new Error('Password not set for this account');
        err.status = 409;
        throw err;
    }
    const passwordMatch = await bcryptjs_1.default.compare(input.currentPassword, profile.password_hash);
    if (!passwordMatch) {
        const err = new Error('Current password is incorrect');
        err.status = 401;
        throw err;
    }
    if (input.currentPassword === input.newPassword) {
        const err = new Error('New password must be different from the current password');
        err.status = 422;
        throw err;
    }
    const hashedPassword = await bcryptjs_1.default.hash(input.newPassword, env_1.config.BCRYPT_SALT_ROUNDS);
    const { error: updateError } = await supabase_1.supabaseAdmin
        .from('users')
        .update({
        password_hash: hashedPassword,
        force_password_change: false,
        updated_at: new Date().toISOString(),
    })
        .eq('id', userId);
    if (updateError) {
        throw new Error(`Password update failed: ${updateError.message}`);
    }
    return { message: 'Password updated successfully.' };
}
/** Issue a new access token from a valid refresh token. */
async function refreshToken(input) {
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(input.refreshToken, env_1.config.SUPABASE_JWT_SECRET);
    }
    catch {
        const err = new Error('Invalid or expired refresh token');
        err.status = 401;
        throw err;
    }
    const userId = decoded.sub;
    const stored = await redis_1.redis.get(refreshTokenKey(userId));
    if (!stored || stored !== input.refreshToken) {
        const err = new Error('Refresh token has been revoked');
        err.status = 401;
        throw err;
    }
    const accessToken = signAccessToken({
        sub: userId,
        email: decoded.email,
        role: decoded.role,
        restaurant_id: decoded.restaurant_id,
        branch_id: decoded.branch_id,
    });
    return { accessToken };
}
/** Revoke the user's refresh token (logout). */
async function logout(userId) {
    await redis_1.redis.del(refreshTokenKey(userId));
}
//# sourceMappingURL=auth.service.js.map