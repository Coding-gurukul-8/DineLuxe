import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { config } from '../../config/env';
import { generateOTP, storeOTP, verifyOTP, deleteOTP } from '../../utils/otp';
import { sendEmail } from '../../email/send';
import { sendOTPSMS } from '../../utils/sms';

import type {
  SignupInput,
  LoginInput,
  OtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  RefreshTokenInput,
  RequestOtpInput,
} from './auth.schema';

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.SUPABASE_JWT_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.SUPABASE_JWT_SECRET, { expiresIn: '7d' });
}

function refreshTokenKey(userId: string): string {
  return `refresh_token:${userId}`;
}

function forgotPasswordRateLimitKey(email: string): string {
  return `forgot_rl:${email}`;
}

function mapOtpError(err: unknown) {
  if (!(err instanceof Error)) return err;

  const raw = err.message ?? '';
  const [codePart, ...rest] = raw.split(':');
  const code = codePart?.trim();
  if (!code || !code.startsWith('OTP_')) return err;

  const message = rest.join(':').trim() || raw;
  const mapped = new Error(message) as Error & { status?: number; code?: string };
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
export async function signup(input: SignupInput): Promise<{
  accessToken: string;
  refreshToken: string;
  verification_pending: boolean;
}> {
  // BUG FIX: normalise firstName/lastName from the flexible schema.
  // Clients may send `name` (e.g. "John Doe") OR firstName + lastName separately.
  let firstName: string;
  let lastName: string;

  if (input.firstName) {
    firstName = input.firstName;
    lastName = input.lastName ?? '';
  } else {
    // Split `name` field into first / last
    const parts = (input.name ?? '').trim().split(' ').filter(Boolean);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }

  const email = input.email.toLowerCase().trim();

  // Check email uniqueness in profile table
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Email lookup failed: ${existingError.message}`);
  }

  if (existing) {
    const err = new Error('Email is already registered') as Error & { status: number };
    err.status = 409;
    throw err;
  }

  // Hash password for local auth table
  const hashedPassword = await bcrypt.hash(input.password, config.BCRYPT_SALT_ROUNDS);

  // Create Supabase Auth user (unverified by default)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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
    const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
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

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(`User lookup failed: ${existingProfileError.message}`);
  }

  if (!existingProfile) {
    const now = new Date().toISOString();
    const { error: userInsertError } = await supabaseAdmin.from('users').insert({
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
      await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
      throw new Error(`User creation failed: ${userInsertError.message}`);
    }
  }

  // Send OTP for optional email verification (non-blocking)
  try {
    const otp = generateOTP();
    await storeOTP(email, otp, config.OTP_EXPIRY_SECONDS);
    sendEmail({
      to: email,
      templateName: 'otp-verify',
      data: { name: firstName, otp, expiryMinutes: Math.floor(config.OTP_EXPIRY_SECONDS / 60) },
    });

    // SMS OTP (non-fatal)
    if (input.phone) {
      sendOTPSMS(input.phone, otp).catch((err) =>
        console.error('[sms] OTP send failed:', err),
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }
  } catch (otpErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] failed to send verification OTP:', otpErr);
    }
  }

  const tokenPayload = { sub: authUser.id, email, role: 'customer' };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await redis.set(refreshTokenKey(authUser.id), refreshToken, 'EX', 7 * 24 * 60 * 60);

  return { accessToken, refreshToken, verification_pending: true };
}

/** Verify OTP to mark the email as verified (account already exists). */
export async function verifyOtp(input: OtpInput): Promise<{ accessToken: string; refreshToken: string }> {
  const email = input.email.toLowerCase().trim();
  try {
    await verifyOTP(email, input.otp);
  } catch (err) {
    throw mapOtpError(err);
  }

  // Legacy fallback: complete pending signup if it exists
  const raw = await redis.get(`pending_signup:${email}`);
  if (raw) {
    const pending = JSON.parse(raw) as {
      email: string;
      phone: string | null;
      hashedPassword: string;
      firstName: string;
      lastName: string;
    };

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
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
      const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
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

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', pending.email)
      .maybeSingle();

    if (existingUserError) {
      throw new Error(`User lookup failed: ${existingUserError.message}`);
    }

    if (!existingUser) {
      const now = new Date().toISOString();
      const { error: userInsertError } = await supabaseAdmin.from('users').insert({
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

    await deleteOTP(email);
    await redis.del(`pending_signup:${email}`);

    const tokenPayload = { sub: authUser.id, email: pending.email, role: 'customer' };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await redis.set(refreshTokenKey(authUser.id), refreshToken, 'EX', 7 * 24 * 60 * 60);

    return { accessToken, refreshToken };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, role, restaurant_id, branch_id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    throw new Error(`User lookup failed: ${profileError.message}`);
  }

  if (!profile) {
    const err = new Error('Account not found for verification') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  try {
    await supabaseAdmin.auth.admin.updateUserById(profile.id as string, {
      email_confirm: true,
    });
  } catch (updateErr) {
    console.warn('[auth] email confirm update failed:', updateErr);
  }

  await deleteOTP(email);

  const tokenPayload: Record<string, unknown> = {
    sub: profile.id,
    email: profile.email,
    role: profile.role,
  };

  if (profile.restaurant_id) tokenPayload.restaurant_id = profile.restaurant_id;
  if (profile.branch_id) tokenPayload.branch_id = profile.branch_id;

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await redis.set(refreshTokenKey(profile.id as string), refreshToken, 'EX', 7 * 24 * 60 * 60);

  return { accessToken, refreshToken };
}

/** Login with email or username + password. */
export async function login(input: LoginInput): Promise<{ accessToken: string; refreshToken: string }> {
  // BUG FIX: schema now accepts both `email` and `emailOrUsername`.
  // Normalise to a single identifier here.
  const identifier = (input.email ?? input.emailOrUsername ?? '').trim();
  const isEmail = identifier.includes('@');
  const normalizedIdentifier = isEmail ? identifier.toLowerCase() : identifier;

  const query = supabaseAdmin
    .from('users')
    // BUG FIX: added is_active to the select so we can reject disabled accounts
    // before issuing a token. Previously a disabled staff member could still log
    // in because is_active was never checked.
    .select('id, email, role, password_hash, restaurant_id, branch_id, is_active');

  const { data: profile, error: profileError } = isEmail
    ? await query.eq('email', normalizedIdentifier).maybeSingle()
    : await query.eq('username', normalizedIdentifier).maybeSingle();

  if (profileError || !profile) {
    const err = new Error('Invalid credentials') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  if (profile.is_active === false) {
    const err = new Error('Account is disabled. Please contact your manager.') as Error & { status: number };
    err.status = 403;
    throw err;
  }

  // BUG FIX: password_hash can be null for users created without a local
  // password (e.g. via restaurants/register before this fix, or OAuth users).
  // bcrypt.compare(string, null) throws "Illegal arguments: string, object".
  if (!profile.password_hash) {
    const err = new Error('Invalid credentials') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(input.password, profile.password_hash as string);
  if (!passwordMatch) {
    const err = new Error('Invalid credentials') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const tokenPayload: Record<string, unknown> = {
    sub: profile.id,
    email: profile.email,
    role: profile.role,
  };

  if (profile.restaurant_id) tokenPayload.restaurant_id = profile.restaurant_id;
  if (profile.branch_id) tokenPayload.branch_id = profile.branch_id;

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await redis.set(refreshTokenKey(profile.id as string), refreshToken, 'EX', 7 * 24 * 60 * 60);

  return { accessToken, refreshToken };
}

/** Send a password-reset OTP (rate limited to 3 per hour per email). */
export async function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
  const rlKey = forgotPasswordRateLimitKey(input.email);
  const attempts = await redis.incr(rlKey);

  if (attempts === 1) {
    await redis.expire(rlKey, 60 * 60); // 1 hour window
  }

  if (attempts > 3) {
    const err = new Error('Too many password reset requests. Try again in an hour.') as Error & { status: number };
    err.status = 429;
    throw err;
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('email', input.email)
    .maybeSingle();

  if (profile) {
    const otp = generateOTP();
    await storeOTP(input.email, otp, config.OTP_EXPIRY_SECONDS);
    sendEmail({
      to: input.email,
      templateName: 'otp-verify',
      data: { name: (profile as any).name ?? 'User', otp, expiryMinutes: Math.floor(config.OTP_EXPIRY_SECONDS / 60) },
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset OTP for ${input.email}: ${otp}`);
    }
  }


  return { message: 'If that email exists, a reset OTP has been sent.' };
}

/** Send a verification OTP so users can verify their email later. */
export async function sendVerificationOtp(input: RequestOtpInput): Promise<{ message: string }> {
  const email = input.email.toLowerCase().trim();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Email lookup failed: ${profileError.message}`);
  }

  if (!profile) {
    const err = new Error('Account not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const otp = generateOTP();
  await storeOTP(email, otp, config.OTP_EXPIRY_SECONDS);

  sendEmail({
    to: email,
    templateName: 'otp-verify',
    data: {
      name: (profile as any).name ?? 'User',
      otp,
      expiryMinutes: Math.floor(config.OTP_EXPIRY_SECONDS / 60),
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Verification OTP for ${email}: ${otp}`);
  }


  return { message: 'Verification OTP sent.' };
}

/** Verify OTP and set new password, then invalidate all sessions. */
export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  const email = input.email.toLowerCase().trim();
  try {
    await verifyOTP(email, input.otp);
  } catch (err) {
    throw mapOtpError(err);
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    const err = new Error('User not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, config.BCRYPT_SALT_ROUNDS);

  const { error: passwordError } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hashedPassword })
    .eq('id', profile.id);

  if (passwordError) {
    throw new Error(`Password update failed: ${passwordError.message}`);
  }

  await supabaseAdmin.auth.admin.signOut(profile.id as string);
  await redis.del(refreshTokenKey(profile.id as string));
  await deleteOTP(input.email);

  return { message: 'Password reset successfully. Please log in again.' };
}

/** Change password for authenticated users and clear first-login flag. */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
  if (!userId) {
    const err = new Error('Unauthorized') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, password_hash')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    const err = new Error('User not found') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (!profile.password_hash) {
    const err = new Error('Password not set for this account') as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(input.currentPassword, profile.password_hash as string);
  if (!passwordMatch) {
    const err = new Error('Current password is incorrect') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  if (input.currentPassword === input.newPassword) {
    const err = new Error('New password must be different from the current password') as Error & { status: number };
    err.status = 422;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, config.BCRYPT_SALT_ROUNDS);

  const { error: updateError } = await supabaseAdmin
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
export async function refreshToken(input: RefreshTokenInput): Promise<{ accessToken: string }> {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(input.refreshToken, config.SUPABASE_JWT_SECRET) as jwt.JwtPayload;
  } catch {
    const err = new Error('Invalid or expired refresh token') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const userId = decoded.sub as string;
  const stored = await redis.get(refreshTokenKey(userId));

  if (!stored || stored !== input.refreshToken) {
    const err = new Error('Refresh token has been revoked') as Error & { status: number };
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
export async function logout(userId: string): Promise<void> {
  await redis.del(refreshTokenKey(userId));
}
