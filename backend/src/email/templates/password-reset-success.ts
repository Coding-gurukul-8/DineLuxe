export function passwordResetSuccessEmail(
  userName: string,
  loginUrl: string,
): { subject: string; html: string } {
  const changedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return {
    subject: 'Your password has been changed',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Changed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:40px;">🔒</p>
            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;">
              Password Changed Successfully
            </h1>
            <p style="margin:0;color:rgba(255,255,255,0.80);font-size:13px;">
              Restaurant OS Security Alert
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">
              Hi ${userName},
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Your Restaurant OS account password was successfully changed. You can now
              use your new password to log in.
            </p>

            <!-- Success Confirmation Card -->
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:13px;color:#6b7280;">Status</span>
                  </td>
                  <td style="padding:6px 0;text-align:right;">
                    <span style="display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">
                      ✅ Confirmed
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #dcfce7;">
                    <span style="font-size:13px;color:#6b7280;">Changed at</span>
                  </td>
                  <td style="padding:6px 0;border-top:1px solid #dcfce7;text-align:right;">
                    <span style="font-size:13px;font-weight:600;color:#111827;">${changedAt}</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:#E8A020;border-radius:8px;text-align:center;">
                  <a href="${loginUrl}"
                     style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    Log In Now →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Security Warning -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 18px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#991b1b;">
                ⚠️ Didn't make this change?
              </p>
              <p style="margin:0;font-size:13px;color:#b91c1c;line-height:1.5;">
                If you did not change your password, your account may be compromised.
                Please contact our support team immediately at
                <a href="mailto:support@restaurantos.app" style="color:#b91c1c;font-weight:600;">
                  support@restaurantos.app
                </a>
                or reset your password right away.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A3C5E;letter-spacing:0.3px;">
              DineLuxe
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} Restaurant OS · This is an automated security notification
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}