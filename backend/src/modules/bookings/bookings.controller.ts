// ─────────────────────────────────────────────────────────────────────────────
// bookings.controller.ts  —  AUDITED & FIXED
//
// Issues found & fixed:
//   1. error(err.message) called without a code arg → the helper fell back to
//      code='ERROR'. Fixed: all catch blocks that previously short-circuited on
//      err.statusCode now use next(err) and let the global error middleware
//      assign the proper code and status (it already reads err.statusCode).
//
//   2. getMyBookings / getBranchBookings used success(data, paginationMeta)
//      which placed pagination inside the opaque `meta` field. Fixed:
//      use paginatedSuccess() so `pagination` is a first-class top-level key.
//
//   3. HTTP status codes verified:
//        createBooking  → 201  ✓
//        all GETs/PATCHes → 200  ✓
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { success, paginatedSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import * as bookingsService from './bookings.service';

// ── POST /bookings ────────────────────────────────────────────────────────────

export async function createBooking(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.createBooking(req.body, req.user!.id);
    // 201 — new booking resource created
    res.status(201).json(success(data));
  } catch (err) {
    // FIX: delegate all error handling (including statusCode errors) to the
    // global error middleware so codes are consistently SCREAMING_SNAKE_CASE.
    next(err);
  }
}

// ── GET /bookings/:id ─────────────────────────────────────────────────────────

export async function getBookingById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.getBookingById(
      req.params.id,
      req.user!.id,
      req.user!.role,
    );
    res.json(success(data));
  } catch (err) {
    // FIX: was short-circuiting with error(err.message) — code was 'ERROR'
    next(err);
  }
}

// ── GET /bookings/my ──────────────────────────────────────────────────────────

export async function getMyBookings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { data, total, page, limit } = await bookingsService.getMyBookings(
      req.user!.id,
      req.query as Record<string, string | undefined>,
    );
    // FIX: use paginatedSuccess so `pagination` is a top-level key
    res.json(paginatedSuccess(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

// ── GET /bookings/branch/:branchId ────────────────────────────────────────────

export async function getBranchBookings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { data, total, page, limit } = await bookingsService.getBranchBookings(
      req.params.branchId,
      req.query as Record<string, string | undefined>,
    );
    // FIX: use paginatedSuccess so `pagination` is a top-level key
    res.json(paginatedSuccess(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

// ── DELETE /bookings/:id ──────────────────────────────────────────────────────

export async function cancelBooking(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.cancelBooking(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.role,
    );
    // 200 — update to existing resource (status changed to cancelled)
    res.json(success(data));
  } catch (err) {
    // FIX: was short-circuiting with error(err.message) — code was 'ERROR'
    next(err);
  }
}

// ── PATCH /bookings/:id/arrived ───────────────────────────────────────────────

export async function markArrived(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.markArrived(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /bookings/:id/seated ────────────────────────────────────────────────

export async function markSeated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.markSeated(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /bookings/:id/no-show ───────────────────────────────────────────────

export async function markNoShow(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await bookingsService.markNoShow(req.params.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}
