export function restaurantRejectedEmail(
  ownerName: string,
  restaurantName: string,
  reason: string,
): { subject: string; html: string } {
  return {
    subject: `Update on your DineLuxe application`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Update on your DineLuxe application</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d5a8e 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
              🍽️ DineLuxe
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Restaurant Management Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;">
              Hi ${ownerName},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for applying to join DineLuxe with <strong>${restaurantName}</strong>.
              We've reviewed your application and, unfortunately, we are unable to approve it at this time.
            </p>

            <!-- Reason Box -->
            <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">
                Reason for Rejection
              </p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                ${reason}
              </p>
            </div>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              You may reapply after addressing the points mentioned above.
              If you have questions or need clarification, please don't hesitate to reach out.
            </p>

            <!-- Support CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:#1A3C5E;border-radius:8px;text-align:center;">
                  <a href="mailto:support@dineluxe.app"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                    Contact Support
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;text-align:center;">
              support@dineluxe.app · We typically respond within 24 hours
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