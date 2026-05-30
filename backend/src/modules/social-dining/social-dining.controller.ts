import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import * as socialDiningService from './social-dining.service';

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.createGroup(req.user!.id, req.body);
    res.status(201).json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function joinGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.joinGroup(req.user!.id, req.params.code);
    res.status(201).json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function getGroupForBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.getGroupForBooking(req.params.bookingId, req.user!.id);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function updatePreOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.updatePreOrders(req.user!.id, req.params.groupId, req.body);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function closeGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.closeGroup(req.user!.id, req.params.groupId);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function getGroupPreOrderSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.getGroupPreOrderSummary(req.params.groupId, req.user!.id);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

export async function getInviteTeaser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await socialDiningService.getInviteTeaser(req.params.code);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}