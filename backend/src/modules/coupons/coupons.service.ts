import { redis } from '../../config/redis';
import { supabaseAdmin } from '../../config/supabase';
import { CreateCouponInput, ValidateCouponInput } from './coupons.schema';
import { parsePagination } from '../../utils/pagination';

interface CouponRow {
  id: string;
  restaurant_id: string;
  code: string;
  discount_type: 'percent' | 'fixed' | string;
  discount_value: number | string;
  min_order_amount: number | string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface CouponValidationResult {
  valid: boolean;
  discount_amount: number;
  coupon_id: string;
  error_code?: string;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function couponError(message: string, statusCode = 422, errorCode = 'COUPON_INVALID'): never {
  throw Object.assign(new Error(message), { statusCode, errorCode });
}

async function getCouponByCode(code: string, restaurantId: string): Promise<CouponRow | null> {
  const normalized = normalizeCode(code);

  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('id, restaurant_id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at')
    .eq('code', normalized)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as CouponRow | null) ?? null;
}

export async function createCoupon(data: CreateCouponInput, restaurantId: string, createdBy?: string) {
  const existing = await getCouponByCode(data.code, restaurantId);

  if (existing) {
    couponError('Coupon code already exists for this restaurant', 409, 'COUPON_EXISTS');
  }

  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .insert({
      restaurant_id: restaurantId,
      code: normalizeCode(data.code),
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order_amount: data.min_order_amount ?? 0,
      max_uses: data.max_uses ?? null,
      expires_at: data.expires_at ?? null,
      is_active: data.is_active,
    })
    .select('id, restaurant_id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at')
    .single();

  if (error || !coupon) throw error ?? new Error('Failed to create coupon');

  return coupon;
}

export async function validateCoupon(
  code: string,
  orderId: string,
  orderAmount: number,
  orderType: string,
  userId: string,
  restaurantId: string,
): Promise<CouponValidationResult> {
  const coupon = await getCouponByCode(code, restaurantId);

  if (!coupon) {
    couponError('Coupon not found', 404, 'COUPON_NOT_FOUND');
  }

  if (!coupon.is_active) {
    couponError('Coupon is inactive', 422, 'COUPON_INACTIVE');
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    couponError('Coupon has expired', 422, 'COUPON_EXPIRED');
  }

  if (coupon.max_uses !== null && Number(coupon.used_count) >= Number(coupon.max_uses)) {
    couponError('Coupon has been exhausted', 422, 'COUPON_EXHAUSTED');
  }

  const minimumOrder = coupon.min_order_amount === null ? 0 : Number(coupon.min_order_amount);
  if (orderAmount < minimumOrder) {
    couponError(`Minimum order amount of ${minimumOrder} required`, 422, 'MINIMUM_NOT_MET');
  }

  const discountValue = Number(coupon.discount_value);
  const discountType = String(coupon.discount_type).toLowerCase();
  const discountAmount = money(
    Math.min(
      discountType === 'percent' || discountType === 'percentage'
        ? (discountValue / 100) * orderAmount
        : discountValue,
      orderAmount,
    ),
  );

  return {
    valid: true,
    discount_amount: discountAmount,
    coupon_id: coupon.id,
  };
}

export async function redeemCoupon(couponId: string, userId: string, orderId: string): Promise<void> {
  const usedKey = `coupon_used:${couponId}:${userId}`;
  const alreadyUsed = await redis.get(usedKey);

  if (alreadyUsed) {
    return;
  }

  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('used_count, max_uses')
    .eq('id', couponId)
    .maybeSingle();

  if (error) throw error;
  if (!coupon) throw Object.assign(new Error('Coupon not found'), { statusCode: 404 });

  const nextCount = Number(coupon.used_count ?? 0) + 1;

  const { error: updateError } = await supabaseAdmin
    .from('coupons')
    .update({ used_count: nextCount })
    .eq('id', couponId);

  if (updateError) throw updateError;

  await redis.set(usedKey, JSON.stringify({ couponId, userId, orderId, redeemed_at: new Date().toISOString() }));
}

export async function listCoupons(restaurantId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('coupons')
    .select('id, restaurant_id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at', {
      count: 'exact',
    })
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data ?? []).map((coupon: CouponRow) => ({
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      min_order_amount: coupon.min_order_amount === null ? null : Number(coupon.min_order_amount),
      max_uses: coupon.max_uses,
      used_count: coupon.used_count,
      expires_at: coupon.expires_at,
      is_active: coupon.is_active,
      created_at: coupon.created_at,
    })),
    total: count ?? 0,
    page,
    limit,
  };
}

export async function toggleCoupon(couponId: string, restaurantId: string) {
  const { data: coupon, error: fetchError } = await supabaseAdmin
    .from('coupons')
    .select('id, is_active')
    .eq('id', couponId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!coupon) throw Object.assign(new Error('Coupon not found'), { statusCode: 404 });

  const { data, error } = await supabaseAdmin
    .from('coupons')
    .update({ is_active: !coupon.is_active })
    .eq('id', couponId)
    .eq('restaurant_id', restaurantId)
    .select('id, is_active')
    .single();

  if (error || !data) throw error ?? new Error('Failed to toggle coupon');

  return data;
}