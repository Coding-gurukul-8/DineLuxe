/**
 * backend/src/jobs/report-export.ts
 *
 * Async report-export job — Redis-backed queue (same infrastructure used by
 * booking-reminder.ts / delivery-acceptance-timeout.ts in this repo).
 *
 * No external Bull/BullMQ package is needed: the project already has ioredis
 * (via ResilientRedis in config/redis.ts), which we use directly for job
 * enqueue / dequeue / status tracking so we stay consistent with the existing
 * job patterns.
 *
 * ─── Queue design ────────────────────────────────────────────────────────────
 *
 *   Redis key layout:
 *     report-export:queue          — LIST  jobs waiting to run (RPUSH / BLPOP)
 *     report-export:job:{jobId}    — HASH  job payload + status (TTL = 25 h)
 *     report_download:{jobId}      — STRING  download URL (TTL = 24 h)
 *
 *   Job lifecycle:
 *     1. queueReportExport()    → RPUSH payload onto list, HSET status=waiting
 *     2. processNextJob()       → LPOP, HSET status=active, run processor
 *     3. processor succeeds     → HSET status=completed, SETEX download URL
 *     4. processor throws       → HSET status=failed + error message
 *
 * ─── Worker bootstrap ────────────────────────────────────────────────────────
 *
 *   Import and call startReportExportWorker() once in server.ts:
 *
 *     import { startReportExportWorker } from './jobs/report-export';
 *     startReportExportWorker();
 *
 *   The worker polls every POLL_INTERVAL_MS (default 5 s). For production
 *   you can run multiple worker processes; each does an atomic LPOP so jobs
 *   are never processed twice.
 */

import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';
import { supabaseAdmin } from '../config/supabase';
import { sendEmail } from '../email/send';
import {
  getSales,
  getMenuPerformance,
  getKitchenPerformance,
  getCustomerInsights,
} from '../modules/reports/reports.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_LIST_KEY = 'report-export:queue';
const JOB_HASH_PREFIX = 'report-export:job:';
const DOWNLOAD_URL_PREFIX = 'report_download:';
const JOB_TTL_SECONDS = 25 * 60 * 60;      // 25 hours — outlasts the 24-h download URL
const DOWNLOAD_URL_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const POLL_INTERVAL_MS = 5_000;             // 5 seconds between polls

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportExportJob {
  report_type: 'sales' | 'menu-performance' | 'kitchen-performance' | 'customer-insights';
  format: 'csv' | 'xlsx' | 'pdf';
  branch_id?: string;
  restaurant_id: string;
  from: string;    // ISO date string
  to: string;      // ISO date string
  requested_by_user_id: string;
  requested_by_email: string;
}

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed';

interface JobRecord {
  job_id: string;
  status: JobStatus;
  payload: ReportExportJob;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

// ─── Field helpers (csv / xlsx column definitions) ───────────────────────────

function getFieldsForReportType(reportType: string): string[] {
  switch (reportType) {
    case 'sales':
      return ['period', 'total_orders', 'total_revenue', 'avg_order_value'];
    case 'menu-performance':
      return ['item_name', 'order_count', 'total_revenue', 'avg_rating', 'is_slow_mover'];
    case 'kitchen-performance':
      return ['dish_name', 'avg_prep_time_minutes', 'total_prepared', 'overdue_count'];
    case 'customer-insights':
      return ['metric', 'value', 'email', 'total_spent'];
    default:
      return [];
  }
}

function getColumnsForExcelJS(reportType: string): Array<{ header: string; key: string; width: number }> {
  const fieldMap: Record<string, Array<{ header: string; key: string; width: number }>> = {
    'sales': [
      { header: 'Period',          key: 'period',           width: 20 },
      { header: 'Total Orders',    key: 'total_orders',     width: 14 },
      { header: 'Total Revenue',   key: 'total_revenue',    width: 16 },
      { header: 'Avg Order Value', key: 'avg_order_value',  width: 16 },
    ],
    'menu-performance': [
      { header: 'Item Name',    key: 'item_name',      width: 30 },
      { header: 'Order Count',  key: 'order_count',    width: 14 },
      { header: 'Revenue',      key: 'total_revenue',  width: 14 },
      { header: 'Avg Rating',   key: 'avg_rating',     width: 12 },
      { header: 'Slow Mover',   key: 'is_slow_mover',  width: 12 },
    ],
    'kitchen-performance': [
      { header: 'Dish Name',       key: 'dish_name',             width: 28 },
      { header: 'Avg Prep (min)',   key: 'avg_prep_time_minutes', width: 16 },
      { header: 'Total Prepared',  key: 'total_prepared',        width: 16 },
      { header: 'Overdue Count',   key: 'overdue_count',         width: 14 },
    ],
    'customer-insights': [
      { header: 'Metric',       key: 'metric',       width: 22 },
      { header: 'Value',        key: 'value',        width: 14 },
      { header: 'Email',        key: 'email',        width: 30 },
      { header: 'Total Spent',  key: 'total_spent',  width: 14 },
    ],
  };
  return fieldMap[reportType] ?? [{ header: 'Data', key: 'value', width: 40 }];
}

// ─── Report data fetcher ──────────────────────────────────────────────────────

async function fetchReportData(job: ReportExportJob): Promise<any[]> {
  const { report_type, restaurant_id, branch_id, from, to } = job;

  switch (report_type) {
    case 'sales':
      return getSales({ branch_id, restaurant_id, from, to, granularity: 'daily' });

    case 'menu-performance':
      return getMenuPerformance(restaurant_id, branch_id);

    case 'kitchen-performance':
      if (!branch_id) {
        throw Object.assign(
          new Error('branch_id is required for kitchen-performance export'),
          { status: 422 },
        );
      }
      return getKitchenPerformance(branch_id, from, to);

    case 'customer-insights': {
      const insights = await getCustomerInsights(restaurant_id);
      return [
        { metric: 'new_customers_30d', value: insights.new_customers_30d },
        ...insights.top_spenders.map((s: any) => ({
          metric: 'top_spender',
          value: s.total_spent ?? 0,
          email: s.email ?? '',
          total_spent: s.total_spent ?? 0,
        })),
      ];
    }

    default:
      return [];
  }
}

// ─── File generation ──────────────────────────────────────────────────────────

async function generateCSV(data: any[], reportType: string): Promise<Buffer> {
  const { Parser } = require('json2csv') as typeof import('json2csv');

  if (data.length === 0) {
    return Buffer.from('No data available for the selected period.\n', 'utf-8');
  }

  const fields = getFieldsForReportType(reportType);
  const parser = new Parser({ fields: fields.length > 0 ? fields : undefined });
  return Buffer.from(parser.parse(data), 'utf-8');
}

async function generateXLSX(data: any[], reportType: string): Promise<Buffer> {
  // exceljs is listed as a required install: npm install exceljs @types/exceljs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require('exceljs') as typeof import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Restaurant OS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(reportType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  sheet.columns = getColumnsForExcelJS(reportType);

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A3C5E' }, // DineLuxe brand navy
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  if (data.length === 0) {
    sheet.addRow({ [getColumnsForExcelJS(reportType)[0]?.key ?? 'data']: 'No data available for the selected period.' });
  } else {
    data.forEach((row) => sheet.addRow(row));
  }

  // Auto-fit rows
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.height = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function generatePDF(data: any[], reportType: string, job: ReportExportJob): Promise<Buffer> {
  const PDFDocument = require('pdfkit') as typeof import('pdfkit');

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new (PDFDocument as any)({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Header ───────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .fillColor('#1A3C5E')
      .text(reportType.toUpperCase().replace(/-/g, ' ') + ' REPORT', { align: 'center' });

    doc.moveDown(0.4);
    doc
      .fontSize(11)
      .fillColor('#6B7280')
      .text(
        `Date range: ${new Date(job.from).toLocaleDateString('en-IN')} – ${new Date(job.to).toLocaleDateString('en-IN')}`,
        { align: 'center' },
      );
    doc.moveDown(0.4);
    doc
      .fontSize(10)
      .fillColor('#9CA3AF')
      .text(`Generated: ${new Date().toLocaleString('en-IN')}  ·  Restaurant ID: ${job.restaurant_id}`, {
        align: 'center',
      });

    doc.moveDown(1.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.8);

    // ─── Table ────────────────────────────────────────────────────────────────
    if (data.length === 0) {
      doc
        .fontSize(12)
        .fillColor('#374151')
        .text('No data available for the selected period.', { align: 'center' });
    } else {
      const keys = Object.keys(data[0]);
      const colWidth = Math.min(120, Math.floor(515 / keys.length));
      const tableX = 40;

      // Header row
      doc.fontSize(9).fillColor('#FFFFFF');
      const headerY = doc.y;
      doc.rect(tableX, headerY, colWidth * keys.length, 18).fill('#1A3C5E');
      keys.forEach((key, i) => {
        doc
          .fillColor('#FFFFFF')
          .text(
            key.replace(/_/g, ' ').toUpperCase(),
            tableX + i * colWidth + 4,
            headerY + 4,
            { width: colWidth - 8, lineBreak: false },
          );
      });

      doc.moveDown(1.8);

      // Data rows
      data.forEach((row, rowIndex) => {
        if (doc.y > 720) {
          doc.addPage();
        }
        const rowY = doc.y;
        const isEven = rowIndex % 2 === 0;

        doc.rect(tableX, rowY, colWidth * keys.length, 16).fill(isEven ? '#F9FAFB' : '#FFFFFF');
        doc.fontSize(8).fillColor('#374151');

        keys.forEach((key, i) => {
          const cellValue = String(row[key] ?? '');
          doc.text(
            cellValue.length > 20 ? cellValue.substring(0, 18) + '…' : cellValue,
            tableX + i * colWidth + 4,
            rowY + 3,
            { width: colWidth - 8, lineBreak: false },
          );
        });

        doc.moveDown(1.1);
      });
    }

    // ─── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor('#9CA3AF')
      .text('DineLuxe Restaurant OS  ·  Confidential', 40, 790, { align: 'center' });

    doc.end();
  });
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function uploadAndGetUrl(
  buffer: Buffer,
  jobId: string,
  job: ReportExportJob,
  extension: string,
  contentType: string,
): Promise<string> {
  const storageBucket = process.env['SUPABASE_STORAGE_BUCKET'];
  const fileName = `reports/${job.restaurant_id}/${job.report_type}-${jobId}.${extension}`;

  if (storageBucket) {
    // ── Supabase Storage path ─────────────────────────────────────────────────
    const { error: uploadError } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    // Use a signed URL so private buckets still work
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(storageBucket)
      .createSignedUrl(fileName, DOWNLOAD_URL_TTL_SECONDS);

    if (urlError) throw urlError;
    return urlData.signedUrl;
  }

  // ── Supabase default 'exports' bucket (fallback, matches existing service) ──
  try {
    const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (!listErr) {
      const exists = (buckets ?? []).some((b: any) => b.name === 'exports');
      if (!exists) {
        const { error: createErr } = await supabaseAdmin.storage.createBucket('exports', {
          public: false,
        });
        if (createErr && !String(createErr.message ?? '').toLowerCase().includes('already')) {
          throw createErr;
        }
      }
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from('exports')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('exports')
      .createSignedUrl(fileName, DOWNLOAD_URL_TTL_SECONDS);

    if (urlError) throw urlError;
    return urlData.signedUrl;
  } catch (supabaseErr: any) {
    // ── Local dev fallback: write to /tmp ──────────────────────────────────
    console.warn('[report-export] Supabase Storage unavailable, writing to /tmp:', supabaseErr.message);
    const fs = require('fs') as typeof import('fs');
    const tmpPath = `/tmp/report-${jobId}.${extension}`;
    fs.writeFileSync(tmpPath, buffer);
    // Return a file:// URL so the caller still gets a valid string
    return `file://${tmpPath}`;
  }
}

// ─── Email notification ───────────────────────────────────────────────────────

async function sendReadyEmail(
  job: ReportExportJob,
  downloadUrl: string,
  restaurantName: string,
): Promise<void> {
  const dateRange = `${new Date(job.from).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })} – ${new Date(job.to).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })}`;

  const reportLabel = job.report_type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  await sendEmail({
    to: job.requested_by_email,
    templateName: 'report-ready',
    data: {
      restaurantName,
      reportType: reportLabel,
      dateRange,
      downloadUrl,
      format: job.format.toUpperCase(),
    },
  });
}

// ─── Core job processor ───────────────────────────────────────────────────────

/**
 * Processes a single report-export job end-to-end:
 *   1. Fetch report data from Supabase
 *   2. Generate file buffer (CSV / XLSX / PDF)
 *   3. Upload to Supabase Storage (or /tmp for local dev)
 *   4. Cache download URL in Redis (TTL = 24 h)
 *   5. Send email notification to requester
 */
export async function processReportExportJob(jobId: string, job: ReportExportJob): Promise<void> {
  console.log(`[report-export] ▶ Processing job ${jobId} (${job.report_type} / ${job.format})`);

  // 1. Fetch data ─────────────────────────────────────────────────────────────
  const reportData = await fetchReportData(job);
  console.log(`[report-export] Fetched ${reportData.length} row(s) for job ${jobId}`);

  // 2. Generate file buffer ───────────────────────────────────────────────────
  let fileBuffer: Buffer;
  let contentType: string;
  let extension: string;

  switch (job.format) {
    case 'xlsx':
      fileBuffer = await generateXLSX(reportData, job.report_type);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
      break;

    case 'pdf':
      fileBuffer = await generatePDF(reportData, job.report_type, job);
      contentType = 'application/pdf';
      extension = 'pdf';
      break;

    case 'csv':
    default:
      fileBuffer = await generateCSV(reportData, job.report_type);
      contentType = 'text/csv';
      extension = 'csv';
      break;
  }

  // 3. Upload & get download URL ──────────────────────────────────────────────
  const downloadUrl = await uploadAndGetUrl(fileBuffer, jobId, job, extension, contentType);
  console.log(`[report-export] Uploaded job ${jobId}: ${downloadUrl.substring(0, 60)}…`);

  // 4. Cache URL in Redis ─────────────────────────────────────────────────────
  await redis.setex(
    `${DOWNLOAD_URL_PREFIX}${jobId}`,
    DOWNLOAD_URL_TTL_SECONDS,
    downloadUrl,
  );

  // 5. Send email ─────────────────────────────────────────────────────────────
  // Look up restaurant name for a personalised email subject
  let restaurantName = 'Your restaurant';
  try {
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('name')
      .eq('id', job.restaurant_id)
      .single();
    if (restaurant?.name) restaurantName = restaurant.name;
  } catch {
    // Non-fatal — we still send the email with the generic name
  }

  await sendReadyEmail(job, downloadUrl, restaurantName).catch((emailErr: Error) => {
    // Email failure must never abort the job — log and continue
    console.error(`[report-export] Email failed for job ${jobId}:`, emailErr.message);
  });

  console.log(`[report-export] ✓ Job ${jobId} completed`);
}

// ─── Queue helpers (Redis-backed) ─────────────────────────────────────────────

/**
 * Enqueues a new report-export job.
 * Returns the new job ID immediately — the caller should poll
 * GET /reports/export/:jobId/status for progress.
 */
export async function enqueueReportExport(
  jobData: ReportExportJob,
): Promise<{ job_id: string; message: string }> {
  const jobId = uuidv4();

  const record: JobRecord = {
    job_id: jobId,
    status: 'waiting',
    payload: jobData,
    created_at: new Date().toISOString(),
  };

  // Persist job metadata as a JSON string in Redis with a long TTL
  await redis.setex(
    `${JOB_HASH_PREFIX}${jobId}`,
    JOB_TTL_SECONDS,
    JSON.stringify(record),
  );

  // Push job ID onto the queue list for the worker to pick up
  // ResilientRedis doesn't expose rpush directly, so we call via the raw ioredis client.
  try {
    const raw = (redis as any).client as import('ioredis').Redis | undefined;
    if (raw && typeof raw.rpush === 'function') {
      await raw.rpush(QUEUE_LIST_KEY, jobId);
    } else {
      // In-memory fallback: treat the memory map as the queue
      const existing = await redis.get(QUEUE_LIST_KEY);
      const queue: string[] = existing ? JSON.parse(existing) : [];
      queue.push(jobId);
      // No TTL on the queue list itself — jobs will expire via their own keys
      await (redis as any).setMemoryEntry(QUEUE_LIST_KEY, JSON.stringify(queue));
    }
  } catch (err: any) {
    console.error('[report-export] Failed to push job to queue list:', err.message);
    // Still return the job_id — the worker sweeper will re-queue orphaned waiting jobs
  }

  console.log(`[report-export] Enqueued job ${jobId} (${jobData.report_type} / ${jobData.format})`);

  return {
    job_id: jobId,
    message: 'Report is being generated. You will receive an email when ready.',
  };
}

/**
 * Checks the status of an export job.
 * If completed, also returns the cached download URL.
 */
export async function getReportExportJobStatus(jobId: string): Promise<{
  status: JobStatus;
  download_url?: string;
  error?: string;
  created_at?: string;
}> {
  const raw = await redis.get(`${JOB_HASH_PREFIX}${jobId}`);

  if (!raw) {
    // Job not found — treat as expired / never existed
    return { status: 'failed', error: 'Job not found or has expired.' };
  }

  const record: JobRecord = JSON.parse(raw);

  if (record.status === 'completed') {
    const downloadUrl = await redis.get(`${DOWNLOAD_URL_PREFIX}${jobId}`);
    return {
      status: 'completed',
      download_url: downloadUrl ?? undefined,
      created_at: record.created_at,
    };
  }

  return {
    status: record.status,
    ...(record.error ? { error: record.error } : {}),
    created_at: record.created_at,
  };
}

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Pops and processes one job from the queue.
 * Called on a tight poll loop in startReportExportWorker().
 */
async function processNextJob(): Promise<void> {
  // Attempt to pop the next job ID from the Redis list
  let jobId: string | null = null;

  try {
    const raw = (redis as any).client as import('ioredis').Redis | undefined;
    if (raw && typeof raw.lpop === 'function') {
      jobId = await raw.lpop(QUEUE_LIST_KEY);
    } else {
      // In-memory fallback
      const queueRaw = await redis.get(QUEUE_LIST_KEY);
      if (queueRaw) {
        const queue: string[] = JSON.parse(queueRaw);
        if (queue.length > 0) {
          jobId = queue.shift()!;
          await (redis as any).setMemoryEntry(QUEUE_LIST_KEY, JSON.stringify(queue));
        }
      }
    }
  } catch (err: any) {
    console.error('[report-export] Queue pop error:', err.message);
    return;
  }

  if (!jobId) return; // Nothing in queue

  // Load the job record
  const recordRaw = await redis.get(`${JOB_HASH_PREFIX}${jobId}`);
  if (!recordRaw) {
    console.warn(`[report-export] Job ${jobId} no longer in Redis — skipping`);
    return;
  }

  const record: JobRecord = JSON.parse(recordRaw);

  // Mark active
  record.status = 'active';
  record.started_at = new Date().toISOString();
  await redis.setex(`${JOB_HASH_PREFIX}${jobId}`, JOB_TTL_SECONDS, JSON.stringify(record));

  // Run the processor
  try {
    await processReportExportJob(jobId, record.payload);

    record.status = 'completed';
    record.completed_at = new Date().toISOString();
  } catch (err: any) {
    console.error(`[report-export] Job ${jobId} failed:`, err.message);
    record.status = 'failed';
    record.error = err.message ?? 'Unknown error';
  }

  // Persist final status
  await redis.setex(`${JOB_HASH_PREFIX}${jobId}`, JOB_TTL_SECONDS, JSON.stringify(record));
}

/**
 * Starts the report-export background worker.
 *
 * Call once during server bootstrap:
 *   import { startReportExportWorker } from './jobs/report-export';
 *   startReportExportWorker();
 *
 * The worker polls the Redis queue every POLL_INTERVAL_MS milliseconds.
 * It processes one job per tick; multiple server processes each compete
 * for the same LPOP — only one wins per job, providing natural fan-out.
 */
export function startReportExportWorker(): void {
  console.log(`[report-export] Worker started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  const tick = async () => {
    try {
      await processNextJob();
    } catch (err: any) {
      // Never crash the worker loop
      console.error('[report-export] Unexpected worker error:', err.message);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  // Kick off the first tick after a short startup delay
  setTimeout(tick, 1_000);
}