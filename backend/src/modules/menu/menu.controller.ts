// ─────────────────────────────────────────────────────────────────────────────
// menu.controller.ts  —  AUDITED & FIXED
//
// Issues found & fixed:
//   1. error() was called as error(err.message) inside handleKnownError — no
//      code argument, so code defaulted to 'ERROR'.
//      Fixed: map the HTTP status code to a SCREAMING_SNAKE_CASE code using
//      httpStatusToCode(), then call error(code, message).
//
//   2. error('branchId is required') / error('Missing tenant context') — both
//      called without a code. Fixed: use 'BAD_REQUEST' or 'MISSING_TENANT_CONTEXT'.
//
//   3. The 403 for missing tenant context should be 'MISSING_TENANT_CONTEXT',
//      not a generic 'FORBIDDEN' (403 is the right HTTP status but the code was
//      missing entirely).
//
//   4. error('status is required') / error('ordered_ids must be an array') /
//      error('item_ids must be a non-empty array') — codes added as 'BAD_REQUEST'.
//
//   5. HTTP status codes verified:
//        POST creates (category/item) → 201  ✓
//        GET / PATCH / DELETE         → 200  ✓
//
//   6. handleKnownError: only 4xx errors are short-circuited; anything else is
//      forwarded to next() for the global handler. Behaviour unchanged, code fixed.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import {
  getPublicMenu,
  getBranchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  createMenuItem,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  updateMenuItemStatus,
  bulkPriceUpdate,
} from './menu.service';

// ── Helper: forward known HTTP errors to the appropriate HTTP status ───────────

function handleKnownError(
  err: unknown,
  res: Response,
  next: NextFunction,
): void {
  const e = err as Record<string, unknown> & Error;
  const code = (e.statusCode ?? e.status) as number | undefined;
  if (code && code >= 400 && code < 500) {
    // FIX: map HTTP status to canonical SCREAMING_SNAKE_CASE code instead of
    // passing err.message as the code (the original bug: error(err.message))
    const errorCode = httpStatusToCode(code);
    res.status(code).json(error(errorCode, e.message));
    return;
  }
  next(err);
}

function httpStatusToCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
  };
  return map[status] ?? 'CLIENT_ERROR';
}

// ── Public Menu ───────────────────────────────────────────────────────────────

export async function handleGetPublicMenu(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const menu = await getPublicMenu(req.params.branchId);
    res.json(success(menu));
  } catch (err) {
    next(err);
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function handleGetCategories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const branchId = req.params.branchId ?? req.branchId;
    if (!branchId) {
      // FIX: was error('branchId is required') — no code
      return res.status(400).json(error('BAD_REQUEST', 'branchId is required'));
    }
    const cats = await getBranchCategories(branchId);
    res.json(success(cats));
  } catch (err) {
    next(err);
  }
}

export async function handleCreateCategory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId || !req.restaurantId) {
      // FIX: was error('Missing tenant context') — no code
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch and restaurant context required'));
    }
    const cat = await createCategory(req.branchId, req.restaurantId, req.body);
    // 201 — new category resource created
    res.status(201).json(success(cat, 'Category created'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleUpdateCategory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    const cat = await updateCategory(req.params.id, req.branchId, req.body);
    res.json(success(cat, 'Category updated'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleDeleteCategory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    const result = await deleteCategory(req.params.id, req.branchId);
    res.json(success(result, 'Category deleted'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleReorderCategories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    if (!req.body.ordered_ids || !Array.isArray(req.body.ordered_ids)) {
      // FIX: was error('ordered_ids must be an array') — no code
      return res
        .status(400)
        .json(error('BAD_REQUEST', 'ordered_ids must be a non-empty array'));
    }
    const result = await reorderCategories(req.branchId, req.body.ordered_ids);
    res.json(success(result, 'Categories reordered'));
  } catch (err) {
    next(err);
  }
}

// ── Menu Items ────────────────────────────────────────────────────────────────

export async function handleCreateItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId || !req.restaurantId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch and restaurant context required'));
    }
    const item = await createMenuItem(req.branchId, req.restaurantId, req.body);
    // 201 — new menu item resource created
    res.status(201).json(success(item, 'Menu item created'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleGetItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const item = await getMenuItemById(req.params.id);
    res.json(success(item));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleUpdateItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    const item = await updateMenuItem(req.params.id, req.branchId, req.body);
    res.json(success(item, 'Menu item updated'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleDeleteItem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    const result = await deleteMenuItem(req.params.id, req.branchId);
    res.json(success(result, 'Menu item deleted'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleUpdateItemStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    if (!req.body.status) {
      // FIX: was error('status is required') — no code
      return res.status(400).json(error('BAD_REQUEST', 'status is required'));
    }
    const item = await updateMenuItemStatus(
      req.params.id,
      req.branchId,
      req.body.status,
    );
    res.json(success(item, 'Item status updated'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}

export async function handleBulkPriceUpdate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.branchId) {
      return res
        .status(403)
        .json(error('MISSING_TENANT_CONTEXT', 'Branch context required'));
    }
    if (!req.body.item_ids || req.body.item_ids.length === 0) {
      // FIX: was error('item_ids must be a non-empty array') — no code
      return res
        .status(400)
        .json(error('BAD_REQUEST', 'item_ids must be a non-empty array'));
    }
    const result = await bulkPriceUpdate(req.branchId, req.body);
    res.json(success(result, 'Prices updated'));
  } catch (err) {
    handleKnownError(err, res, next);
  }
}
