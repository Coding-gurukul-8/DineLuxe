import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { parsePagination } from '../../utils/pagination';
import {
  assignDelivery,
  getDelivery,
  updateDeliveryStatus,
  updatePartnerLocation,
  getActiveDelivery,
  getPartnerEarnings,
  getDeliveryStatus,
  getActiveDeliveriesForBranch,
  completeDelivery,
  updatePartnerOnlineStatus,
  getPartnerHistory,
  getPartnerStats,
} from './delivery.service';

export async function handleAssignDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await assignDelivery(
      req.params.orderId,
      req.branchId!,
      req.restaurantId!,
      req.body.partner_id,
    );
    res.status(201).json(success(delivery, 'Delivery assigned'));
  } catch (err) {
    next(err);
  }
}

export async function handleGetDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await getDelivery(req.params.id, req.user!.id);
    res.json(success(delivery));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateDeliveryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await updateDeliveryStatus(req.params.id, req.user!.id, req.body.status);
    res.json(success(delivery, 'Status updated'));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updatePartnerLocation(
      req.user!.id,
      req.body.lat,
      req.body.lon,
      req.body.delivery_id,
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function handleGetActiveDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await getActiveDelivery(req.user!.id);
    res.json(success(delivery));
  } catch (err) {
    next(err);
  }
}

export async function handleGetEarnings(req: Request, res: Response, next: NextFunction) {
  try {
    const earnings = await getPartnerEarnings(req.user!.id);
    res.json(success(earnings));
  } catch (err) {
    next(err);
  }
}

export async function handleGetDeliveryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getDeliveryStatus(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function handleGetActiveDeliveriesForBranch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getActiveDeliveriesForBranch(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function handleCompleteDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await completeDelivery(req.params.id);
    res.json(success(data, 'Delivery completed'));
  } catch (err) {
    next(err);
  }
}

// ── FIX 2: Partner online/offline toggle ──────────────────────────────────────

export async function handleUpdatePartnerStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await updatePartnerOnlineStatus(req.user!.id, req.body.is_online);
    res.json(success(result, `Partner is now ${result.is_online ? 'online' : 'offline'}`));
  } catch (err) {
    next(err);
  }
}

// ── FIX 3: Partner history + stats ───────────────────────────────────────────

export async function handleGetPartnerHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(
      req.query as Record<string, string | undefined>,
    );
    const result = await getPartnerHistory(req.user!.id, page, limit);
    res.json(success({ deliveries: result.deliveries, stats: result.stats }, result.meta));
  } catch (err) {
    next(err);
  }
}

export async function handleGetPartnerStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getPartnerStats(req.user!.id);
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}