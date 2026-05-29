import type { SignupInput, LoginInput, OtpInput, ResetPasswordInput, ChangePasswordInput, ForgotPasswordInput, RefreshTokenInput, RequestOtpInput } from './auth.schema';
/**
 * Signup creates the account immediately and sends OTP for optional
 * email verification.
 */
export declare function signup(input: SignupInput): Promise<{
    accessToken: string;
    refreshToken: string;
    verification_pending: boolean;
}>;
/** Verify OTP to mark the email as verified (account already exists). */
export declare function verifyOtp(input: OtpInput): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
/** Login with email or username + password. */
export declare function login(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
/** Send a password-reset OTP (rate limited to 3 per hour per email). */
export declare function forgotPassword(input: ForgotPasswordInput): Promise<{
    message: string;
}>;
/** Send a verification OTP so users can verify their email later. */
export declare function sendVerificationOtp(input: RequestOtpInput): Promise<{
    message: string;
}>;
/** Verify OTP and set new password, then invalidate all sessions. */
export declare function resetPassword(input: ResetPasswordInput): Promise<{
    message: string;
}>;
/** Change password for authenticated users and clear first-login flag. */
export declare function changePassword(userId: string, input: ChangePasswordInput): Promise<{
    message: string;
}>;
/** Issue a new access token from a valid refresh token. */
export declare function refreshToken(input: RefreshTokenInput): Promise<{
    accessToken: string;
}>;
/** Revoke the user's refresh token (logout). */
export declare function logout(userId: string): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map