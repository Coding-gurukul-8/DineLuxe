import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as dynamicPricingService from './dynamic-pricing.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dynamicPricingService.list();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dynamicPricingService.create(req.body);
    res.status(201).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dynamicPricingService.getById(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dynamicPricingService.update(req.params.id, req.body);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dynamicPricingService.remove(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}
