import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as customerPreferencesService from './customer-preferences.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPreferencesService.list();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPreferencesService.create(req.body);
    res.status(201).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPreferencesService.getById(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPreferencesService.update(req.params.id, req.body);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await customerPreferencesService.remove(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}
