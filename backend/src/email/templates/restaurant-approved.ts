interface RestaurantApprovedData {
  ownerName: string;
  restaurantName: string;
  dashboardUrl: string;
}

export function restaurantApprovedEmail(
  ownerName: string,
  restaurantName: string,
  dashboardUrl: string,
): { subject: string; html: string } {
  return {
    subject: `🎉 Your restaurant is approved on DineLuxe!`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your restaurant is approved!</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#E85D04 0%,#FAA307 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
              🍽️ DineLuxe
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Restaurant Management Platform</p>
          </td>
        </tr>

        <!-- Approval Badge -->
        <tr>
          <td style="padding:32px 40px 0;text-align:center;">
            <div style="display:inline-block;background:#ecfdf5;border:2px solid #10b981;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;text-align:center;">
              ✅
            </div>
            <h2 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;">You're approved!</h2>
            <p style="margin:0;font-size:15px;color:#6b7280;">
              Hi ${ownerName}, <strong>${restaurantName}</strong> is now live on DineLuxe.
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Congratulations! Your restaurant application has been reviewed and approved.
              You can now set up your menu, design your floor layout, and add your staff to
              start accepting orders and bookings.
            </p>

            <!-- Onboarding Checklist -->
            <div style="background:#f9fafb;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
                Getting Started Checklist
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#10b981;font-size:16px;margin-right:10px;">✅</span>
                    <span style="font-size:14px;color:#374151;font-weight:500;">Step 1: Set up your menu</span>
                    <span style="float:right;font-size:12px;color:#9ca3af;">Add dishes, categories & prices</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#10b981;font-size:16px;margin-right:10px;">✅</span>
                    <span style="font-size:14px;color:#374151;font-weight:500;">Step 2: Design floor layout</span>
                    <span style="float:right;font-size:12px;color:#9ca3af;">Configure tables & sections</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#10b981;font-size:16px;margin-right:10px;">✅</span>
                    <span style="font-size:14px;color:#374151;font-weight:500;">Step 3: Add staff</span>
                    <span style="float:right;font-size:12px;color:#9ca3af;">Invite waiters, chefs & managers</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:#E85D04;border-radius:8px;text-align:center;">
                  <a href="${dashboardUrl}"
                     style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                    Go to Your Dashboard →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;text-align:center;">
              Need help? Email us at
              <a href="mailto:support@dineluxe.app" style="color:#E85D04;text-decoration:none;">support@dineluxe.app</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} DineLuxe · All rights reserved
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