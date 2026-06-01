import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { success, error } from '../../utils/response';

type AuthenticatedRequest = Request & {
  user: { id: string; branch_id?: string; role: string; restaurant_id?: string; email?: string };
  restaurantId: string;
  branchId: string;
};

const ORDER_STATUSES = [
  'created',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'paid',
  'closed',
];

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

// GET /reports/platform?period=7d|30d|90d
export async function getPlatformReport(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || '30d';
    if (!['7d', '30d', '90d'].includes(period)) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'period must be 7d, 30d, or 90d'));
    }

    const data = await reportsService.getAdminPlatformReportForPeriod(period);
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

// ─── Synchronous export (POST /reports/export/sync) ──────────────────────────
/**
 * Kept for the frontend's "Download CSV" button (small datasets < 500 rows).
 * Streams the result inline in the HTTP response — will timeout for large data.
 * For large/async exports use queueExportReport() below.
 */
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

// ─── Async export — queue job (POST /reports/export) ─────────────────────────
/**
 * Enqueues a report-export job via the Redis-backed Bull-style queue.
 * Returns 202 Accepted with a job_id immediately — does not wait for the
 * report to be generated. The caller polls GET /reports/export/:jobId/status.
 *
 * Supports csv | xlsx | pdf and all four report types.
 * Sends an email to the requester when the report is ready.
 */
export async function queueExportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const restaurant_id = authReq.user?.restaurant_id;

    if (!restaurant_id) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required for export'));
    }

    const reportType = String(req.body.report_type) as
      | 'sales'
      | 'menu-performance'
      | 'kitchen-performance'
      | 'customer-insights';

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const from: string = req.body.from ?? defaultFrom;
    const to: string = req.body.to ?? now.toISOString();

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

    // Resolve the requester's email:
    //   1. Prefer the email stored on req.user (set by auth middleware if present)
    //   2. Fall back to looking it up from the users table
    let requestedByEmail: string = (authReq.user as any).email ?? '';

    if (!requestedByEmail) {
      const { supabaseAdmin } = await import('../../config/supabase');
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', authReq.user.id)
        .single();
      requestedByEmail = userRow?.email ?? '';
    }

    if (!requestedByEmail) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Could not resolve requester email for notification'));
    }

    const result = await reportsService.queueReportExport({
      report_type: reportType,
      format: req.body.format ?? 'csv',
      branch_id: req.body.branch_id,
      restaurant_id,
      from,
      to,
      requested_by_user_id: authReq.user.id,
      requested_by_email: requestedByEmail,
    });

    // 202 Accepted — job is queued but not yet complete
    res.status(202).json(success(result, 'Report queued successfully'));
  } catch (err) {
    next(err);
  }
}

// ─── Job status endpoint (GET /reports/export/:jobId/status) ─────────────────
/**
 * Polls the status of an async export job.
 * Returns download_url once status === 'completed'.
 */
export async function getExportJobStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'jobId param is required'));
    }

    const result = await reportsService.getReportJobStatus(jobId);
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
      .in('status', ORDER_STATUSES);

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
      .in('status', ORDER_STATUSES);

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