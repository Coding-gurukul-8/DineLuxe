import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as chatbotService from './chatbot.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await chatbotService.list();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await chatbotService.create(req.body);
    res.status(201).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await chatbotService.getById(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await chatbotService.update(req.params.id, req.body);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await chatbotService.remove(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}
