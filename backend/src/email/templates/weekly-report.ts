interface WeeklyReportData {
  totalRevenue: number;
  totalOrders: number;
  topDish: string;
  avgRating: number;
  growthPct: number;
}

function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function trendArrow(pct: number): string {
  if (pct > 0)  return `<span style="color:#16a34a;font-weight:700;">▲ +${pct.toFixed(1)}%</span>`;
  if (pct < 0)  return `<span style="color:#dc2626;font-weight:700;">▼ ${pct.toFixed(1)}%</span>`;
  return `<span style="color:#6b7280;font-weight:600;">→ 0%</span>`;
}

function ratingStars(rating: number): string {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export function weeklyReportEmail(
  ownerName: string,
  restaurantName: string,
  reportData: WeeklyReportData,
  reportUrl: string,
): { subject: string; html: string } {
  const { totalRevenue, totalOrders, topDish, avgRating, growthPct } = reportData;

  const weekEndDate   = new Date();
  const weekStartDate = new Date(weekEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange     = `${weekStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const isPositiveGrowth = growthPct >= 0;

  const metricCard = (
    emoji: string,
    label: string,
    value: string,
    sub: string,
    accent = false,
  ) => `
    <td width="50%" style="padding:8px;">
      <div style="background:${accent ? 'linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%)' : '#f9fafb'};border:1px solid ${accent ? 'transparent' : '#e5e7eb'};border-radius:10px;padding:18px 16px;text-align:center;">
        <p style="margin:0 0 6px;font-size:22px;">${emoji}</p>
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:${accent ? 'rgba(255,255,255,0.70)' : '#9ca3af'};">
          ${label}
        </p>
        <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:${accent ? '#ffffff' : '#111827'};letter-spacing:-0.5px;">
          ${value}
        </p>
        <p style="margin:0;font-size:12px;color:${accent ? 'rgba(255,255,255,0.65)' : '#6b7280'};">
          ${sub}
        </p>
      </div>
    </td>`;

  return {
    subject: `${restaurantName} — Weekly Performance Report`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weekly Report — ${restaurantName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A3C5E 0%,#2d6a9f 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:36px;">📊</p>
            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
              Weekly Performance Report
            </h1>
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.80);font-size:14px;">
              ${restaurantName}
            </p>
            <span style="display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.90);font-size:12px;font-weight:500;padding:4px 12px;border-radius:20px;">
              📅 ${dateRange}
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Hi <strong>${ownerName}</strong>, here's how <strong style="color:#1A3C5E;">${restaurantName}</strong> performed this week.
            </p>

            <!-- Growth Banner -->
            <div style="background:${isPositiveGrowth ? '#f0fdf4' : '#fef2f2'};border:1.5px solid ${isPositiveGrowth ? '#bbf7d0' : '#fecaca'};border-radius:10px;padding:14px 20px;margin-bottom:24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:${isPositiveGrowth ? '#166534' : '#991b1b'};">
                ${isPositiveGrowth ? '🚀' : '📉'}
                Week-over-week growth: ${trendArrow(growthPct)}
                ${isPositiveGrowth ? '— Great work, keep it up!' : '— Let\'s dig into what happened.'}
              </p>
            </div>

            <!-- Metrics Grid (2×2) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                ${metricCard('💰', 'Total Revenue', formatINR(totalRevenue), trendArrow(growthPct), true)}
                ${metricCard('🛒', 'Total Orders', `${totalOrders}`, `Avg ${formatINR(avgOrderValue)} / order`)}
              </tr>
              <tr>
                ${metricCard('⭐', 'Avg Rating', avgRating.toFixed(1), ratingStars(avgRating))}
                ${metricCard('🍽️', 'Top Dish', topDish.length > 16 ? topDish.slice(0, 14) + '…' : topDish, 'Most ordered this week')}
              </tr>
            </table>

            <!-- Summary Table -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:0;margin:20px 0 28px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:12px 20px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">
                      Metric
                    </th>
                    <th style="padding:12px 20px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">
                      This Week
                    </th>
                    <th style="padding:12px 20px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.6px;">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:13px 20px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">💰 Revenue</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">${formatINR(totalRevenue)}</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;border-top:1px solid #e5e7eb;">${trendArrow(growthPct)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 20px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">🛒 Orders</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">${totalOrders.toLocaleString('en-IN')}</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;border-top:1px solid #e5e7eb;">${trendArrow(growthPct)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 20px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">💵 Avg Order Value</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">${formatINR(avgOrderValue)}</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;border-top:1px solid #e5e7eb;">—</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 20px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">⭐ Avg Rating</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">${avgRating.toFixed(1)} / 5.0</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;border-top:1px solid #e5e7eb;">—</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 20px;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">🍽️ Top Dish</td>
                    <td style="padding:13px 20px;text-align:right;font-size:13px;font-weight:700;color:#E8A020;border-top:1px solid #e5e7eb;" colspan="2">${topDish}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#E8A020;border-radius:8px;text-align:center;">
                  <a href="${reportUrl}"
                     style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    View Full Report →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A3C5E;letter-spacing:0.3px;">
              DineLuxe
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} Restaurant OS · Weekly reports are sent every Monday
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