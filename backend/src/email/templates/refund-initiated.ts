function formatINR(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function refundInitiatedEmail(
  customerName: string,
  orderId: string,
  amount: number,
  restaurantName: string,
  estimatedDays: number,
): { subject: string; html: string } {
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const initiatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const row = (icon: string, label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <span style="font-size:16px;margin-right:10px;">${icon}</span>
        <span style="font-size:13px;color:#6b7280;">${label}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
        <span style="font-size:14px;font-weight:600;color:${highlight ? '#E8A020' : '#111827'};">${value}</span>
      </td>
    </tr>`;

  return {
    subject: `Refund Initiated — ${formatINR(amount)} from ${restaurantName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Refund Initiated</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:38px;">💸</p>
            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;">
              Refund Initiated
            </h1>
            <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;">
              ${restaurantName}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">
              Hi ${customerName},
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              We've initiated a refund for your order at <strong style="color:#1A3C5E;">${restaurantName}</strong>.
              The amount will be returned to your original payment method within the estimated time below.
            </p>

            <!-- Refund Amount Highlight -->
            <div style="background:linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%);border:1.5px solid #fed7aa;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">
                Refund Amount
              </p>
              <p style="margin:0;font-size:36px;font-weight:800;color:#E8A020;letter-spacing:-1px;">
                ${formatINR(amount)}
              </p>
            </div>

            <!-- Details Card -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('🧾', 'Order ID', `#${shortOrderId}`)}
                ${row('🏪', 'Restaurant', restaurantName)}
                ${row('💰', 'Refund Amount', formatINR(amount), true)}
                ${row('📅', 'Initiated On', initiatedAt)}
                ${row('⏱️', 'Estimated Processing', `${estimatedDays}–${estimatedDays + 2} business days`)}
              </table>
            </div>

            <!-- Info Note -->
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                ℹ️ Refunds typically appear within <strong>${estimatedDays}–${estimatedDays + 2} business days</strong>
                depending on your bank or payment provider. If you don't see it after
                <strong>${estimatedDays + 3} days</strong>, please contact us at
                <a href="mailto:support@restaurantos.app" style="color:#1d4ed8;font-weight:600;">support@restaurantos.app</a>
                with your Order ID <strong>#${shortOrderId}</strong>.
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
              © ${new Date().getFullYear()} Restaurant OS · Refund Ref #${shortOrderId}
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