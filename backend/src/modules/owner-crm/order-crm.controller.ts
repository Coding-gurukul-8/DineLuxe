import { Request, Response, NextFunction } from 'express';
import * as ownerCrmService from './owner-crm.service';
import { success, error } from '../../utils/response';
import { parsePagination } from '../../utils/pagination';

// ─── List Restaurant Customers ───────────────────────────────────────────────
/**
 * GET /api/v1/owner/customers?search=&sort=visits|spend|last_visit&page=&limit=
 *
 * Privacy:
 *   - Owner  → full phone number is included in response
 *   - Manager → only masked phone (last 4 digits) is included
 */
export async function listRestaurantCustomers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurantId = req.restaurantId!;

    const { page, limit } = parsePagination(
      req.query as Record<string, string | undefined>,
    );

    const rawSort = req.query.sort as string | undefined;
    const validSorts = ['visits', 'spend', 'last_visit'] as const;
    type SortOption = (typeof validSorts)[number];
    const sort: SortOption = validSorts.includes(rawSort as SortOption)
      ? (rawSort as SortOption)
      : 'last_visit';

    const search = typeof req.query.search === 'string'
      ? req.query.search.trim() || undefined
      : undefined;

    const result = await ownerCrmService.listRestaurantCustomers(restaurantId, {
      search,
      sort,
      page,
      limit,
    });

    const isOwner = req.user?.role === 'owner';

    // Strip or expose phone based on role
    const customers = result.data.map((c: any) => {
      const { phone_full, phone_masked, ...rest } = c;
      return {
        ...rest,
        phone: isOwner ? (phone_full ?? phone_masked) : phone_masked,
      };
    });

    res.json(
      success({ customers, meta: result.meta }),
    );
  } catch (err) {
    next(err);
  }
}

// ─── Create Customer By Restaurant ──────────────────────────────────────────
/**
 * POST /api/v1/owner/customers/create-by-restaurant
 * Body: { name: string, phone: string }
 *
 * Creates a lightweight POS customer (no password / Supabase Auth user).
 * If a user with the same phone already exists, links them instead.
 */
export async function createCustomerByRestaurant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurantId = req.restaurantId!;
    const actorId      = req.user!.id;

    const { name, phone } = req.body as { name?: string; phone?: string };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json(error('VALIDATION_ERROR', 'name is required'));
      return;
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      res.status(400).json(error('VALIDATION_ERROR', 'phone is required'));
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string)
      ?? req.socket?.remoteAddress
      ?? undefined;

    const result = await ownerCrmService.createCustomerByRestaurant(
      restaurantId,
      name.trim(),
      phone.trim(),
      actorId,
      ipAddress,
    );

    const statusCode = result.is_existing ? 200 : 201;
    res.status(statusCode).json(success(result, result.message));
  } catch (err) {
    next(err);
  }
}

// ─── Get Customer History ────────────────────────────────────────────────────
/**
 * GET /api/v1/owner/customers/:id/history
 *
 * Returns visit history and spend summary for a specific customer,
 * strictly scoped to the requesting owner's restaurant.
 */
export async function getCustomerHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurantId = req.restaurantId!;
    const customerId   = req.params.id;

    if (!customerId) {
      res.status(400).json(error('VALIDATION_ERROR', 'Customer ID is required'));
      return;
    }

    const result = await ownerCrmService.getCustomerHistory(customerId, restaurantId);

    res.json(success(result));
  } catch (err: any) {
    // Surface 404s from the service as proper HTTP 404 responses
    if (err?.statusCode === 404) {
      res.status(404).json(error('NOT_FOUND', err.message));
      return;
    }
    next(err);
  }
}