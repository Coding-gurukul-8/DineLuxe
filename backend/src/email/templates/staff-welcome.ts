export function staffWelcomeEmail(
  staffName: string,
  restaurantName: string,
  role: string,
  tempPassword: string,
  loginUrl: string,
): { subject: string; html: string } {
  const roleFormatted = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  return {
    subject: `Welcome to ${restaurantName} — Your Staff Account is Ready`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${restaurantName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:38px;">🍽️</p>
            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
              ${restaurantName}
            </h1>
            <p style="margin:0;color:rgba(255,255,255,0.80);font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">
              Staff Account Created
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">
              Welcome, ${staffName}! 👋
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              Your <strong style="color:#1A3C5E;">${roleFormatted}</strong> account at
              <strong style="color:#1A3C5E;">${restaurantName}</strong> has been created
              and is ready to use. Use the credentials below to sign in for the first time.
            </p>

            <!-- Credentials Box -->
            <div style="background:#f0f6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:24px 28px;margin-bottom:28px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#1A3C5E;text-transform:uppercase;letter-spacing:0.6px;">
                🔐 Your Login Credentials
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #dbeafe;">
                    <span style="font-size:13px;color:#6b7280;">Role</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #dbeafe;text-align:right;">
                    <span style="font-size:14px;font-weight:600;color:#111827;">${roleFormatted}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 4px;">
                    <span style="font-size:13px;color:#6b7280;">Temporary Password</span>
                  </td>
                  <td style="padding:12px 0 4px;text-align:right;">
                    <span style="display:inline-block;background:#1A3C5E;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:2px;padding:6px 14px;border-radius:6px;">
                      ${tempPassword}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Warning Banner -->
              <div style="margin-top:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:7px;padding:10px 14px;display:flex;align-items:center;">
                <p style="margin:0;font-size:13px;color:#c2410c;font-weight:500;">
                  ⚠️ You must change your password on first login. This temporary password expires after first use.
                </p>
              </div>
            </div>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#E8A020;border-radius:8px;text-align:center;">
                  <a href="${loginUrl}"
                     style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    Sign In Now →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Security Notice -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5;">
                🔒 <strong>Security notice:</strong> Do not share your password with anyone, including management.
                If you believe your account has been compromised, contact your branch manager immediately.
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
              © ${new Date().getFullYear()} Restaurant OS · Powered by DineLuxe
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