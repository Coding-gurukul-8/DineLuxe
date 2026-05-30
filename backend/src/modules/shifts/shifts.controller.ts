import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as shiftsService from './shifts.service';

// ---------------------------------------------------------------------------
// Local type alias — matches the express augmentation in types/express.d.ts
// ---------------------------------------------------------------------------
type AuthRequest = Request & {
  user: { id: string; role: string; branch_id?: string; restaurant_id?: string };
  restaurantId: string;
  branchId: string;
};

// ---------------------------------------------------------------------------
// GET /shifts?branch_id=&week_start=&staff_id=
// Also mounted as GET /staff/shifts (same handler, same query params)
// ---------------------------------------------------------------------------
export async function getWeeklyShifts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const { branch_id, week_start, staff_id } = req.query as {
      branch_id: string;
      week_start: string;
      staff_id?: string;
    };

    const data = await shiftsService.getShiftsForWeek(
      branch_id,
      week_start,
      authReq.restaurantId,
      staff_id,
    );

    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /shifts
// body: { branch_id, staff_id, date, start_time, end_time, notes? }
// ---------------------------------------------------------------------------
export async function createShift(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;

    const shift = await shiftsService.createShift(
      req.body,
      authReq.user.id,
      authReq.restaurantId,
    );

    res.status(201).json(success(shift, 'Shift created successfully'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /staff/:staffId/shifts
// body: { date, start_time, end_time, notes? }
// staff_id comes from URL param; branch_id from JWT (req.branchId)
// ---------------------------------------------------------------------------
export async function createShiftForStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;

    const shift = await shiftsService.createShiftForStaff(
      req.params.staffId,
      req.body,
      authReq.user.id,
      authReq.branchId,
      authReq.restaurantId,
    );

    res.status(201).json(success(shift, 'Shift created successfully'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /shifts/:id
// body: { start_time?, end_time?, notes? }
// ---------------------------------------------------------------------------
export async function updateShift(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;

    const shift = await shiftsService.updateShift(
      req.params.id,
      req.body,
      authReq.restaurantId,
    );

    res.json(success(shift, 'Shift updated successfully'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /shifts/:id
// ---------------------------------------------------------------------------
export async function deleteShift(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;

    const result = await shiftsService.deleteShift(
      req.params.id,
      authReq.restaurantId,
    );

    res.json(success(result, 'Shift deleted successfully'));
  } catch (err) {
    next(err);
  }
}