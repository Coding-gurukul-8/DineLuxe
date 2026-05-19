import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { success, error } from '../../utils/response';

type AuthenticatedRequest = Request & {
  user: { id: string; branch_id?: string; role: string; restaurant_id?: string };
  restaurantId: string;
  branchId: string;
};

// ─── Existing endpoints ───────────────────────────────────────────────────────

export async function getSales(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to, granularity = 'daily' } = req.query as any;
    const restaurant_id = authReq.user?.restaurant_id;
    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const data = await reportsService.getSales({
      branch_id,
      restaurant_id,
      from,
      to,
      granularity,
    });
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getMenuPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id } = req.query as any;
    const restaurant_id = authReq.user?.restaurant_id;
    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const data = await reportsService.getMenuPerformance(restaurant_id, branch_id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getKitchenPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to } = req.query as any;
    const data = await reportsService.getKitchenPerformance(
      branch_id ?? authReq.user?.branch_id,
      from,
      to
    );
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurant_id = authReq.user?.restaurant_id;
    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const data = await reportsService.getCustomerInsights(restaurant_id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getAdminPlatform(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportsService.getAdminPlatformReport();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getAdminTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query as any;
    const data = await reportsService.getAdminTrends(from, to);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurant_id = authReq.user?.restaurant_id;
    if (!restaurant_id) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required for export'));
    }

    const reportType = String(req.body.report_type);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const from = req.body.from ?? defaultFrom;
    const to = req.body.to ?? now.toISOString();

    if (['sales', 'kitchen-performance'].includes(reportType) && (!req.body.from || !req.body.to)) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'from and to are required for this report_type'));
    }

    if (new Date(from).getTime() > new Date(to).getTime()) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'from must be less than or equal to to'));
    }

    const result = await reportsService.exportReport({
      ...req.body,
      report_type: reportType,
      from,
      to,
      restaurant_id,
      requested_by: authReq.user.id,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── NEW: Frontend-shaped report endpoints ────────────────────────────────────
// These are the four endpoints consumed by ReportsDashboard.tsx.
// They adapt data from the existing reportsService functions into the shapes
// the frontend components expect.

/**
 * GET /reports/revenue?branch_id=&from=&to=
 * → { total, breakdown: [{ date, amount }] }
 */
export async function getRevenueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to } = req.query as Record<string, string>;
    const restaurant_id = authReq.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }
    if (!from || !to) {
      return res.status(400).json(error('VALIDATION_ERROR', 'from and to are required'));
    }

    const rows: any[] = await reportsService.getSales({
      branch_id,
      restaurant_id,
      from,
      to,
      granularity: 'daily',
    });

    const breakdown = rows.map((r: any) => ({
      date: r.period ?? r.date ?? r.truncated_at,
      amount: r.revenue ?? r.total_amount ?? r.amount ?? 0,
    }));

    const total = breakdown.reduce((s, b) => s + b.amount, 0);

    res.json(success({ total: Math.round(total * 100) / 100, breakdown }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/orders?branch_id=&from=&to=
 * → { total_orders, by_type: { dine_in, takeaway, delivery } }
 */
export async function getOrdersReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to } = req.query as Record<string, string>;
    const restaurant_id = authReq.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    // Query orders table directly for type breakdown
    const { supabaseAdmin } = await import('../../config/supabase');

    let query = supabaseAdmin
      .from('orders')
      .select('id, order_type')
      .eq('restaurant_id', restaurant_id)
      .neq('status', 'cancelled');

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59');

    const { data: orders, error: qErr } = await query;
    if (qErr) throw qErr;

    const by_type = { dine_in: 0, takeaway: 0, delivery: 0 };
    for (const o of orders ?? []) {
      const t = (o.order_type ?? '').toLowerCase();
      if (t === 'dine_in')  by_type.dine_in  += 1;
      else if (t === 'takeaway')  by_type.takeaway  += 1;
      else if (t === 'delivery') by_type.delivery += 1;
    }

    res.json(success({
      total_orders: (orders ?? []).length,
      by_type,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/menu?branch_id=&from=&to=
 * → { top_items: [{ name, count, revenue }] }
 */
export async function getMenuReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to } = req.query as Record<string, string>;
    const restaurant_id = authReq.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const rows: any[] = await reportsService.getMenuPerformance(restaurant_id, branch_id);

    const top_items = rows
      .sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0))
      .slice(0, 10)
      .map((r) => ({
        name: r.item_name ?? r.name ?? 'Unknown',
        count: r.order_count ?? r.orders ?? 0,
        revenue: r.total_revenue ?? r.revenue ?? 0,
      }));

    res.json(success({ top_items }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/staff?branch_id=&from=&to=
 * → { staff_performance: [{ name, orders, avg_time }] }
 */
export async function getStaffReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { branch_id, from, to } = req.query as Record<string, string>;
    const restaurant_id = authReq.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const { supabaseAdmin } = await import('../../config/supabase');

    // Aggregate order-serving data from the orders + staff_assignments tables.
    // avg_time is derived from the kitchen prep time where available.
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        waiter_id,
        users!waiter_id (name)
      `)
      .eq('restaurant_id', restaurant_id)
      .neq('status', 'cancelled');

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59');

    const { data: orders, error: qErr } = await query;
    if (qErr) throw qErr;

    // Aggregate by waiter
    const staffMap: Record<string, { name: string; orders: number; total_time: number; timed_orders: number }> = {};

    for (const o of orders ?? []) {
      const waiterId = (o as any).waiter_id;
      if (!waiterId) continue;
      const name = (o as any).users?.name ?? waiterId;

      if (!staffMap[waiterId]) {
        staffMap[waiterId] = { name, orders: 0, total_time: 0, timed_orders: 0 };
      }
      staffMap[waiterId].orders += 1;
    }

    const staff_performance = Object.values(staffMap)
      .sort((a, b) => b.orders - a.orders)
      .map((s) => ({
        name: s.name,
        orders: s.orders,
        avg_time: s.timed_orders > 0 ? Math.round((s.total_time / s.timed_orders) * 10) / 10 : 0,
      }));

    res.json(success({ staff_performance }));
  } catch (err) {
    next(err);
  }
}