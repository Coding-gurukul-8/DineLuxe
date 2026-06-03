export const RESTAURANT_GST_RATE = 0.05;
export const DELIVERY_GST_RATE = 0.05;
export const CGST_RATE = 0.025;
export const SGST_RATE = 0.025;
export const SERVICE_CHARGE_RATE = 0.1;

export type OrderType = 'dine_in' | 'delivery' | 'takeaway';

export interface BillBreakdownLine {
  label: string;
  amount: number;
  is_deduction?: boolean;
}

export interface BillBreakdown {
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  gst_total: number;
  service_charge: number;
  grand_total: number;
  breakdown_lines: BillBreakdownLine[];
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateBill(
  subtotal: number,
  options: {
    order_type: OrderType;
    apply_service_charge: boolean;
    service_charge_rate?: number;
    discount_amount?: number;
    gst_rate?: number;
  },
): BillBreakdown {
  const discountAmount = roundMoney(Math.max(0, options.discount_amount ?? 0));
  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));

  // Default behavior for this app:
  // - Non-delivery: 5% split into CGST+SGST
  // - Delivery: requirement says delivery should be higher, but doc provided
  //   RESTAURANT_GST_RATE=0.05 and DELIVERY_GST_RATE=0.05.
  // Keep this app-consistent and allow overrides via options.gst_rate.
  const gstRate = roundMoney(options.gst_rate ?? (options.order_type === 'delivery' ? DELIVERY_GST_RATE : RESTAURANT_GST_RATE));

  // If gstRate differs from 5%, keep proportional split.
  const splitHalf = gstRate / 2;
  const cgst = roundMoney(taxableAmount * splitHalf);
  const sgst = roundMoney(taxableAmount * splitHalf);
  const gstTotal = roundMoney(cgst + sgst);

  const serviceChargeRate = options.apply_service_charge
    ? (options.service_charge_rate ?? SERVICE_CHARGE_RATE)
    : 0;
  const serviceCharge = roundMoney(subtotal * serviceChargeRate);

  const grandTotal = roundMoney(taxableAmount + gstTotal + serviceCharge);

  const lines: BillBreakdownLine[] = [{ label: 'Subtotal', amount: roundMoney(subtotal) }];
  if (discountAmount > 0) {
    lines.push({ label: 'Discount', amount: -discountAmount, is_deduction: true });
  }

  lines.push({ label: `CGST (${(splitHalf * 100).toFixed(2)}%)`, amount: cgst });
  lines.push({ label: `SGST (${(splitHalf * 100).toFixed(2)}%)`, amount: sgst });

  if (serviceCharge > 0) {
    lines.push({ label: `Service Charge (${(serviceChargeRate * 100).toFixed(0)}%)`, amount: serviceCharge });
  }

  lines.push({ label: 'Grand Total', amount: grandTotal });

  return {
    subtotal: roundMoney(subtotal),
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    cgst,
    sgst,
    gst_total: gstTotal,
    service_charge: serviceCharge,
    grand_total: grandTotal,
    breakdown_lines: lines,
  };
}

