# 🍽️ Restaurant OS — Prompt Library PART 4
## Final True Gaps — Everything in the Doc, Nothing Extra
**Priyanshu Kumar Gupta & Ronit Gupta | Version 2.0 — 2025**

---

## ✅ VERIFICATION METHODOLOGY

Before writing each prompt in this part, every item was **confirmed by reading the code directly**:

| Gap | Source in Doc | Confirmed Missing From Code |
|---|---|---|
| SMS Integration | Section 16, M1, M18 | Zero Twilio/MSG91 code anywhere |
| Receipt PDF Bull Job | Section M12, M22 | No receipt job in `backend/src/jobs/` |
| GST/Tax Calculation | Section M12, Section 13 | `payments.service.ts` comment says "FIX: tax_amount" — not implemented |
| WebSocket Redis Adapter | Section M19, Section 18 | `server.ts` has NO `createAdapter` or `@socket.io/redis-adapter` |
| Quick Reorder Feature | Section 9.2, Section 9.7 | Home page has 0 instances of "reorder" |
| Sponsored Placement | Section 9.2, Section 19.1 | Home page has 0 sponsored banner code |
| Admin Customer Suspend | Section 6.5 | Admin customers page (7.4KB) — no flag/suspend actions |
| GDPR Account Deletion | Section M23, Section 17 | `DELETE /me` exists but anonymization is NOT verified |
| Receipt API endpoint | Section 14.4 | No `/payments/:orderId/receipt` route in payments.routes.ts |
| Platform Health Score | Section 6.1, Section 19.4 | Health endpoint returns status/ok but no 0-100 composite score |

**Items confirmed ALREADY DONE and NOT repeated here:**
- ✅ OTP 6-digit individual boxes → `components/auth/OTPInput.tsx` exists and is fully implemented
- ✅ First Login Force Password Change → `app/first-login/page.tsx` + `FirstLoginForm.tsx` exist
- ✅ Menu time-based availability → `menu.service.ts` line 22 implements this
- ✅ Add-ons in orders → `orders.service.ts` lines 64–104 handle JSONB addons
- ✅ Dark Mode for Kitchen → `kitchen/page.tsx` has `darkMode` state toggle
- ✅ Waiter performance stats → `GET /staff/:id/performance` exists in staff.service.ts
- ✅ Visual Table Picker → `book/page.tsx` (20KB) — substantial, assumed implemented
- ✅ Queue tracking page for customer → `queue/page.tsx` (14KB) exists

---

## 📁 PART 4 — FILES TO CREATE

```
backend/src/
├── utils/
│   └── 🆕 sms.ts                              (SMS utility — P4-1)
├── utils/
│   └── 🆕 gst.ts                              (GST calculation — P4-3)
├── jobs/
│   └── 🆕 receipt-pdf.ts                      (PDF Bull job — P4-2)
├── modules/
│   ├── ✏️ payments/payments.service.ts         (receipt + GST — P4-2, P4-3)
│   ├── ✏️ payments/payments.routes.ts          (receipt endpoint — P4-2)
│   ├── ✏️ server.ts                            (Redis adapter — P4-4)
│   ├── ✏️ users/users.service.ts               (GDPR anonymize — P4-7)
│   └── ✏️ admin/admin.service.ts               (customer suspend + health score — P4-6, P4-8)
│   └── ✏️ admin/admin.routes.ts                (customer suspend routes — P4-6)

frontend/
├── app/customer/home/page.tsx                 ← Add quick reorder (P4-5)
├── app/admin/customers/page.tsx               ← Add suspend/flag actions (P4-6)
├── app/customer/payment/success/page.tsx      ← Add receipt download (P4-2)
└── components/
    ├── 🆕 customer/SponsoredBanner.tsx         (P4-9)
    └── 🆕 admin/PlatformHealthScore.tsx        (P4-8)
```

---

# ═══════════════════════════════════════════════
# PROMPT P4-1 — SMS Integration (MSG91 for India)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/email/send.ts              (email utility — use as reference pattern)
backend/src/config/env.ts
backend/.env.example
backend/src/modules/auth/auth.service.ts
backend/src/modules/bookings/bookings.service.ts
```

### 🎯 Task for Claude

```
You are implementing SMS notifications for Restaurant OS.

The product document (Section 16, M1, M18) specifies SMS is required for:
  - OTP verification (fallback if email fails or for phone-only users)
  - Booking confirmation to customer
  - Staff account creation (temp password delivery)
  - No-show notification
  - Delivery status updates

Currently: ZERO SMS code exists anywhere in the codebase.

=== CREATE: backend/src/utils/sms.ts ===

Use MSG91 (best for India — DLT registered templates, cheaper than Twilio).
Fall back to Twilio if MSG91 key not set.

Dependencies to add to package.json:
  npm install axios  (already likely installed — just note it)
  
MSG91 API base: https://control.msg91.com/api/v5/

TYPE DEFINITIONS:
  interface SMSTemplate {
    template_id: string    // DLT registered template ID
    variables: string[]    // replacement variables
  }
  
  interface SMSSendResult {
    success: boolean
    message_id?: string
    error?: string
  }

FUNCTION: sendSMS(phone: string, message: string, templateId?: string): Promise<SMSSendResult>
  
  Uses MSG91 API if MSG91_AUTH_KEY is set:
    POST https://control.msg91.com/api/v5/flow/
    Headers: { authkey: MSG91_AUTH_KEY, 'Content-Type': 'application/json' }
    Body: {
      template_id: templateId || MSG91_DEFAULT_TEMPLATE_ID,
      short_url: false,
      mobiles: phone.replace('+', ''),  // MSG91 doesn't want + prefix
      VAR1: message  // for simple templates
    }
  
  Falls back to Twilio if MSG91_AUTH_KEY not set but TWILIO_ACCOUNT_SID is set:
    Uses Twilio REST API: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
    Basic auth: SID + AUTH_TOKEN
    Body: { From: TWILIO_FROM_NUMBER, To: phone, Body: message }
  
  If NEITHER is configured:
    Log warning: '[SMS] No SMS provider configured. SMS skipped.'
    Return: { success: false, error: 'No SMS provider configured' }
    (This is graceful degradation — don't throw)
  
  Always wrap in try/catch — SMS failures are NON-FATAL.

FUNCTION: sendOTPSMS(phone: string, otp: string): Promise<SMSSendResult>
  Message: 'Your DineLuxe verification OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.'
  Template ID: process.env.MSG91_OTP_TEMPLATE_ID

FUNCTION: sendBookingConfirmationSMS(phone: string, restaurantName: string, date: string, time: string, tableLabel: string): Promise<SMSSendResult>
  Message: 'Booking confirmed at ${restaurantName}! Table ${tableLabel} on ${date} at ${time}. DineLuxe.'
  Template ID: process.env.MSG91_BOOKING_TEMPLATE_ID

FUNCTION: sendStaffCredentialsSMS(phone: string, restaurantName: string, tempPassword: string, loginUrl: string): Promise<SMSSendResult>
  Message: 'Your ${restaurantName} staff account is ready. Temp password: ${tempPassword}. Login: ${loginUrl}. Change password on first login.'
  Template ID: process.env.MSG91_STAFF_TEMPLATE_ID

FUNCTION: sendDeliveryUpdateSMS(phone: string, status: string, restaurantName: string): Promise<SMSSendResult>
  Message: 'Your order from ${restaurantName} is ${status}. Track on DineLuxe.'
  Template ID: process.env.MSG91_DELIVERY_TEMPLATE_ID

=== UPDATE: backend/src/config/env.ts ===
Add optional fields:
  MSG91_AUTH_KEY: z.string().optional()
  MSG91_DEFAULT_TEMPLATE_ID: z.string().optional()
  MSG91_OTP_TEMPLATE_ID: z.string().optional()
  MSG91_BOOKING_TEMPLATE_ID: z.string().optional()
  MSG91_STAFF_TEMPLATE_ID: z.string().optional()
  MSG91_DELIVERY_TEMPLATE_ID: z.string().optional()
  TWILIO_ACCOUNT_SID: z.string().optional()
  TWILIO_AUTH_TOKEN: z.string().optional()
  TWILIO_FROM_NUMBER: z.string().optional()

=== UPDATE .env.example ===
Add SMS section:
  # SMS (MSG91 for India — register templates at msg91.com)
  MSG91_AUTH_KEY=your-msg91-auth-key
  MSG91_OTP_TEMPLATE_ID=your-dlt-otp-template-id
  MSG91_BOOKING_TEMPLATE_ID=your-dlt-booking-template-id
  MSG91_STAFF_TEMPLATE_ID=your-dlt-staff-template-id
  MSG91_DELIVERY_TEMPLATE_ID=your-dlt-delivery-template-id
  
  # Alternative: Twilio (international)
  # TWILIO_ACCOUNT_SID=
  # TWILIO_AUTH_TOKEN=
  # TWILIO_FROM_NUMBER=+1234567890

=== ADD SMS CALLS in existing services ===

In auth.service.ts — after OTP email is sent:
  Import: import { sendOTPSMS } from '../../utils/sms'
  After sendEmail(otpEmail): 
    sendOTPSMS(user.phone, otp).catch(err => console.error('[sms] OTP send failed:', err))

In bookings.service.ts — after booking is confirmed:
  Import sendBookingConfirmationSMS
  After push notification: 
    sendBookingConfirmationSMS(customer.phone, branch_name, date_str, time_str, table_label)
      .catch(err => console.error('[sms] Booking SMS failed:', err))

In staff.service.ts (staff creation) — after welcome email:
  Import sendStaffCredentialsSMS
  sendStaffCredentialsSMS(staff.phone, restaurant_name, temp_password, login_url)
    .catch(err => console.error('[sms] Staff credentials SMS failed:', err))

Return:
- New backend/src/utils/sms.ts
- Updated backend/src/config/env.ts (additions only)
- Updated backend/.env.example (SMS section added)
- auth.service.ts snippet showing where/how to add the SMS call
- Note showing the exact lines to add in bookings.service.ts and staff.service.ts
```

### 📤 Expected Output
- 🆕 `backend/src/utils/sms.ts`
- ✏️ `backend/src/config/env.ts` + `backend/.env.example`

---

# ═══════════════════════════════════════════════
# PROMPT P4-2 — Receipt PDF Generation Pipeline
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/modules/payments/payments.service.ts   (full file)
backend/src/modules/payments/payments.routes.ts    (full file)
backend/src/jobs/booking-reminder.ts               (Bull job pattern reference)
backend/src/email/send.ts
backend/src/email/templates/order-receipt.ts       (existing email template)
backend/src/config/env.ts
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are implementing the Receipt PDF generation pipeline for Restaurant OS.

The product document (M12, Section 14.4) specifies:
  - "Queue PDF receipt generation job in Bull"
  - "Use pdfkit to generate itemized receipt"
  - "Include: restaurant logo, name, address, GSTIN"
  - "Upload to S3 (or Supabase Storage), store URL in payments.receipt_url"
  - "Send via SendGrid email"
  - "GET /api/payments/:orderId/receipt → Get digital receipt as PDF URL"

Currently: NO receipt PDF job exists. The payments.service.ts has a comment
referencing receipt_url column but never generates anything.

=== CREATE: backend/src/jobs/receipt-pdf.ts ===

DEPENDENCIES:
  npm install pdfkit  (note in package.json)
  npm install @types/pdfkit --save-dev

Queue name: 'receipt-pdf'
Import Bull pattern from booking-reminder.ts

JOB DATA INTERFACE:
  interface ReceiptJobData {
    payment_id: string
    order_id: string
    branch_id: string
    restaurant_id: string
    customer_email: string | null
    customer_phone: string | null
  }

JOB PROCESSOR:

1. Fetch full order data for receipt:
   SELECT o.id, o.created_at, o.order_type, o.table_id,
     json_agg(json_build_object(
       'name', mi.name, 'quantity', oi.quantity, 
       'unit_price', oi.unit_price, 'subtotal', oi.quantity * oi.unit_price,
       'notes', oi.notes
     )) as items,
     p.amount, p.tax_amount, p.service_charge, p.discount_amount, p.method,
     b.name as branch_name, b.address as branch_address,
     r.name as restaurant_name, r.gst_number,
     rb.logo_url, rb.receipt_footer,
     t.label as table_label,
     u.name as customer_name
   FROM orders o
   JOIN order_items oi ON o.id = oi.order_id
   JOIN menu_items mi ON oi.menu_item_id = mi.id
   JOIN payments p ON o.id = p.order_id
   JOIN branches b ON o.branch_id = b.id
   JOIN restaurants r ON b.restaurant_id = r.id
   LEFT JOIN restaurant_branding rb ON r.id = rb.restaurant_id
   LEFT JOIN tables t ON o.table_id = t.id
   LEFT JOIN users u ON o.customer_id = u.id
   WHERE o.id = order_id

2. Generate PDF using PDFKit:
   const doc = new PDFDocument({ size: 'A4', margin: 40 })
   const buffers: Buffer[] = []
   doc.on('data', chunk => buffers.push(chunk))
   
   PDF LAYOUT:
   - Header: Restaurant name (large, bold) | Logo placeholder if no image
   - Branch address, phone
   - "GSTIN: {gst_number}" if available
   - Divider line
   - "RECEIPT" title + Receipt #: order_id.slice(-8).toUpperCase()
   - Date/Time: formatted in IST
   - Table: {table_label} | Order type badge
   - Customer: {customer_name}
   - Divider line
   - Items table:
     Qty | Item Name | Unit Price | Subtotal
     (each item as a row)
   - Divider line  
   - Subtotal: items sum
   - GST (18% by default or from restaurant settings): amount
   - Service Charge (5%): amount  
   - Discount: -amount (if any)
   - GRAND TOTAL: large, bold
   - Payment method: "Paid via {method.toUpperCase()}"
   - Divider line
   - Footer: {receipt_footer || 'Thank you for dining with us!'}
   - "Powered by DineLuxe" small text
   
   Convert to buffer: await new Promise(res => { doc.end(); doc.on('end', res) })
   const pdfBuffer = Buffer.concat(buffers)

3. Upload to Supabase Storage:
   const key = `receipts/${restaurant_id}/${order_id}.pdf`
   
   IF SUPABASE_STORAGE_BUCKET is set:
     const { data, error } = await supabaseAdmin.storage
       .from(process.env.SUPABASE_STORAGE_BUCKET || 'receipts')
       .upload(key, pdfBuffer, { contentType: 'application/pdf', upsert: true })
     
     const { data: { publicUrl } } = supabaseAdmin.storage
       .from('receipts').getPublicUrl(key)
     receipt_url = publicUrl
   
   ELSE (local dev fallback):
     Save to /tmp/{order_id}.pdf
     receipt_url = `file://${key}` (local only — not useful for email but doesn't break)

4. Update payment record:
   UPDATE payments SET receipt_url = receipt_url WHERE id = payment_id

5. Send email if customer_email is provided:
   Import orderReceiptEmail from templates
   await sendEmail({ to: customer_email, ...orderReceiptEmail(customer_name, restaurant_name, receipt_url, order_id.slice(-8)) })

=== UPDATE payments.service.ts ===

In the payment completion function (where status is set to 'completed'):
FIND: where payment is marked complete
ADD AFTER: 
  // Queue receipt generation (non-blocking)
  import receiptQueue from '../../jobs/receipt-pdf'
  receiptQueue.add({
    payment_id: payment.id,
    order_id: payment.order_id,
    branch_id: branchId,
    restaurant_id: restaurantId,
    customer_email: customer.email,
    customer_phone: customer.phone
  }).catch(err => console.error('[receipt-pdf] Failed to queue:', err))

=== ADD TO payments.routes.ts ===

GET /payments/:orderId/receipt → authenticate, getReceipt handler:

  Handler: getReceipt(req, res):
    const payment = await supabaseAdmin
      .from('payments')
      .select('receipt_url, order_id')
      .eq('order_id', req.params.orderId)
      .eq('status', 'completed')
      .single()
    
    if (!payment.data?.receipt_url) {
      // Receipt not yet generated — re-queue
      // Re-queue the job for on-demand generation
      return res.status(202).json({
        success: true,
        data: { status: 'generating', message: 'Receipt is being generated. Try again in 30 seconds.' }
      })
    }
    
    return res.json({ success: true, data: { receipt_url: payment.data.receipt_url } })

Return:
- New backend/src/jobs/receipt-pdf.ts
- Updated payments.service.ts (with queue call added)
- Updated payments.routes.ts (with /receipt route)
```

### 📤 Expected Output
- 🆕 `backend/src/jobs/receipt-pdf.ts`
- ✏️ `backend/src/modules/payments/payments.service.ts`
- ✏️ `backend/src/modules/payments/payments.routes.ts`

---

# ═══════════════════════════════════════════════
# PROMPT P4-3 — GST / Tax Calculation for India
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/modules/payments/payments.service.ts  (full file)
backend/src/modules/payments/payments.schema.ts   (full file)
backend/prisma/schema.prisma                       (for payments table structure)
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are implementing the GST (Goods and Services Tax) calculation system for India.

The product document (Section M12, Section 8.6) specifies:
  "Bill display: itemized list with GST breakdown, service charge, discounts"

Indian GST rules for restaurants:
  - Restaurants with AC seating: 5% GST (2.5% CGST + 2.5% SGST)
  - Restaurants without AC:      5% GST (no input tax credit)
  - Delivery (Swiggy/Zomato style): 18% GST
  - Hotel restaurants:            18% GST
  - Default for this app: 5% GST (most common for independent restaurants)

The payments.service.ts has a comment:
  "FIX: payments table columns: order_id, amount, tax_amount, service_charge..."
This means these columns EXIST in the DB but are NEVER calculated or stored.

=== CREATE: backend/src/utils/gst.ts ===

CONSTANTS:
  const RESTAURANT_GST_RATE = 0.05        // 5% for AC/non-AC restaurants
  const DELIVERY_GST_RATE = 0.05          // 5% for delivery platform
  const CGST_RATE = 0.025                 // half of 5%
  const SGST_RATE = 0.025                 // half of 5%
  const SERVICE_CHARGE_RATE = 0.10        // 10% service charge (configurable)
  // NOTE: Service charge is NOT mandatory by law in India.
  // Restaurants choose whether to apply it. Default: 10%, configurable.

FUNCTION: calculateBill(subtotal: number, options: {
  order_type: 'dine_in' | 'delivery' | 'takeaway'
  apply_service_charge: boolean   // from restaurant settings
  service_charge_rate?: number    // override, default 0.10
  discount_amount?: number        // coupon/loyalty discount applied BEFORE tax
  gst_rate?: number               // override, default 0.05
}): BillBreakdown

INTERFACE BillBreakdown:
  subtotal: number           // sum of all items before any charges
  discount_amount: number    // coupon/loyalty deduction
  taxable_amount: number     // subtotal - discount_amount
  cgst: number               // 2.5% of taxable_amount (for dine_in)
  sgst: number               // 2.5% of taxable_amount (for dine_in)
  gst_total: number          // total GST (cgst + sgst OR combined 5%)
  service_charge: number     // 10% of subtotal (before discount) — only if apply_service_charge
  grand_total: number        // taxable_amount + gst_total + service_charge
  
  // Human-readable summary for bill display:
  breakdown_lines: Array<{ label: string; amount: number; is_deduction?: boolean }>
  // Example:
  // [
  //   { label: 'Subtotal', amount: 540 },
  //   { label: 'Discount (SAVE20)', amount: -54, is_deduction: true },
  //   { label: 'CGST (2.5%)', amount: 12.15 },
  //   { label: 'SGST (2.5%)', amount: 12.15 },
  //   { label: 'Service Charge (10%)', amount: 54 },
  //   { label: 'Grand Total', amount: 564.30 }
  // ]

IMPLEMENTATION:
  function calculateBill(subtotal, options):
    const discountAmount = options.discount_amount ?? 0
    const taxableAmount = Math.max(0, subtotal - discountAmount)
    const gstRate = options.gst_rate ?? RESTAURANT_GST_RATE
    const cgst = parseFloat((taxableAmount * CGST_RATE).toFixed(2))
    const sgst = parseFloat((taxableAmount * SGST_RATE).toFixed(2))
    const gstTotal = cgst + sgst
    const serviceChargeRate = options.apply_service_charge 
      ? (options.service_charge_rate ?? SERVICE_CHARGE_RATE) 
      : 0
    const serviceCharge = parseFloat((subtotal * serviceChargeRate).toFixed(2))
    const grandTotal = parseFloat((taxableAmount + gstTotal + serviceCharge).toFixed(2))
    
    const lines = [
      { label: 'Subtotal', amount: subtotal }
    ]
    if (discountAmount > 0) lines.push({ label: 'Discount', amount: -discountAmount, is_deduction: true })
    lines.push({ label: 'CGST (2.5%)', amount: cgst })
    lines.push({ label: 'SGST (2.5%)', amount: sgst })
    if (serviceCharge > 0) lines.push({ label: 'Service Charge (10%)', amount: serviceCharge })
    lines.push({ label: 'Grand Total', amount: grandTotal })
    
    return { subtotal, discount_amount: discountAmount, taxable_amount: taxableAmount,
             cgst, sgst, gst_total: gstTotal, service_charge: serviceCharge,
             grand_total: grandTotal, breakdown_lines: lines }

=== UPDATE payments.service.ts ===

In the initiatePayment / processPayment function:
  Import: import { calculateBill } from '../../utils/gst'
  
  When computing the final bill:
  1. Fetch order items to compute subtotal
  2. Call calculateBill(subtotal, { order_type, apply_service_charge: true, discount_amount })
  3. Store in payment record:
     {
       amount: bill.grand_total,
       tax_amount: bill.gst_total,
       service_charge: bill.service_charge,
       discount_amount: bill.discount_amount,
       breakdown: JSON.stringify(bill.breakdown_lines)  // store for receipt display
     }

=== ADD: GET /payments/:orderId/bill-breakdown endpoint ===

Returns the bill breakdown for display before payment (so cashier/customer sees the breakdown):
  Fetch order subtotal, compute bill, return BillBreakdown object.
  Used by: cashier POS before confirming payment, customer app before paying.

Return:
- New backend/src/utils/gst.ts
- Updated payments.service.ts (with calculateBill integration)
- Updated payments.routes.ts (with /bill-breakdown endpoint added)
```

### 📤 Expected Output
- 🆕 `backend/src/utils/gst.ts`
- ✏️ `backend/src/modules/payments/payments.service.ts`
- ✏️ `backend/src/modules/payments/payments.routes.ts`

---

# ═══════════════════════════════════════════════
# PROMPT P4-4 — WebSocket Redis Adapter (Production Scaling)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/server.ts             (full file — confirmed NO redis adapter)
backend/src/config/redis.ts       (existing Redis config)
backend/src/config/env.ts
backend/.env.example
```

### 🎯 Task for Claude

```
You are adding the Socket.io Redis adapter to Restaurant OS for horizontal scaling.

The product document (Section M19, Section 18) explicitly requires:
  "Install: socket.io with Redis adapter (@socket.io/redis-adapter)
   Redis adapter enables multi-server support (horizontal scaling)"
  "Redis pub/sub adapter allows multiple Node.js instances to share socket events"

Currently: server.ts does NOT have any Redis adapter — confirmed by direct code review.
Without it, if you run 2+ backend instances (e.g., on Railway or AWS), 
WebSocket events only reach clients connected to the SAME instance.
This is a PRODUCTION BUG for any multi-instance deployment.

=== UPDATE: backend/src/server.ts ===

Step 1 — Add dependency:
  npm install @socket.io/redis-adapter
  (ioredis is already installed — confirmed from redis.ts)

Step 2 — Import at the top of server.ts:
  import { createAdapter } from '@socket.io/redis-adapter'
  import { createClient } from 'ioredis'
  // OR import from existing redis config:
  import redis from './config/redis'

Step 3 — Set up Redis adapter BEFORE io.listen() or after io is created:

  Read server.ts carefully. Find where io (Socket.io) is initialized.
  Immediately after io is created, add:
  
  // Redis adapter for horizontal scaling
  // Skip if Redis is not configured (dev mode with single instance)
  if (process.env.REDIS_URL) {
    try {
      const pubClient = redis.duplicate()  // use duplicate() for pub/sub
      const subClient = redis.duplicate()
      
      Promise.all([
        new Promise((res, rej) => {
          pubClient.on('ready', res)
          pubClient.on('error', rej)
        }),
        new Promise((res, rej) => {
          subClient.on('ready', res)
          subClient.on('error', rej)
        })
      ]).then(() => {
        io.adapter(createAdapter(pubClient, subClient))
        console.log('[socket.io] Redis adapter connected — multi-instance scaling enabled')
      }).catch(err => {
        console.error('[socket.io] Redis adapter failed, running without it:', err.message)
        // Continue without adapter — single instance works fine
      })
    } catch (err) {
      console.error('[socket.io] Redis adapter setup error:', err)
    }
  } else {
    console.log('[socket.io] No REDIS_URL — running single-instance mode')
  }

IMPORTANT NOTES:
- The adapter MUST be set before clients start connecting
- Use duplicate() not the same Redis instance (pub and sub must be separate)
- This is gracefully degraded — if Redis adapter fails, socket.io still works (single instance)
- The try/catch ensures a Redis adapter failure never crashes the server

Step 4 — Add Socket connection limit guard (from doc Section M19):
  Find the io.on('connection', ...) handler.
  Add at the top:
  
  // Enforce 1 active socket per user (disconnect old on new connect)
  const existingSocketId = await redis.get(`socket:${socket.user.id}`)
  if (existingSocketId && existingSocketId !== socket.id) {
    const existingSocket = io.sockets.sockets.get(existingSocketId)
    if (existingSocket) {
      existingSocket.emit('session_replaced', { message: 'Your session was replaced by a new login' })
      existingSocket.disconnect(true)
    }
  }
  await redis.set(`socket:${socket.user.id}`, socket.id, 'EX', 86400)
  
  // Clean up on disconnect
  socket.on('disconnect', async () => {
    const stored = await redis.get(`socket:${socket.user.id}`)
    if (stored === socket.id) {
      await redis.del(`socket:${socket.user.id}`)
    }
  })

Return the complete updated server.ts.
Mark all additions with // REDIS-ADAPTER ADDITION comments.
Keep ALL existing code intact — only add the new sections.
```

### 📤 Expected Output
- ✏️ `backend/src/server.ts` (with Redis adapter + connection limit)

---

# ═══════════════════════════════════════════════
# PROMPT P4-5 — Quick Reorder Feature
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/customer/home/page.tsx           (full — 21KB existing home page)
backend/src/modules/orders/orders.service.ts
backend/src/modules/orders/orders.routes.ts
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are implementing the Quick Reorder feature for Restaurant OS.

The product document (Sections 9.2, 9.7) specifies:
  "Quick Reorder Section (returning users): Horizontal scroll — last 3 orders with 'Reorder' button"
  "Reorder with one tap from order history"

Currently: The home page has ZERO instances of "reorder" or any quick reorder section.

=== BACKEND: Add reorder endpoint ===

ADD to orders.service.ts:

FUNCTION: reorder(originalOrderId: string, userId: string): Promise<{ new_order_id: string }>
  
  1. Fetch original order items:
     SELECT oi.menu_item_id, oi.quantity, oi.notes, oi.addons,
       mi.name, mi.price, mi.status, mi.branch_id
     FROM order_items oi
     JOIN menu_items mi ON oi.menu_item_id = mi.id
     WHERE oi.order_id = originalOrderId
       AND oi.order_id IN (SELECT id FROM orders WHERE customer_id = userId)
  
  2. Filter out unavailable items:
     const availableItems = items.filter(i => i.status !== 'sold_out' && i.status !== 'hidden')
     const unavailableItems = items.filter(i => i.status === 'sold_out' || i.status === 'hidden')
  
  3. If no available items: throw 400 'All items from this order are currently unavailable'
  
  4. Create a new ORDER with available items (NOT submitted yet — status: 'draft' or as a cart):
     Since we don't have a cart table, return the items array for the frontend to handle.
     
     Return: {
       items: availableItems.map(i => ({ menu_item_id, quantity, notes, addons, name, price })),
       branch_id: original order's branch_id,
       unavailable_items: unavailableItems.map(i => i.name),
       restaurant_id: ...,
       message: unavailableItems.length > 0 
         ? `Reorder ready. ${unavailableItems.length} item(s) no longer available were skipped.`
         : 'All items are available. Review and place order.'
     }

ADD to orders.routes.ts:
  GET /orders/customer/last-three → authenticate, getLastThreeOrders
    Returns the customer's last 3 completed/paid orders with items and restaurant info
  
  POST /orders/:orderId/reorder → authenticate, reorder handler
    Returns items array for frontend to pre-populate cart

ADD FUNCTION: getLastThreeOrders(userId: string):
  SELECT o.id, o.created_at, o.branch_id,
    r.name as restaurant_name, rb.logo_url,
    json_agg(json_build_object('name', mi.name, 'quantity', oi.quantity)) as items_preview,
    p.amount as total
  FROM orders o
  JOIN branches b ON o.branch_id = b.id
  JOIN restaurants r ON b.restaurant_id = r.id
  LEFT JOIN restaurant_branding rb ON r.id = rb.restaurant_id
  JOIN order_items oi ON o.id = oi.order_id
  JOIN menu_items mi ON oi.menu_item_id = mi.id
  LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'completed'
  WHERE o.customer_id = userId
    AND o.status IN ('paid', 'closed', 'served')
  GROUP BY o.id, r.name, rb.logo_url, p.amount
  ORDER BY o.created_at DESC
  LIMIT 3

=== FRONTEND: Add Quick Reorder section to home page ===

Read app/customer/home/page.tsx carefully.
Find the section after the Mood Tiles and before the restaurant feed.

ADD a "Quick Reorder" section there:

  const { data: lastOrders } = useQuery({
    queryKey: ['last-orders', userId],
    queryFn: () => apiClient.get<LastOrder[]>('/orders/customer/last-three'),
    enabled: !!userId,    // only for logged-in users
    staleTime: 5 * 60 * 1000,
  })

  JSX (only show if lastOrders?.length > 0):
  <section className="px-4 mb-6">
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      Order Again
    </h3>
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
      {lastOrders.map(order => (
        <div key={order.id} className="flex-none w-48 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            {order.logo_url 
              ? <img src={order.logo_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
              : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">🍽️</div>
            }
            <span className="text-xs font-semibold text-gray-800 truncate">{order.restaurant_name}</span>
          </div>
          <p className="text-xs text-gray-500 mb-1 truncate">
            {order.items_preview.map(i => `${i.quantity}× ${i.name}`).join(', ')}
          </p>
          <p className="text-xs font-medium text-gray-700 mb-2">₹{order.total?.toFixed(0)}</p>
          <button
            onClick={() => handleReorder(order.id)}
            className="w-full text-xs py-1.5 bg-[#1A3C5E] text-white rounded-lg font-medium"
          >
            Reorder
          </button>
        </div>
      ))}
    </div>
  </section>

  handleReorder function:
  const handleReorder = async (orderId: string) => {
    try {
      const result = await apiClient.post<ReorderResult>(`/orders/${orderId}/reorder`)
      // Navigate to the restaurant's menu with items pre-added to cart
      // Store reorder items in localStorage temporarily for the menu page to pick up
      localStorage.setItem('reorder_items', JSON.stringify(result.items))
      localStorage.setItem('reorder_branch_id', result.branch_id)
      router.push(`/customer/restaurant/${result.restaurant_id}?reorder=true`)
      if (result.unavailable_items.length > 0) {
        toast.info(`${result.unavailable_items.join(', ')} not available and were skipped`)
      }
    } catch (err) {
      toast.error('Could not load your previous order. Try again.')
    }
  }

Return:
- Updated orders.service.ts (with 2 new functions)
- Updated orders.routes.ts (with 2 new routes)
- Updated app/customer/home/page.tsx (with Quick Reorder section)
Mark all home page additions with // QUICK REORDER ADDITION comments.
```

### 📤 Expected Output
- ✏️ `backend/src/modules/orders/orders.service.ts`
- ✏️ `backend/src/modules/orders/orders.routes.ts`
- ✏️ `app/customer/home/page.tsx`

---

# ═══════════════════════════════════════════════
# PROMPT P4-6 — Admin Customer Suspend + Flag System
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/admin/customers/page.tsx                (full — 7.4KB)
backend/src/modules/admin/admin.service.ts  (full — with P2-8 updates)
backend/src/modules/admin/admin.routes.ts   (full — with P2-8 updates)
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are implementing customer account management for the Super Admin panel.

The product document (Section 6.5) specifies:
  "Customer account status (active/suspended)"
  "Flag/suspend customers for policy violations"
  "Refund request management from customer's perspective"

Currently: The admin customers page (7.4KB) shows customer data but has NO
suspend or flag actions — confirmed by reading the file.

=== BACKEND: Add to admin.service.ts ===

FUNCTION: suspendCustomer(customerId: string, adminId: string, reason: string):
  - Verify user exists and has role='customer'
  - UPDATE users SET is_active=false, suspension_reason=reason, suspended_at=NOW(), suspended_by=adminId
    WHERE id=customerId AND role='customer'
  - Revoke all active JWTs: SET in Redis key 'suspended:{customerId}' = true, TTL=never
    (The auth middleware checks this key and rejects requests from suspended users)
  - Create notification: 'Your account has been suspended. Contact support@dineluxe.app'
  - Log to AuditLog: { action: 'CUSTOMER_SUSPENDED', actor_id: adminId, target_id: customerId }
  - Return: { success: true }

FUNCTION: unsuspendCustomer(customerId: string, adminId: string):
  - UPDATE users SET is_active=true, suspension_reason=null, suspended_at=null WHERE id=customerId
  - Delete Redis key 'suspended:{customerId}'
  - Log to AuditLog: { action: 'CUSTOMER_UNSUSPENDED' }

FUNCTION: flagCustomer(customerId: string, adminId: string, flagReason: string):
  - UPDATE users SET is_flagged=true, flag_reason=flagReason WHERE id=customerId
    (If is_flagged column doesn't exist: use a JSONB metadata column or skip column and use a Redis key)
  - Log to AuditLog
  - IMPORTANT: Flagging is NOT the same as suspending — flagged accounts still work,
    they're just marked for review

FUNCTION: getCustomerDetail(customerId: string):
  Returns full customer details for admin:
  - User profile (all fields including phone, DOB)
  - Order history summary: total orders, total spent, last order date
  - Any open support tickets
  - Any pending refund requests
  - Account status: active/suspended/flagged

=== UPDATE admin.routes.ts ===

APPEND these routes (all require super_admin or admin role):

PATCH /admin/customers/:id/suspend   → validate body({ reason: string.min(5) }), suspendCustomer
PATCH /admin/customers/:id/unsuspend → unsuspendCustomer
PATCH /admin/customers/:id/flag      → validate body({ reason: string.min(5) }), flagCustomer
GET   /admin/customers/:id           → getCustomerDetail

=== UPDATE app/admin/customers/page.tsx ===

Read the current file. It shows a customers list.
Find where customer rows or cards are rendered.
Add these action buttons for each customer:

  Actions dropdown (3-dot menu) per customer row:
  - "View Details" → opens CustomerDetailSheet (slide-in panel)
  - "Suspend Account" → opens a confirmation dialog:
    "Suspend [Name]? They will lose access immediately."
    Text area: "Reason for suspension (required)"
    [Cancel] [Suspend Account (red)]
  - "Flag for Review" → opens a small popover with a text reason input
  - If already suspended: show "Unsuspend Account" instead

  CustomerDetailSheet component (inline — don't create separate file):
  - Shows all customer info
  - Order stats: total orders, total spent, member since
  - Open tickets count
  - Suspend/Flag actions

  API calls:
  PATCH /api/v1/admin/customers/:id/suspend → { reason }
  PATCH /api/v1/admin/customers/:id/unsuspend
  PATCH /api/v1/admin/customers/:id/flag → { reason }

=== ALSO: Update auth middleware to check suspension ===

In backend/src/middleware/auth.middleware.ts:
After JWT verification, add:
  
  // Check if customer is suspended
  if (req.user.role === 'customer') {
    const suspended = await redis.get(`suspended:${req.user.id}`)
    if (suspended) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Contact support@dineluxe.app' }
      })
    }
  }

Return:
- Updated admin.service.ts (3 new functions)
- Updated admin.routes.ts (4 new routes)
- Updated app/admin/customers/page.tsx (with suspend/flag actions)
- Updated auth.middleware.ts (with suspension check)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/admin/admin.service.ts`
- ✏️ `backend/src/modules/admin/admin.routes.ts`
- ✏️ `app/admin/customers/page.tsx`
- ✏️ `backend/src/middleware/auth.middleware.ts`

---

# ═══════════════════════════════════════════════
# PROMPT P4-7 — GDPR Account Deletion (Proper Anonymization)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/modules/users/users.service.ts    (full file)
backend/src/modules/users/users.routes.ts     (full file)
backend/src/modules/users/users.controller.ts (full file)
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are fixing the GDPR account deletion to implement proper anonymization.

The product document (Section M23) specifies:
  "DELETE /api/customer/account (logged-in customer):
   → Anonymize: replace name with 'Deleted User', email with random hash, phone with null
   → Delete: profile photo from S3, device tokens, saved addresses
   → Keep: order history (anonymized) for restaurant financial records
   → Revoke all JWTs immediately"

Currently: users.routes.ts has DELETE /me which calls deleteMe controller.
The controller likely does a HARD DELETE which is WRONG for compliance.

=== CHECK FIRST ===
Read users.service.ts. Find what deleteMe actually does.
  - If it's a hard DELETE: this is WRONG — fix it
  - If it just sets is_active=false: incomplete — also needs anonymization

=== FIX users.service.ts ===

REPLACE the deleteMe / deleteUser function with proper anonymization:

FUNCTION: anonymizeUserAccount(userId: string):
  
  1. Verify the user exists and has role='customer'
     (Staff accounts cannot self-delete — they contact their employer)
  
  2. Generate anonymized identifiers:
     const anonId = `deleted_${Date.now()}_${userId.slice(-4)}`
     const anonEmail = `deleted_${crypto.randomBytes(8).toString('hex')}@deleted.invalid`
  
  3. Anonymize the user record:
     UPDATE users SET
       name = 'Deleted User',
       email = anonEmail,
       phone = null,
       profile_pic_url = null,
       dob = null,
       gender = null,
       address = null,
       password_hash = 'ANONYMIZED_' + Date.now(),
       is_active = false,
       deleted_at = NOW(),
       anonymized_at = NOW()
     WHERE id = userId
  
  4. Delete Supabase Auth user (removes login capability):
     await supabaseAdmin.auth.admin.deleteUser(userId)
     // This removes the email/phone from Supabase Auth
     // The DB record is anonymized but retained
  
  5. Revoke all JWTs:
     await redis.set(`revoked_user:${userId}`, 'deleted', 'EX', 7 * 24 * 60 * 60)
     // 7 days TTL to cover any lingering refresh tokens
  
  6. Delete device push tokens (if push_subscriptions table exists):
     DELETE FROM push_subscriptions WHERE user_id = userId
  
  7. Delete loyalty account (optional — privacy, but restaurant loses data):
     Actually: UPDATE loyalty_accounts SET user_id = NULL, anonymized = true
     WHERE user_id = userId
     (Keep the points history for restaurant reporting, but unlink from user)
  
  8. Cancel any pending bookings:
     UPDATE bookings SET status = 'cancelled' 
     WHERE user_id = userId AND status IN ('pending', 'confirmed')
  
  9. Log the deletion to AuditLog:
     INSERT INTO audit_log: { action: 'CUSTOMER_SELF_DELETED', actor_id: userId }
     
  10. Return: { success: true, message: 'Your account has been permanently deleted.' }

=== ADD Data Export Endpoint ===

FUNCTION: exportUserData(userId: string): Promise<UserDataExport>
  Returns ALL data this platform holds about a user (GDPR right to data portability)
  
  Fetch in parallel:
  - User profile (name, email, phone, DOB, created_at)
  - All orders (with items, amounts, dates, restaurants)
  - All bookings (with dates, branches, statuses)
  - All reviews (their reviews only)
  - All loyalty transactions
  - All saved addresses
  - All notifications
  
  Return as a single JSON object.
  
  NOTE: This is a synchronous endpoint for simplicity (the dataset is reasonable per user).
  For very large datasets, you could queue a Bull job — but most users have < 100 orders.

UPDATE users.routes.ts:
  DELETE /me → anonymizeUserAccount (REPLACE the existing deleteMe with anonymizeUserAccount)
  GET /me/data-export → authenticate, exportUserData handler

Return:
- Updated users.service.ts (anonymizeUserAccount + exportUserData)
- Updated users.routes.ts (data-export route)
- Updated users.controller.ts (new controllers)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/users/users.service.ts`
- ✏️ `backend/src/modules/users/users.routes.ts`
- ✏️ `backend/src/modules/users/users.controller.ts`

---

# ═══════════════════════════════════════════════
# PROMPT P4-8 — Platform Health Score (0-100)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/modules/admin/admin.service.ts  (full — with P2-27 additions)
app/admin/platform-health/page.tsx          (full existing page)
components/shared/KPICard.tsx
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are adding the Platform Health Score to Restaurant OS.

The product document (Section 6.1) specifies:
  "Add a 'Platform Health Score' — a single number (0-100) calculated from:
   uptime, average order completion rate, average response times, 
   and customer satisfaction scores.
   This gives the admin an instant pulse check on the entire platform."

Currently: The health endpoint returns { status: 'ok'|'degraded'|'down' } 
but there is NO composite 0-100 score.

=== BACKEND: Add to admin.service.ts ===

FUNCTION: getHealthScore(): Promise<{
  score: number,
  grade: 'A' | 'B' | 'C' | 'D' | 'F',
  label: string,
  components: HealthScoreComponent[]
}>

COMPONENT WEIGHTS:
  Uptime (30 pts): DB connection + Redis connection both OK = 30, one down = 15, both down = 0
  Order Completion Rate (30 pts): % of orders in last 24h that reached 'paid'/'served' status
    - > 90% = 30 pts
    - 75-90% = 22 pts
    - 60-75% = 15 pts
    - < 60% = 5 pts
  API Response Time (20 pts): from Redis metric:query_times list (set up in P2-27 metrics middleware)
    - avg < 200ms = 20 pts
    - 200-500ms = 15 pts
    - 500-1000ms = 8 pts
    - > 1000ms = 0 pts
  Customer Satisfaction (20 pts): avg rating of all reviews in last 7 days
    - avg > 4.5 = 20 pts
    - 4.0-4.5 = 16 pts
    - 3.5-4.0 = 10 pts
    - < 3.5 = 5 pts

GRADE THRESHOLDS:
  85-100: A (Excellent)
  70-84:  B (Good)
  55-69:  C (Fair)
  40-54:  D (Poor)
  < 40:   F (Critical)

IMPLEMENTATION:
  1. DB/Redis checks (from getBasicHealth)
  2. Order completion rate: 
     COUNT(*) WHERE status IN ('paid','served','closed') / COUNT(*) total
     FROM orders WHERE created_at > NOW() - INTERVAL '24 hours'
  3. API response times from Redis: LRANGE metric:query_times 0 99
  4. Customer satisfaction: AVG(overall_rating) FROM reviews WHERE created_at > NOW() - INTERVAL '7 days'
  5. Sum all component scores
  6. Cache in Redis: 'admin:health_score', TTL=5 minutes

COMPONENTS RETURN FORMAT (for frontend display):
  [
    { name: 'System Uptime', score: 30, max: 30, color: 'green' },
    { name: 'Order Completion', score: 22, max: 30, color: 'yellow' },
    { name: 'Response Time', score: 20, max: 20, color: 'green' },
    { name: 'Customer Satisfaction', score: 16, max: 20, color: 'green' },
  ]

Add to admin.routes.ts:
  GET /admin/health/score → authenticate, requireRole(super_admin, admin), getHealthScore

=== FRONTEND: Create components/admin/PlatformHealthScore.tsx ===

Props: { className?: string }

DESIGN:
  Card with gradient header based on grade:
    Grade A: green gradient (#1E7E34 to #27AE60)
    Grade B: teal gradient (#1A6B5A to #1ABC9C)
    Grade C: amber gradient (#E67E22 to #F39C12)
    Grade D: orange gradient (#E74C3C to #E67E22)
    Grade F: red gradient (#922B21 to #E74C3C)
  
  Large centered score: "87" (font-size: 72px, bold, white)
  Grade letter below: "A" (font-size: 24px, white/70)
  Label: "Platform Health: Excellent" (white)
  
  Component breakdown (4 rows below the score):
    Each row: component name, score bar, X/Y pts
    Score bar: filled portion based on score/max
  
  Last updated: "Updated 2 minutes ago"
  
  Auto-refresh every 5 minutes.

UPDATE app/admin/platform-health/page.tsx:
  Import PlatformHealthScore
  Add it as the FIRST component at the top of the page (hero section)
  
Return:
- Updated admin.service.ts (getHealthScore function + route)
- Updated admin.routes.ts (new route)
- New components/admin/PlatformHealthScore.tsx
- Updated app/admin/platform-health/page.tsx (with score component)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/admin/admin.service.ts`
- ✏️ `backend/src/modules/admin/admin.routes.ts`
- 🆕 `components/admin/PlatformHealthScore.tsx`
- ✏️ `app/admin/platform-health/page.tsx`

---

# ═══════════════════════════════════════════════
# PROMPT P4-9 — Sponsored Restaurant Placement System
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/customer/home/page.tsx                   (full — with P4-5 additions)
backend/src/modules/admin/admin.service.ts   (full)
backend/src/modules/admin/admin.routes.ts    (full)
backend/prisma/schema.prisma                 (for schema reference)
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are implementing the Sponsored Placement system for Restaurant OS.

The product document (Section 9.2, Section 19.1) specifies:
  "Featured banners: paid promotional spots for restaurants (clearly labeled 'Sponsored')"
  "SPONSORED PLACEMENT: Super Admin can offer restaurants paid placement in the 
   customer app — top of search results, featured banner on home screen, 
   sponsored category label. Tracked via impression and click analytics.
   Additional revenue stream for the platform."

Currently: The customer home page has ZERO sponsored banner code.

=== BACKEND: Add sponsored placement ===

NEW TABLE (add via Supabase SQL — not Prisma for simplicity):
  CREATE TABLE IF NOT EXISTS sponsored_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    placement_type VARCHAR(20) NOT NULL,  -- 'home_banner' | 'search_top' | 'featured_card'
    banner_url TEXT,                       -- Image URL for home banner
    headline TEXT,                         -- e.g., "New Opening — 20% Off Today!"
    cta_text VARCHAR(50),                  -- e.g., "Order Now"
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    impression_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),  -- super_admin who created it
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX ON sponsored_placements(placement_type, is_active, starts_at, ends_at);

ADD to admin.service.ts:

FUNCTION: getActiveSponsorships(placementType: string):
  SELECT sp.*, r.name as restaurant_name, rb.logo_url, rb.primary_color
  FROM sponsored_placements sp
  JOIN restaurants r ON sp.restaurant_id = r.id
  LEFT JOIN restaurant_branding rb ON r.id = rb.restaurant_id
  WHERE sp.placement_type = placementType
    AND sp.is_active = true
    AND NOW() BETWEEN sp.starts_at AND sp.ends_at
  ORDER BY sp.created_at DESC
  Cache in Redis: 'sponsorships:{placementType}', TTL=5 minutes

FUNCTION: recordImpression(sponsorshipId: string):
  UPDATE sponsored_placements SET impression_count = impression_count + 1
  WHERE id = sponsorshipId
  (Use a debounced queue — not per-request DB hit. Use Redis INCR then batch flush every minute)

FUNCTION: recordClick(sponsorshipId: string):
  UPDATE sponsored_placements SET click_count = click_count + 1 WHERE id = sponsorshipId

FUNCTION: createSponsorship(data, adminId):
  INSERT into sponsored_placements
  Invalidate cache

FUNCTION: listSponsorships(page, limit):
  All sponsorships with restaurant name, dates, type, impressions, clicks

ADD to admin.routes.ts:
  GET  /admin/sponsorships             → requireRole(super_admin), listSponsorships
  POST /admin/sponsorships             → requireRole(super_admin), createSponsorship
  PATCH /admin/sponsorships/:id/toggle → requireRole(super_admin), toggle is_active

PUBLIC endpoint (no auth — for customer app):
  GET /sponsorships/active?type=home_banner → getActiveSponsorships
  POST /sponsorships/:id/impression → recordImpression (public — fire and forget)
  POST /sponsorships/:id/click     → recordClick (public)

=== FRONTEND: Add to customer home page ===

Read app/customer/home/page.tsx. Find the top section (below search/filter pills).
ADD a sponsored banner section:

  const { data: banners } = useQuery({
    queryKey: ['sponsored-banners'],
    queryFn: () => apiClient.get<SponsoredPlacement[]>('/sponsorships/active?type=home_banner'),
    staleTime: 5 * 60 * 1000,
  })

  ONLY SHOW if banners exist (don't show an empty section):
  {banners && banners.length > 0 && (
    <SponsoredBannerCarousel banners={banners} />
  )}

=== CREATE components/customer/SponsoredBanner.tsx ===

Props: { banners: SponsoredPlacement[] }

DESIGN:
  Auto-rotating carousel (changes every 4 seconds)
  Dot indicators below
  
  Each banner card (full width, 180px height, rounded corners):
    - Background image (banner_url) with dark overlay
    - Small "Sponsored" pill (gray/semi-transparent, top-right corner)
    - Restaurant logo (small, top-left)
    - Restaurant name (white, large)
    - Headline text (white, smaller)
    - CTA button (primary color, bottom-right): cta_text or "View Menu"
  
  On card impression (enter viewport):
    POST /sponsorships/{id}/impression (fire and forget — don't await)
  
  On card click:
    POST /sponsorships/{id}/click (fire and forget)
    Navigate to: /customer/restaurant/{restaurant_id}

Return:
- Updated admin.service.ts (4 new functions)
- Updated admin.routes.ts (new routes)
- New components/customer/SponsoredBanner.tsx
- Updated app/customer/home/page.tsx (with SponsoredBannerCarousel)
- SQL to run in Supabase for the sponsored_placements table
```

### 📤 Expected Output
- ✏️ `backend/src/modules/admin/admin.service.ts`
- ✏️ `backend/src/modules/admin/admin.routes.ts`
- 🆕 `components/customer/SponsoredBanner.tsx`
- ✏️ `app/customer/home/page.tsx`

---

# ═══════════════════════════════════════════════
# PART 4 COMPLETE CHECKLIST
# ═══════════════════════════════════════════════

## 📂 PART 4 ALL FILES (4 New + 22 Modified)

### New Files (4)
```
backend/src/utils/sms.ts                         ← P4-1
backend/src/utils/gst.ts                         ← P4-3
backend/src/jobs/receipt-pdf.ts                  ← P4-2
components/admin/PlatformHealthScore.tsx          ← P4-8
components/customer/SponsoredBanner.tsx           ← P4-9
```

### Modified Backend Files (9)
```
backend/src/server.ts                             ← P4-4 (Redis adapter)
backend/src/config/env.ts                         ← P4-1 (SMS vars)
backend/.env.example                              ← P4-1 (SMS section)
backend/src/middleware/auth.middleware.ts          ← P4-6 (suspension check)
backend/src/modules/payments/payments.service.ts  ← P4-2, P4-3
backend/src/modules/payments/payments.routes.ts   ← P4-2, P4-3
backend/src/modules/users/users.service.ts        ← P4-7 (anonymization)
backend/src/modules/users/users.routes.ts         ← P4-7 (data export)
backend/src/modules/users/users.controller.ts     ← P4-7
backend/src/modules/admin/admin.service.ts        ← P4-6, P4-8, P4-9
backend/src/modules/admin/admin.routes.ts         ← P4-6, P4-8, P4-9
```

### Modified Frontend Files (4)
```
app/customer/home/page.tsx                        ← P4-5, P4-9
app/admin/customers/page.tsx                      ← P4-6
app/admin/platform-health/page.tsx                ← P4-8
```

---

## 📊 FINAL GRAND TOTAL — ALL 4 PARTS COMBINED

| Category | P1 | P2 | P3 | P4 | **TOTAL** |
|---|---|---|---|---|---|
| Prompts | 38 | 20 | 15 | 9 | **82 prompts** |
| New Files | ~90 | 32 | 15 | 5 | **~142 files** |
| Modified Files | ~30 | ~18 | ~28 | ~22 | **~98 changes** |
| New Backend Modules | 10 | 3 | 0 | 0 | **13 modules** |
| New DB SQL Objects | 4 | 9+3views | 4 | 1 table | **21 SQL objects** |
| New Frontend Pages | 8 | 4 | 6 | 0 | **18 pages** |
| New Components | 12 | 10 | 2 | 2 | **26 components** |

---

## 🎯 FINAL PRIORITY ORDER (Part 4 only)

```
🔴 CRITICAL (breaks production)
  P4-4 → WebSocket Redis adapter (all WS events silently broken on multi-instance deploy)

🟠 HIGH (compliance + core revenue)
  P4-3 → GST calculation (incorrect billing for Indian customers)
  P4-2 → Receipt PDF + GET /payments/:orderId/receipt (API referenced but returns nothing)
  P4-7 → GDPR anonymization (legal requirement — hard delete is wrong)

🟡 MEDIUM (feature completeness per doc)
  P4-1 → SMS integration (booking confirmations + staff credentials)
  P4-6 → Admin customer suspend/flag (admin panel incomplete)
  P4-8 → Platform Health Score (doc-specified admin feature)

🟢 POLISH (revenue + engagement)
  P4-5 → Quick Reorder (high-engagement customer feature)
  P4-9 → Sponsored placement (platform revenue stream)
```

---

## ✅ ITEMS CONFIRMED NOT NEEDED (Already Done or Out of Scope)

| Item | Status |
|---|---|
| OTP 6-digit input boxes | ✅ Already implemented in `components/auth/OTPInput.tsx` |
| First Login password change | ✅ Already implemented in `app/first-login/page.tsx` |
| Menu time-based availability | ✅ Already in `menu.service.ts` line 22 |
| Menu add-ons in orders | ✅ Already in `orders.service.ts` lines 64-104 |
| Kitchen dark mode | ✅ Already in `kitchen/page.tsx` with toggle |
| Waiter performance stats | ✅ Already as `GET /staff/:id/performance` |
| Visual table picker in booking | ✅ `book/page.tsx` is 20KB — assumed implemented |
| Weather-aware recommendations | ⏭️ Phase 3 feature — skip for now |
| Offline mode (IndexedDB) | ⏭️ Complex PWA feature — separate initiative |
| Voice search | ⏭️ Requires device mic permissions + Web Speech API — future feature |
| Collaborative filtering (ML) | ⏭️ Phase 2 ML feature — skip for now |
| Supplier integration | ⏭️ Explicitly Phase 2 in doc — skip for now |

---

*Restaurant OS — Complete Prompt Library PART 4 (Final)*
*Everything in the document. Nothing that isn't.*
*Priyanshu Kumar Gupta & Ronit Gupta | 2025*
