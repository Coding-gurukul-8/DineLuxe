import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as shiftsService from './shifts.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shiftsService.list();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shiftsService.create(req.body);
    res.status(201).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shiftsService.getById(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shiftsService.update(req.params.id, req.body);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shiftsService.remove(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}
