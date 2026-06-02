# 🍽️ Restaurant OS — Prompt Library PART 5
## The True Final Gaps — Verified Line-by-Line Against Both Documents and All Code
**Priyanshu Kumar Gupta & Ronit Gupta | 2025**

---

## 🔬 FINAL VERIFICATION RESULT

After reading **every line of both DOCX files** and running **grep searches on every source file** across all 5 ZIP archives, cross-referenced against all prompts in Parts 1–4:

| Item | Confirmed By | Status |
|---|---|---|
| DB Indexes | `grep "@@index"` → **35 indexes already in schema.prisma** | ✅ Already done — no prompt needed |
| OTP digit boxes | `OTPInput.tsx` — fully implemented | ✅ Already done |
| First login flow | `app/first-login/page.tsx` + `FirstLoginForm.tsx` exist | ✅ Already done |
| Dark mode KDS | `kitchen/page.tsx` has darkMode state toggle | ✅ Already done |
| FCM Push | `grep "firebase"` → **0 files in backend/src/** | ❌ MISSING |
| Call Waiter button | `grep "callWaiter"` → **0 files in customer app** | ❌ MISSING |
| Review photo upload | `PostOrderRating.tsx` has UI slots but no S3 upload | ❌ MISSING |
| Refund status tracker | `grep "refund"` in profile/page.tsx → **0 mentions** | ❌ MISSING |

**Four remaining items. After these — the document is fully covered.**

---

# ═══════════════════════════════════════════════
# PROMPT P5-1 — Firebase Cloud Messaging (FCM) Push
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
backend/src/utils/push.ts                         (from Part 1 P1-36 — Web Push util)
backend/src/modules/notifications/notifications.service.ts
backend/src/config/env.ts
backend/.env.example
public/sw.js                                      (service worker from Part 1)
```

### 🎯 Task for Claude

```
You are adding Firebase Cloud Messaging (FCM) to Restaurant OS.

The product document (Section 16) explicitly states:
  "Push Notifications: Firebase Cloud Messaging (Android & iOS)"
  "Food ready → Waiter (push + WebSocket)"
  "Delivery partner assigned → Customer (push)"

Currently: We implemented Web Push with VAPID keys (Part 1 P1-36).
Web Push works on desktops and Android Chrome but DOES NOT work on iOS Safari.

Since staff (waiters, chefs) use the app on iPhones, FCM is required.

STRATEGY: Use BOTH — FCM for mobile apps (iOS + Android), Web Push for desktop.

=== CREATE: backend/src/utils/fcm.ts ===

Dependencies (note for package.json):
  npm install firebase-admin

Import pattern:
  import * as admin from 'firebase-admin'

INITIALIZE (once, singleton):
  let initialized = false
  
  function initFCM() {
    if (initialized || !process.env.FIREBASE_PROJECT_ID) return
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    })
    initialized = true
  }

FUNCTION: sendFCMNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<void>

  initFCM()
  if (!admin.apps.length) {
    console.warn('[FCM] Firebase not configured — skipping push')
    return
  }
  
  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: { title, body },
    data: data || {},
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'restaurant_alerts',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      }
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        }
      }
    }
  }
  
  try {
    await admin.messaging().send(message)
  } catch (err: any) {
    if (err.code === 'messaging/registration-token-not-registered') {
      // Token is stale — remove from DB
      await removeStaleToken(fcmToken)
    }
    console.error('[FCM] Send failed:', err.message)
  }

FUNCTION: sendFCMToMultiple(fcmTokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void>
  
  If no tokens: return early
  Max 500 per batch (FCM limit)
  Use admin.messaging().sendEachForMulticast({ tokens, notification: { title, body }, data })
  Filter out failed tokens (code: 'messaging/registration-token-not-registered')

FUNCTION: removeStaleToken(token: string): Promise<void>
  DELETE FROM push_subscriptions WHERE subscription_data->>'endpoint' = token
  (or WHERE fcm_token = token if using a separate column)

=== UPDATE: backend/src/modules/notifications/notifications.service.ts ===

ADD: storeFCMToken(userId: string, fcmToken: string): Promise<void>
  UPSERT into push_subscriptions:
    { user_id: userId, subscription_data: { type: 'fcm', token: fcmToken }, device_type: 'mobile' }
    ON CONFLICT (user_id, type): update the token

UPDATE: sendPush (the main push function) to try BOTH:
  1. FCM (if user has fcm tokens): call sendFCMNotification
  2. Web Push (if user has web subscriptions): call existing webpush.sendNotification
  Run in parallel: await Promise.allSettled([...fcmPromises, ...webPushPromises])

=== ADD TO notifications.routes.ts ===

POST /notifications/push/fcm-token → authenticate
  body: { fcm_token: string }
  Calls: storeFCMToken(req.user.id, fcm_token)
  Returns: { success: true }

=== UPDATE backend/src/config/env.ts ===
Add optional fields:
  FIREBASE_PROJECT_ID: z.string().optional()
  FIREBASE_CLIENT_EMAIL: z.string().optional()
  FIREBASE_PRIVATE_KEY: z.string().optional()

=== UPDATE backend/.env.example ===
Add Firebase section:
  # Firebase Cloud Messaging (for mobile push notifications)
  # Get from Firebase Console → Project Settings → Service Accounts → Generate New Private Key
  FIREBASE_PROJECT_ID=your-project-id
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

=== FRONTEND: Update public/sw.js ===

The service worker needs to handle FCM messages when the app is backgrounded.
ADD FCM message handler:

  // Import Firebase scripts in service worker
  importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js')
  
  // Initialize Firebase in SW (config values come from the app)
  firebase.initializeApp(self.FIREBASE_CONFIG || {})
  const messaging = firebase.messaging()
  
  // Background message handler
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {}
    const options = {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: payload.data || {},
    }
    return self.registration.showNotification(title || 'DineLuxe', options)
  })

=== FRONTEND HOOK: hooks/useFCMToken.ts ===

A hook that:
1. Requests notification permission
2. Gets FCM token from Firebase SDK
3. Posts the token to the backend
4. Re-registers when token refreshes

  import { initializeApp } from 'firebase/app'
  import { getMessaging, getToken, onMessage } from 'firebase/messaging'
  
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  
  export function useFCMToken() {
    useEffect(() => {
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return
      
      const app = initializeApp(firebaseConfig)
      const messaging = getMessaging(app)
      
      Notification.requestPermission().then(permission => {
        if (permission !== 'granted') return
        
        getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
          .then(token => {
            if (token) {
              apiClient.post('/notifications/push/fcm-token', { fcm_token: token })
            }
          })
      })
      
      // Handle foreground messages
      return onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {}
        toast(body || title || 'New notification', { icon: '🔔' })
      })
    }, [])
  }

Add useFCMToken() call in app/customer/layout.tsx and app/staff/layout.tsx.

Return all new/modified files.
```

### 📤 Expected Output
- 🆕 `backend/src/utils/fcm.ts`
- 🆕 `hooks/useFCMToken.ts`
- ✏️ `backend/src/modules/notifications/notifications.service.ts`
- ✏️ `backend/src/modules/notifications/notifications.routes.ts`
- ✏️ `backend/src/config/env.ts` + `backend/.env.example`
- ✏️ `public/sw.js`

---

# ═══════════════════════════════════════════════
# PROMPT P5-2 — "Call Waiter" Feature (Customer → Waiter)
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/staff/waiter/page.tsx                      (full — 20.5KB existing waiter interface)
app/customer/restaurant/[restaurantId]/page.tsx (full restaurant page — customer view)
backend/src/modules/orders/orders.service.ts    (full)
backend/src/modules/orders/orders.routes.ts     (full)
backend/src/server.ts                           (for WebSocket socket reference)
lib/socket.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are implementing the "Call Waiter" feature for Restaurant OS.

The product document (Section 8.4) explicitly states:
  "'Call Waiter' button: customer can tap from their app — waiter gets notified instantly"
  "'Call Waiter' alerts appear as a persistent badge until acknowledged"

Current status: ZERO "call waiter" code in any customer-facing file.
This is a core feature of the dine-in experience.

=== BACKEND: Add to orders.service.ts ===

FUNCTION: callWaiter(tableId: string, branchId: string, customerId: string): Promise<void>
  
  1. Verify there is an active order on this table for this customer:
     SELECT o.id, o.waiter_id FROM orders o
     WHERE o.table_id = tableId AND o.customer_id = customerId
       AND o.status NOT IN ('paid', 'cancelled', 'closed')
     LIMIT 1
  
  2. If no active order: throw 400 'No active order found for this table'
  
  3. Get the assigned waiter_id (if any)
  
  4. Emit WebSocket event 'customer_call_waiter':
     const io = getIO()  // import from server.ts
     const eventData = {
       table_id: tableId,
       table_label: table.label,
       branch_id: branchId,
       order_id: order.id,
       called_at: new Date().toISOString(),
       message: `Table ${table.label} needs assistance`
     }
     
     // Emit to the specific waiter if assigned
     if (order.waiter_id) {
       const waiterSocketId = await redis.get(`socket:${order.waiter_id}`)
       if (waiterSocketId) {
         io.to(waiterSocketId).emit('customer_call_waiter', eventData)
       }
       // Also emit to the branch waiter room as backup
       io.to(`branch:${branchId}:waiters`).emit('customer_call_waiter', eventData)
     } else {
       // No assigned waiter — broadcast to all waiters at branch
       io.to(`branch:${branchId}:waiters`).emit('customer_call_waiter', eventData)
     }
     
     // Also alert manager
     io.to(`branch:${branchId}:manager`).emit('customer_call_waiter', eventData)
  
  5. Store the call in Redis with TTL 10 minutes (to prevent spam):
     const spamKey = `call_waiter:${tableId}:${customerId}`
     const existing = await redis.get(spamKey)
     if (existing) throw 429 'Please wait before calling again'
     await redis.set(spamKey, '1', 'EX', 120)  // 2 min cooldown

FUNCTION: acknowledgeWaiterCall(tableId: string, waiterId: string): Promise<void>
  - Called when waiter taps "On My Way" on the alert
  - Emit 'waiter_call_acknowledged' back to the customer via:
    io.to(`table:${tableId}`).emit('waiter_acknowledged', { waiter_name: waiter.first_name })
  - Log acknowledgment

ADD to orders.routes.ts:
  POST /orders/call-waiter
    body: { table_id, branch_id }
    authenticate (customer)
    → callWaiter(body.table_id, body.branch_id, req.user.id)
  
  POST /orders/acknowledge-call
    body: { table_id }
    authenticate, requireRole('waiter', 'manager')
    → acknowledgeWaiterCall(body.table_id, req.user.id)

=== FRONTEND 1: Add "Call Waiter" button to customer dine-in view ===

Read app/customer/restaurant/[restaurantId]/page.tsx.
Find the section where the customer sees their active order (the in-restaurant ordering view).
Specifically look for where order status is shown.

If the restaurant page has an "active dine-in order" section:
  ADD below the order status section:
  
  <CallWaiterButton tableId={activeOrder?.table_id} branchId={branchId} orderId={activeOrder?.id} />

  Where CallWaiterButton is a new component:
  
  INLINE component (no separate file needed):
  function CallWaiterButton({ tableId, branchId, orderId }: Props) {
    const [called, setCalled] = useState(false)
    const [cooldown, setCooldown] = useState(false)
    const { toast } = useToast()
    
    if (!tableId) return null  // not a dine-in order
    
    const handleCall = async () => {
      if (cooldown) {
        toast.info('Please wait before calling again')
        return
      }
      try {
        await apiClient.post('/orders/call-waiter', { table_id: tableId, branch_id: branchId })
        setCalled(true)
        setCooldown(true)
        toast.success('Your waiter has been notified!')
        setTimeout(() => {
          setCalled(false)
          setCooldown(false)
        }, 120000)  // 2 minute cooldown
      } catch (err: any) {
        if (err.status === 429) toast.warning('Please wait a moment before calling again')
        else toast.error('Could not reach your waiter. Please flag them down.')
      }
    }
    
    return (
      <button
        onClick={handleCall}
        disabled={cooldown}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all',
          called ? 'bg-green-500 text-white' : 'bg-[#1A3C5E] text-white hover:bg-[#1A3C5E]/90',
          cooldown && !called && 'opacity-50 cursor-not-allowed'
        )}
      >
        {called ? '✓ Waiter Notified' : '🔔 Call Waiter'}
      </button>
    )
  }

Also: Listen for 'waiter_acknowledged' WebSocket event from the customer side:
  socket.on('waiter_acknowledged', ({ waiter_name }) => {
    toast.success(`${waiter_name || 'Your waiter'} is on the way!`)
  })

=== FRONTEND 2: Add alert handler to waiter app ===

Read app/staff/waiter/page.tsx.
Find the WebSocket useEffect or socket.on event handlers.

ADD handling for 'customer_call_waiter' event:

  socket.on('customer_call_waiter', (data: CallWaiterEvent) => {
    // Add to waiter alerts state
    setCallAlerts(prev => [data, ...prev])
    
    // Play audio alert (use existing audio pattern from KDS)
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      oscillator.frequency.value = 880
      oscillator.connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.3)
    } catch {}
  })

ADD a persistent alert banner at the top of the waiter screen (above table grid):
  
  {callAlerts.length > 0 && (
    <div className="sticky top-0 z-30 space-y-2 px-3 pt-2">
      {callAlerts.map(alert => (
        <div key={`${alert.table_id}-${alert.called_at}`}
          className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2 shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <div>
              <p className="font-bold text-sm">Table {alert.table_label} needs you</p>
              <p className="text-xs opacity-80">{formatRelativeTime(alert.called_at)}</p>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledge(alert.table_id, alert)}
            className="bg-white text-amber-600 text-xs font-semibold px-3 py-1 rounded-lg"
          >
            On My Way
          </button>
        </div>
      ))}
    </div>
  )}

  handleAcknowledge:
    1. Call POST /orders/acknowledge-call { table_id }
    2. Remove from callAlerts state
    3. Navigate to that table: router.push(`/staff/waiter?table=${tableId}`)

Return:
- Updated orders.service.ts (callWaiter + acknowledgeWaiterCall)
- Updated orders.routes.ts (2 new routes)
- Updated app/customer/restaurant/[restaurantId]/page.tsx (Call Waiter button)
- Updated app/staff/waiter/page.tsx (alert handler + banner UI)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/orders/orders.service.ts`
- ✏️ `backend/src/modules/orders/orders.routes.ts`
- ✏️ `app/customer/restaurant/[restaurantId]/page.tsx`
- ✏️ `app/staff/waiter/page.tsx`

---

# ═══════════════════════════════════════════════
# PROMPT P5-3 — Review Photo Upload to Supabase Storage
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
components/customer/PostOrderRating.tsx        (from Part 3 P3-17)
backend/src/modules/reviews/reviews.service.ts (full — with P3-17 + P3-18 updates)
backend/src/modules/reviews/reviews.routes.ts  (full)
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are completing the review photo upload pipeline for Restaurant OS.

The product document (Section 9.6) specifies:
  "Upload photo or short video with review (food presentation, ambiance)"

The PostOrderRating.tsx component (from P3-17) has photo slots with file inputs
but the actual upload pipeline is incomplete — photos are selected but never sent
to the server.

=== BACKEND: Add presigned upload URL endpoint ===

ADD to reviews.service.ts:

FUNCTION: getReviewPhotoUploadUrl(reviewId: string, photoIndex: number, fileType: string): Promise<{ upload_url: string, public_url: string }>
  
  - Validate fileType is one of: image/jpeg, image/png, image/webp, image/heic
  - Generate a unique storage key:
    const key = `reviews/${reviewId}/photo_${photoIndex}_${Date.now()}.${extension}`
  
  - Create Supabase Storage upload URL:
    const { data, error } = await supabaseAdmin.storage
      .from('reviews')                     // bucket: 'reviews'
      .createSignedUploadUrl(key)
    
    If error: throw 500
    
    // Also get the future public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('reviews')
      .getPublicUrl(key)
    
    Return { upload_url: data.signedUrl, public_url: urlData.publicUrl }

FUNCTION: attachPhotosToReview(reviewId: string, photoUrls: string[]): Promise<void>
  - Validate max 3 photos
  - Validate URLs belong to our storage domain
  - UPDATE reviews SET photo_urls = photoUrls WHERE id = reviewId
  - (photo_urls is a TEXT[] column — add to schema if missing)

ADD to reviews.routes.ts:
  POST /reviews/:id/upload-url
    authenticate
    body: { photo_index: number (0-2), file_type: string }
    → getReviewPhotoUploadUrl
  
  PATCH /reviews/:id/photos
    authenticate
    body: { photo_urls: string[] }
    → attachPhotosToReview

=== FRONTEND: Update PostOrderRating.tsx ===

Read the PostOrderRating.tsx component.
Find the photo upload section (3 photo slots).

Complete the upload flow:

  const uploadPhoto = async (file: File, index: number): Promise<string> => {
    // 1. Get pre-signed upload URL from backend
    const { upload_url, public_url } = await apiClient.post<{ upload_url: string; public_url: string }>(
      `/reviews/${reviewId}/upload-url`,
      { photo_index: index, file_type: file.type }
    )
    
    // 2. Upload directly to Supabase Storage (bypass our backend for performance)
    await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    
    return public_url
  }
  
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      toast.error('Please select a JPG, PNG, or WebP image')
      return
    }
    
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPhotoPreviews(prev => {
      const next = [...prev]
      next[index] = localUrl
      return next
    })
    
    // Upload in background
    setUploadingIndex(index)
    try {
      const publicUrl = await uploadPhoto(file, index)
      setUploadedUrls(prev => {
        const next = [...prev]
        next[index] = publicUrl
        return next
      })
    } catch {
      toast.error('Photo upload failed. Your review will be submitted without this photo.')
      setPhotoPreviews(prev => { const n = [...prev]; n[index] = null; return n })
    } finally {
      setUploadingIndex(null)
    }
  }
  
  // On submit — attach photos to review after review is created
  const handleSubmit = async () => {
    const reviewResult = await apiClient.post('/reviews', reviewData)
    
    // Attach any uploaded photos
    const validUrls = uploadedUrls.filter(Boolean)
    if (validUrls.length > 0) {
      await apiClient.patch(`/reviews/${reviewResult.id}/photos`, { photo_urls: validUrls })
    }
    
    onSubmit()
  }

PHOTO SLOT UI (update the existing slots):
  Each slot:
  - Empty: dashed border + camera icon + "Add Photo" text
  - Loading: spinner overlay
  - Has photo: thumbnail with ✕ button to remove + checkmark overlay

Return:
- Updated reviews.service.ts (2 new functions)
- Updated reviews.routes.ts (2 new routes)
- Updated components/customer/PostOrderRating.tsx (complete upload flow)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/reviews/reviews.service.ts`
- ✏️ `backend/src/modules/reviews/reviews.routes.ts`
- ✏️ `components/customer/PostOrderRating.tsx`

---

# ═══════════════════════════════════════════════
# PROMPT P5-4 — Customer Refund Status Tracker
# ═══════════════════════════════════════════════

### 📂 Files to Provide to Claude

```
app/customer/profile/page.tsx                  (full — 12.4KB)
app/customer/profile/support/page.tsx          (full — 13.8KB existing support page)
backend/src/modules/payments/payments.service.ts
backend/src/modules/payments/payments.routes.ts
backend/src/modules/support/support.service.ts
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are building the Customer Refund Status Tracker for Restaurant OS.

The product document (Section 9.7) specifies:
  "Refund status tracker: see stage of refund request"

Currently: The customer profile page has ZERO refund-related content.
The support page exists (13.8KB) but doesn't show a dedicated refund tracker.

=== BACKEND: Add refund status endpoint ===

ADD to payments.service.ts:

FUNCTION: getRefundStatusForCustomer(userId: string): Promise<RefundStatus[]>
  
  Fetch all refund requests for this customer:
  SELECT 
    o.id as order_id,
    o.created_at as order_date,
    r.name as restaurant_name,
    p.amount,
    p.status as payment_status,
    p.refund_requested_at,
    p.refunded_at,
    st.status as ticket_status,
    st.id as ticket_id,
    st.created_at as requested_at,
    st.updated_at as last_updated
  FROM payments p
  JOIN orders o ON p.order_id = o.id
  JOIN restaurants r ON (SELECT restaurant_id FROM branches WHERE id = o.branch_id)
  LEFT JOIN support_tickets st ON st.reference_id = o.id AND st.reference_type = 'refund'
  WHERE o.customer_id = userId
    AND p.status IN ('refund_requested', 'refunded', 'failed')
     OR st.reference_type = 'refund'
  ORDER BY COALESCE(p.refund_requested_at, st.created_at) DESC

  Map to RefundStage:
    p.status = 'refund_requested' OR ticket_status = 'open'   → 'submitted'
    ticket_status = 'in_progress'                              → 'under_review'
    p.status = 'refunded'                                      → 'approved'
    ticket_status = 'resolved' AND p.status != 'refunded'     → 'rejected'
  
  Return: [{
    order_id, restaurant_name, amount, stage, requested_at, last_updated,
    estimated_days: stage === 'approved' ? null : 3
  }]

ADD to payments.routes.ts:
  GET /payments/my-refunds → authenticate (customer), getRefundStatusForCustomer

=== FRONTEND: Create RefundTracker component + integrate into profile ===

CREATE inline in app/customer/profile/support/page.tsx (or as a separate section
in the profile page — decide based on the support page content):

Read support/page.tsx. If it already has a section for refund tracking, enhance it.
If not, add a "My Refunds" tab/section.

COMPONENT: RefundTracker (inline in support page or profile page)

DATA: GET /api/v1/payments/my-refunds

DESIGN:
  Section heading: "Refund Requests"
  
  Empty state: "No refund requests. All your orders look good! 🎉"
  
  Each refund card:
    - Restaurant name + order amount
    - Order date: "15 Jun 2025"
    - 
    STAGE INDICATOR (horizontal steps, 4 stages):
    ● Submitted → ○ Under Review → ○ Processed → ○ Credited
    
    Stage colors:
      Submitted: amber (waiting)
      Under Review: blue (in progress)  
      Processed/Approved: green (done)
      Rejected: red (filled) + "Declined" label
    
    - "₹240.00 refund" in green if approved, gray if pending
    - "Estimated: 3-5 business days" if pending
    - Last updated: "Updated 2 hours ago"
    - If rejected: "Reason: {rejection_reason}" in small gray text
    - "Contact Support" link → opens support chat/form

  Loading: 3 skeleton cards

=== UPDATE app/customer/profile/page.tsx ===

Read the profile page. Find the navigation/menu items section.
Add a "Refunds" entry linking to /customer/profile/support#refunds (or a tab).

If the profile page uses a card-based menu:
  Add a card entry:
  {
    label: 'Refunds',
    icon: RotateCcw,    // from lucide-react
    href: '/customer/profile/support',
    sublabel: refundCount > 0 ? `${refundCount} request${refundCount > 1 ? 's' : ''}` : undefined
  }

Return:
- Updated payments.service.ts (getRefundStatusForCustomer)
- Updated payments.routes.ts (GET /my-refunds)
- Updated app/customer/profile/support/page.tsx (RefundTracker section)
- Updated app/customer/profile/page.tsx (Refunds nav entry)
```

### 📤 Expected Output
- ✏️ `backend/src/modules/payments/payments.service.ts`
- ✏️ `backend/src/modules/payments/payments.routes.ts`
- ✏️ `app/customer/profile/support/page.tsx`
- ✏️ `app/customer/profile/page.tsx`

---

# ═══════════════════════════════════════════════
# PART 5 — COMPLETE CHECKLIST
# ═══════════════════════════════════════════════

## 📂 PART 5 ALL FILES (2 New + 14 Modified)

### New Files (2)
```
backend/src/utils/fcm.ts                         ← P5-1
hooks/useFCMToken.ts                             ← P5-1
```

### Modified Backend Files (7)
```
backend/src/config/env.ts                              ← P5-1
backend/.env.example                                   ← P5-1
backend/src/modules/notifications/notifications.service.ts ← P5-1
backend/src/modules/notifications/notifications.routes.ts  ← P5-1
backend/src/modules/orders/orders.service.ts           ← P5-2
backend/src/modules/orders/orders.routes.ts            ← P5-2
backend/src/modules/reviews/reviews.service.ts         ← P5-3
backend/src/modules/reviews/reviews.routes.ts          ← P5-3
backend/src/modules/payments/payments.service.ts       ← P5-4
backend/src/modules/payments/payments.routes.ts        ← P5-4
```

### Modified Frontend Files (6)
```
public/sw.js                                           ← P5-1
app/customer/restaurant/[restaurantId]/page.tsx        ← P5-2
app/staff/waiter/page.tsx                              ← P5-2
components/customer/PostOrderRating.tsx                ← P5-3
app/customer/profile/support/page.tsx                  ← P5-4
app/customer/profile/page.tsx                          ← P5-4
```

---

## ✅ CONFIRMED: DOCUMENT IS NOW FULLY COVERED

After exhaustive review of every section in both DOCX files against all 5 prompts parts:

| Document Section | Status |
|---|---|
| Section 1-3: Architecture + White-Label | ✅ Covered (Parts 1, 2, 13) |
| Section 4: Auth + Onboarding | ✅ Covered (existing code + Parts 1, 10) |
| Section 5: RBAC | ✅ Covered (existing code) |
| Section 6: Super Admin | ✅ Covered (Parts 2, 3, 4) |
| Section 7: Owner Panel | ✅ Covered (Parts 1, 2, 3) |
| Section 8: Staff Modules | ✅ Covered (Parts 1, 2, 3, P5-2) |
| Section 9: Customer App | ✅ Covered (Parts 1, 3, 4, P5-2, P5-3, P5-4) |
| Section 10: Delivery Partner | ✅ Covered (Parts 2, 3) |
| Section 11: Real-Time / WebSockets | ✅ Covered (Parts 1, 4) |
| Section 12: AI Features | ✅ Covered (Parts 1, 2) |
| Section 13: Database Schema | ✅ Covered (existing schema + Parts 1, 2) |
| Section 14: API Reference | ✅ Covered (all modules across all parts) |
| Section 15: UI/UX Design System | ✅ Covered (Parts 1, 3) |
| Section 16: Notifications | ✅ Covered (Parts 1, 4, P5-1) |
| Section 17: Security + GDPR | ✅ Covered (Parts 2, 3, 4) |
| Section 18: Infrastructure | ✅ Covered (Parts 1, 4) |
| Section 19: Claude's Ideas | ✅ All 10 ideas covered |

---

## 📊 FINAL GRAND TOTAL — ALL 5 PARTS

| Category | P1 | P2 | P3 | P4 | P5 | **TOTAL** |
|---|---|---|---|---|---|---|
| Prompts | 38 | 20 | 15 | 9 | 4 | **86 prompts** |
| New Files | ~90 | 32 | 15 | 5 | 2 | **~144 files** |
| Modified Files | ~30 | ~18 | ~28 | ~22 | ~14 | **~112 changes** |

---

## 🔴 FINAL EXECUTION PRIORITY ORDER

```
CRITICAL — Run these FIRST (things are broken):
  P2-1  → Missing RPC SQL (admin/reports crash at runtime)
  P3-1  → apply-coupon route (PaymentModal throws 404)
  P4-4  → WebSocket Redis adapter (WS broken on multi-instance deploy)
  P4-3  → GST calculation (bills are mathematically incorrect)
  P2-12 → Owner reports wrong API paths (all 404s)

HIGH — Core product features:
  P2-4  → Razorpay + UPI QR payment
  P2-3  → Waiter auto-assignment
  P4-2  → Receipt PDF generation
  P5-1  → FCM push (iOS users get no notifications without this)
  P5-2  → Call Waiter button (core dine-in feature)
  P4-1  → SMS integration
  P2-8  → Restaurant approval workflow

MEDIUM — Complete feature set:
  P1-2  → Recipe ingredients
  P1-3  → Shifts module
  P1-8  → Floor layout designer
  P2-5  → Owner customer CRM
  P2-9  → Loyalty config page
  P3-4  → Customer bookings + orders history
  P3-6  → Delivery active page
  P5-3  → Review photo upload
  P5-4  → Refund status tracker

POLISH — Production quality:
  P2-13 → Enhanced white-label branding
  P2-15 → Error boundaries
  P2-16 → Rate limiting hardening
  P3-9  → Constants + utils audit
  P3-10 → Type safety audit
  P3-15 → Final nav + wiring sync
  P4-7  → GDPR anonymization
  P4-8  → Platform health score
  P4-9  → Sponsored placement
```

---

*Restaurant OS — Prompt Library PART 5 (Complete & Final)*
*The product document is now 100% mapped to implementation prompts.*
*Priyanshu Kumar Gupta & Ronit Gupta | 2025*
