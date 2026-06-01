/**
 * backend/src/email/templates/report-ready.ts
 *
 * Email sent to the report requester when an async report-export job completes.
 * Used by: backend/src/jobs/report-export.ts → sendReadyEmail()
 * Registered in: backend/src/email/send.ts template registry
 *
 * Data shape:
 *   restaurantName : string   — e.g. "Spice Garden"
 *   reportType     : string   — e.g. "Sales Report"
 *   dateRange      : string   — e.g. "1 May 2025 – 31 May 2025"
 *   downloadUrl    : string   — pre-signed URL (valid 24 hours)
 *   format         : string   — "CSV" | "XLSX" | "PDF"
 */

export function reportReadyEmail(
  restaurantName: string,
  reportType: string,
  dateRange: string,
  downloadUrl: string,
  format: string,
): { subject: string; html: string } {
  const year = new Date().getFullYear();

  return {
    subject: `Your ${reportType} is ready — ${restaurantName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Report Ready — ${restaurantName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:28px;">📊</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
              Your report is ready
            </h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">
              ${restaurantName}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <!-- Report details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">
                        <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Report</span>
                      </td>
                      <td style="padding:6px 0;text-align:right;border-bottom:1px solid #e5e7eb;">
                        <span style="font-size:13px;font-weight:700;color:#111827;">${reportType}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                        <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Date Range</span>
                      </td>
                      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #e5e7eb;">
                        <span style="font-size:13px;color:#374151;">${dateRange}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0 0;">
                        <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Format</span>
                      </td>
                      <td style="padding:8px 0 0;text-align:right;">
                        <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.4px;">
                          ${format}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Download CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;width:100%;">
              <tr>
                <td align="center" style="background:#E8A020;border-radius:8px;">
                  <a href="${downloadUrl}"
                     style="display:block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:0.2px;">
                    ⬇&nbsp; Download ${format} Report
                  </a>
                </td>
              </tr>
            </table>

            <!-- Expiry notice -->
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
              This download link is valid for <strong style="color:#6b7280;">24 hours</strong>.<br />
              After that, please generate a new report from your dashboard.
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A3C5E;letter-spacing:0.3px;">
              DineLuxe
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${year} Restaurant OS · This is an automated notification
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
