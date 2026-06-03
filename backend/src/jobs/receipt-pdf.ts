import fs from 'fs';
import os from 'os';
import path from 'path';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../config/supabase';

import { sendEmail } from '../email/send';
import { orderReceiptTemplate } from '../email/templates/order-receipt';

// NOTE: Bull/BullMQ is not available in this repo right now.
// This file exports a simple in-process job function that can be called
// non-blocking (fire-and-forget) from payment completion flows.

export interface ReceiptJobData {
  payment_id: string;
  order_id: string;
  branch_id: string;
  restaurant_id: string;
  customer_email: string | null;
  customer_phone: string | null;
}

function safeNumber(n: any): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatIST(date: Date): string {
  // IST = Asia/Kolkata
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function drawDivider(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor('#000000')
    .stroke();
  doc.moveDown(0.5);
}

async function uploadToSupabase(pdfBuffer: Buffer, receiptKey: string): Promise<string> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'receipts';

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(receiptKey, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  // If bucket is public, use public URL.
  // If not public, this will still return a URL but it may not be accessible.
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(receiptKey);

  // Support both { publicUrl } and { publicURL }
  const publicUrl = (publicUrlData as any)?.publicUrl ?? (publicUrlData as any)?.publicURL;
  return publicUrl || '';
}

export async function runReceiptPdfJob(job: ReceiptJobData): Promise<{ receipt_url: string }> {
  const {
    payment_id,
    order_id,
    restaurant_id,
    branch_id,
    customer_email,
    customer_phone: _customer_phone,
  } = job;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk) => buffers.push(chunk as Buffer));

  // Fetch receipt data (single query)
  // Note: schema may differ; keep it defensive (null checks).
  const { data: receiptData, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select(
      `
      id, created_at, order_type, table_id,
      order_items(
        quantity,
        unit_price,
        notes,
        menu_items(name)
      ),
      payments(amount, tax_amount, service_charge, discount_amount, method),
      branches(name, address),
      restaurants(name, gst_number),
      restaurant_branding(logo_url, receipt_footer),
      tables(label),
      users(name)
    `,
    )
    .eq('id', order_id)
    .maybeSingle();

  if (fetchErr || !receiptData) {
    throw fetchErr ?? new Error('Receipt data fetch failed');
  }

  // Supabase nesting from select above can vary; normalize in JS.
  const itemsRaw = receiptData?.order_items ?? [];


  const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map((oi: any) => ({
    name: oi?.menu_items?.name ?? 'Item',
    quantity: safeNumber(oi?.quantity),
    unit_price: safeNumber(oi?.unit_price),
    subtotal: safeNumber(oi?.quantity) * safeNumber(oi?.unit_price),
    notes: oi?.notes ?? null,
  }));

  const payment = Array.isArray(receiptData?.payments)
    ? receiptData.payments[0]
    : receiptData?.payments;

  const amount = safeNumber(payment?.amount);
  const tax_amount = safeNumber(payment?.tax_amount);
  const service_charge = safeNumber(payment?.service_charge);
  const discount_amount = safeNumber(payment?.discount_amount);
  const method = (payment?.method ?? 'card') as string;

  // @ts-expect-error - dynamic
  const branch_name = receiptData?.branches?.name ?? '';
  // @ts-expect-error
  const branch_address = receiptData?.branches?.address ?? '';
  // @ts-expect-error
  const restaurant_name = receiptData?.restaurants?.name ?? '';
  // @ts-expect-error
  const gst_number = receiptData?.restaurants?.gst_number ?? '';
  // @ts-expect-error
  const logo_url = receiptData?.restaurant_branding?.logo_url ?? null;
  // @ts-expect-error
  const receipt_footer = receiptData?.restaurant_branding?.receipt_footer ?? null;
  // @ts-expect-error
  const table_label = receiptData?.tables?.label ?? 'Table';
  // @ts-expect-error
  const customer_name = receiptData?.users?.name ?? '';

  // ─── Layout ──────────────────────────────────────────────────────────────
  // Header: logo placeholder or image
  doc.font('Helvetica-Bold').fontSize(18).text(restaurant_name || 'Restaurant', {
    align: 'left',
  });

  const yAfterTitle = doc.y;
  if (logo_url) {
    try {
      // pdfkit can load image from URL only if it supports; safer: skip.
      // We'll just show placeholder if logo_url is present but not fetchable.
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#666666')
        .text('Logo', {
          align: 'left',
        });
    } catch {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#666666')
        .text('Logo', {
          align: 'left',
        });
    }
  } else {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text('🧾', {
        align: 'left',
      });
  }

  doc.moveDown(0.2);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#000000')
    .text(branch_address || '', { align: 'left' });

  if (gst_number) {
    doc
      .moveDown(0.2)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`GSTIN: ${gst_number}`);
  }

  drawDivider(doc);

  const receiptNo = order_id.slice(-8).toUpperCase();

  doc.font('Helvetica-Bold').fontSize(20).text('RECEIPT', { align: 'left' });
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(12).text(`Receipt #: ${receiptNo}`);

  const createdAt = receiptData.created_at ? new Date(receiptData.created_at) : new Date();
  doc.font('Helvetica').fontSize(10).text(`Date/Time: ${formatIST(createdAt)}`);

  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(10).text(`Table: ${table_label}`);
  doc.font('Helvetica').fontSize(10).text(`Order Type: ${(receiptData.order_type ?? '').toString()}`);

  if (customer_name) {
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(10).text(`Customer: ${customer_name}`);
  }

  drawDivider(doc);

  // Items header
  const tableTop = doc.y;
  const colQtyX = doc.page.margins.left;
  const colNameX = colQtyX + 50;
  const colUnitX = colNameX + 220;
  const colSubX = colUnitX + 110;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Qty', colQtyX, tableTop, { width: 50 });
  doc.text('Item Name', colNameX, tableTop, { width: 220 });
  doc.text('Unit Price', colUnitX, tableTop, { width: 110, align: 'right' });
  doc.text('Subtotal', colSubX, tableTop, { width: 110, align: 'right' });

  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10);

  for (const item of items) {
    const rowY = doc.y;
    doc.text(String(item.quantity), colQtyX, rowY, { width: 50 });
    doc.text(item.name, colNameX, rowY, { width: 220 });
    doc.text(`₹${item.unit_price.toFixed(2)}`, colUnitX, rowY, {
      width: 110,
      align: 'right',
    });
    doc.text(`₹${item.subtotal.toFixed(2)}`, colSubX, rowY, {
      width: 110,
      align: 'right',
    });
    doc.moveDown(0.3);

    if (item.notes) {
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text(item.notes, colNameX, doc.y, { width: 220 });
      doc.fillColor('#000000');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(10);
    }
  }

  drawDivider(doc);

  const computedSubtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const gstRateDefault = 0.18;
  const gstAmount = tax_amount || roundTo2(computedSubtotal * gstRateDefault);
  const serviceAmount = service_charge || roundTo2(computedSubtotal * 0.05);
  const discount = discount_amount || 0;
  const grandTotal = amount || roundTo2(computedSubtotal + gstAmount + serviceAmount - discount);

  function roundTo2(n: number) {
    return Math.round(n * 100) / 100;
  }

  const totalsXLeft = doc.page.margins.left;
  const totalsXRight = doc.page.width - doc.page.margins.right;

  doc.font('Helvetica').fontSize(10);
  doc.text(`Subtotal:`, totalsXLeft, doc.y);
  doc.text(`₹${computedSubtotal.toFixed(2)}`, totalsXRight, doc.y, { align: 'right' });
  doc.moveDown(0.2);

  doc.text(`GST (18%):`, totalsXLeft, doc.y);
  doc.text(`₹${gstAmount.toFixed(2)}`, totalsXRight, doc.y, { align: 'right' });
  doc.moveDown(0.2);

  doc.text(`Service Charge (5%):`, totalsXLeft, doc.y);
  doc.text(`₹${serviceAmount.toFixed(2)}`, totalsXRight, doc.y, { align: 'right' });
  doc.moveDown(0.2);

  if (discount > 0) {
    doc.text(`Discount:`, totalsXLeft, doc.y);
    doc.text(`-₹${discount.toFixed(2)}`, totalsXRight, doc.y, { align: 'right' });
    doc.moveDown(0.2);
  }

  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(`GRAND TOTAL:`, totalsXLeft, doc.y);
  doc.text(`₹${grandTotal.toFixed(2)}`, totalsXRight, doc.y, { align: 'right' });

  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Paid via ${String(method).toUpperCase()}`);

  drawDivider(doc);

  doc.font('Helvetica').fontSize(10);
  doc.text(receipt_footer || 'Thank you for dining with us!', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('#666666');
  doc.fontSize(9).text('Powered by DineLuxe', { align: 'center' });
  doc.fillColor('#000000');

  // ─── Finalize PDF ───────────────────────────────────────────────────────
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (e) => reject(e));
    doc.end();
  });

  const receiptKey = `receipts/${restaurant_id}/${order_id}.pdf`;

  let receipt_url = '';

  if (process.env.SUPABASE_STORAGE_BUCKET) {
    // Supabase storage configured
    receipt_url = await uploadToSupabase(pdfBuffer, receiptKey);
  } else {
    // Local dev fallback
    const tmpPath = path.join(os.tmpdir(), `${order_id}.pdf`);
    fs.writeFileSync(tmpPath, pdfBuffer);
    receipt_url = `file://${tmpPath}`;
  }

  // Update payment record
  const { error: updateErr } = await supabaseAdmin
    .from('payments')
    .update({ receipt_url })
    .eq('id', payment_id);

  if (updateErr) {
    throw updateErr;
  }

  // Send email if customer_email is provided
  if (customer_email) {
    try {
      const receiptNoShort = order_id.slice(-8).toUpperCase();
      await sendEmail({
        to: customer_email,
        templateName: 'order-receipt',
        data: {
          customerName: customer_name || 'Customer',
          restaurantName: restaurant_name || 'Restaurant',
          restaurantLogo: logo_url || undefined,
          items: items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: it.subtotal,
            addons: it.notes ? [it.notes] : undefined,
          })),
          subtotal: computedSubtotal,
          gst: gstAmount,
          serviceCharge: serviceAmount,
          total: grandTotal,
          paymentMethod: String(method),
          orderId: receiptNoShort,
          date: formatIST(createdAt),
        },
      });
    } catch {
      // non-fatal
    }
  }

  return { receipt_url };
}

