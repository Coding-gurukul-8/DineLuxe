import { Request, Response, NextFunction } from 'express';
import { buildPaginationMeta } from '../../utils/pagination';
import { success, error } from '../../utils/response';
import * as couponsService from './coupons.service';

function resolveRestaurantId(req: Request): string {
  return req.restaurantId ?? req.user?.restaurant_id ?? '';
}

export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req);
    if (!restaurantId) return res.status(400).json(error('Missing restaurant context'));

    const data = await couponsService.createCoupon(req.body, restaurantId, req.user?.id);
    res.status(201).json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req);
    if (!restaurantId) return res.status(400).json(error('Missing restaurant context'));

    const data = await couponsService.validateCoupon(
      req.body.code,
      '',
      req.body.order_amount,
      req.body.order_type,
      req.user?.id ?? '',
      restaurantId,
    );
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function redeemCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req);
    if (!restaurantId) return res.status(400).json(error('Missing restaurant context'));

    await couponsService.redeemCoupon(req.params.id, req.user?.id ?? '', req.body.order_id ?? '');
    res.json(success({ redeemed: true }));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function listCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req);
    if (!restaurantId) return res.status(400).json(error('Missing restaurant context'));

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await couponsService.listCoupons(restaurantId, page, limit);
    res.json(success(result.data, buildPaginationMeta(result.total, result.page, result.limit)));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function toggleCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = resolveRestaurantId(req);
    if (!restaurantId) return res.status(400).json(error('Missing restaurant context'));

    const data = await couponsService.toggleCoupon(req.params.id, restaurantId);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}