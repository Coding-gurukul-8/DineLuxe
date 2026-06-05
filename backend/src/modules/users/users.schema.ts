/**
 * backend/src/modules/users/users.schema.ts
 *
 * Zod validation schemas for the users module.
 *
 * GDPR additions:
 *   - deleteAccountSchema: optional confirmation string for DELETE /me.
 *     The service enforces the role guard; this schema is a UX safeguard so
 *     the client must send an explicit acknowledgement body.
 */

import { z } from 'zod';

// ─── Update Profile ───────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  first_name: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50)
    .optional(),

  last_name: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50)
    .optional(),

  phone: z
    .string()
    // BUG FIX: was bare Indian 10-digit regex ^[6-9]\d{9}$ but signup stores
    // phone in E.164 format (+919876543210). Accept both so PATCH /users/me
    // doesn't reject a number the user legitimately provided at signup.
    .regex(
      /^(\+[1-9]\d{7,14}|[6-9]\d{9})$/,
      'Phone must be a 10-digit Indian number or E.164 format (e.g. +919876543210)',
    )
    .optional(),

  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD')
    .optional(),

  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),

  avatar_url: z.string().url('Invalid avatar URL').optional(),

  address: z
    .object({
      line1:   z.string().max(100).optional(),
      line2:   z.string().max(100).optional(),
      city:    z.string().max(50).optional(),
      state:   z.string().max(50).optional(),
      pincode: z
        .string()
        .regex(/^\d{6}$/, 'Pincode must be 6 digits')
        .optional(),
    })
    .optional(),
});

// ─── Notification Preferences ─────────────────────────────────────────────────

export const notificationPreferencesSchema = z.object({
  email_new_orders:     z.boolean(),
  push_staff_actions:   z.boolean(),
  daily_sales_summary:  z.boolean(),
  low_inventory_alerts: z.boolean(),
  new_review_alerts:    z.boolean(),
});

// ─── Change Password ──────────────────────────────────────────────────────────

export const changePasswordSnakeSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'New password must contain at least one special character'),
  })
  .transform((data) => ({
    currentPassword: data.current_password,
    newPassword:     data.new_password,
  }));

// ─── GDPR: Delete Account Confirmation (M23) ──────────────────────────────────
//
// Requires the client to send an explicit acknowledgement so accidental
// taps / mis-clicks cannot trigger irreversible account deletion.
//
// Usage in routes.ts (optional — wire it in if you want body validation):
//   router.delete('/me', authenticate, validate(deleteAccountSchema), ctrl.anonymizeAccount);
//
// The service itself is the authoritative guard (role check + is_active check).
// This schema is an additional UX-level safeguard only.
// ─────────────────────────────────────────────────────────────────────────────

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .refine(
      (val) => val === 'DELETE MY ACCOUNT',
      'You must type "DELETE MY ACCOUNT" to confirm permanent deletion',
    ),
});

// ─── Exported types ───────────────────────────────────────────────────────────

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdateProfileInput           = z.infer<typeof updateProfileSchema>;
export type DeleteAccountInput           = z.infer<typeof deleteAccountSchema>;