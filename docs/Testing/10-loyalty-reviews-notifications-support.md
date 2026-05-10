# Group 10 — Loyalty, Reviews, Notifications & Support Testing

> **Base:** `http://localhost:5001/api/v1`
> **Who runs this:** Customer + Admin
> **Purpose:** Points system, post-order reviews, push notifications, support tickets

---

## Prerequisites

```bash
BASE="http://localhost:5001/api/v1"
export ORDER_ID="<completed + paid order UUID>"
export RESTAURANT_ID="<restaurant UUID>"
export BRANCH_ID="<branch UUID>"

# Tokens expire fast — use these helpers so every step can refresh its token
login() {
  local email="$1" password="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"emailOrUsername\":\"$email\",\"password\":\"$password\"}" \
    | jq -r '.data.accessToken'
}

login_customer() { export CUSTOMER_TOKEN=$(login "rahul.sharma@gmail.com" "Customer@123"); }
login_admin()    { export ADMIN_TOKEN=$(login "admin@platform.com" "Admin@Secure123"); }
login_manager()  { export MANAGER_TOKEN=$(login "arjun.manager@spicegarden.com" "15051988"); }
```

---

## ── LOYALTY ───────────────────────────────────────────────────────

## STEP 1 — Check Loyalty Balance (Before Earning)

```bash
login_customer
curl $BASE/loyalty/balance \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — `{ points: 0, tier: "bronze", next_tier_at: 500 }`

---

## STEP 2 — Earn Points from Completed Order

```bash
login_customer
curl -X POST $BASE/loyalty/earn \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "'$ORDER_ID'"
  }'
```

**Expected:** `200` — `{ points_earned: 85, new_balance: 85 }` (1 point per ₹10 spent typically)

---

## STEP 3 — Check Balance After Earning

```bash
login_customer
curl $BASE/loyalty/balance \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — updated balance

---

## STEP 4 — Get Points History

```bash
login_customer
curl $BASE/loyalty/history \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — transaction log with earn entry

---

## STEP 5 — Try to Earn Points from Same Order Again (Should Fail)

```bash
login_customer
curl -X POST $BASE/loyalty/earn \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "'$ORDER_ID'"}'
```

**Expected:** `409` — points already earned for this order

---

## STEP 6 — Redeem Points Against a New Order

```bash
# Create fresh order first (repeat Group 05 Step 1)
export NEW_ORDER_ID="<fresh order UUID>"

login_customer
curl -X POST $BASE/loyalty/redeem \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "'$NEW_ORDER_ID'",
    "points": 50
  }'
```

**Expected:** `200` — `{ points_redeemed: 50, discount_amount: 50, new_balance: 35 }`

---

## STEP 7 — Get History After Redeem

```bash
login_customer
curl $BASE/loyalty/history \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — 2 entries: earn + redeem

---

## ── REVIEWS ───────────────────────────────────────────────────────

## STEP 8 — Create a Review (Customer, After Paid Order)

```bash
login_customer
curl -X POST $BASE/reviews \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "'$ORDER_ID'",
    "restaurant_id": "'$RESTAURANT_ID'",
    "overall_rating": 5,
    "food_rating": 5,
    "service_rating": 4,
    "ambiance_rating": 4,
    "comment": "Absolutely loved the Paneer Tikka! Service was quick and staff were friendly.",
    "would_recommend": true
  }'
```

> Save: `export REVIEW_ID="<review id>"`

**Expected:** `201`

---

## STEP 9 — Check if Order Already Reviewed

```bash
login_customer
curl $BASE/reviews/order/$ORDER_ID \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — `{ reviewed: true, review_id: "..." }`

---

## STEP 10 — Get Reviews for Restaurant (Public)

```bash
curl "$BASE/reviews/restaurant/$RESTAURANT_ID?page=1&limit=10"
```

**Expected:** `200` — paginated reviews with average ratings

---

## STEP 11 — Get Reviews for Branch (Public)

```bash
curl "$BASE/reviews/branch/$BRANCH_ID?page=1&limit=10"
```

**Expected:** `200` — branch-level reviews

---

## STEP 12 — Try to Review Same Order Twice (Should Fail)

```bash
login_customer
curl -X POST $BASE/reviews \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"'$ORDER_ID'","restaurant_id":"'$RESTAURANT_ID'","overall_rating":3,"comment":"Duplicate review"}'
```

**Expected:** `409` — already reviewed

---

## STEP 13 — Admin Deletes Abusive Review

```bash
login_admin
curl -X DELETE $BASE/reviews/$REVIEW_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:** `200` — review deleted

---

## ── NOTIFICATIONS ─────────────────────────────────────────────────

## STEP 14 — Register Device for Push Notifications

```bash
login_customer
curl -X POST $BASE/notifications/register-device \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "FCM_DEVICE_TOKEN_CUSTOMER_001",
    "platform": "android"
  }'
```

**Expected:** `200`

---

## STEP 15 — Register iOS Device

```bash
login_customer
curl -X POST $BASE/notifications/register-device \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "APNS_DEVICE_TOKEN_IOS_001",
    "platform": "ios"
  }'
```

---

## STEP 16 — Get Notifications List

```bash
login_customer
curl $BASE/notifications \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — array of notifications (order updates, booking confirmations etc.)

---

## STEP 17 — Mark One Notification as Read

```bash
# Get notification ID from Step 16
export NOTIF_ID="<notification id>"

login_customer
curl -X PATCH $BASE/notifications/$NOTIF_ID/read \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — `{ read: true }`

---

## STEP 18 — Mark All Notifications as Read

```bash
login_customer
curl -X PATCH $BASE/notifications/read-all \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — all unread cleared

---

## STEP 19 — Remove Device Token (Logout from Device)

```bash
login_customer
curl -X DELETE $BASE/notifications/device/FCM_DEVICE_TOKEN_CUSTOMER_001 \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — device unregistered

---

## ── SUPPORT TICKETS ───────────────────────────────────────────────

## STEP 20 — Customer Creates Support Ticket

```bash
login_customer
curl -X POST $BASE/support/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Wrong order delivered",
    "description": "I ordered Paneer Tikka but received Chicken Tikka. I am vegetarian.",
    "category": "order",
    "order_id": "'$ORDER_ID'",
    "priority": "high"
  }'
```

> Save: `export TICKET_ID="<ticket id>"`

**Expected:** `201` — ticket created, status: `open`

---

## STEP 21 — Customer Creates Another Ticket

```bash
login_customer
curl -X POST $BASE/support/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "App not showing my booking",
    "description": "I made a booking 2 days ago but it is not appearing in my booking history.",
    "category": "technical",
    "priority": "medium"
  }'
```

> Save: `export TICKET_ID_2="<id>"`

---

## STEP 22 — Get All Tickets (Customer sees own)

```bash
login_customer
curl $BASE/support/tickets \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — only this customer's tickets

---

## STEP 23 — Get All Tickets (Admin sees all)

```bash
login_admin
curl $BASE/support/tickets \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected:** `200` — all platform tickets

---

## STEP 24 — Get Ticket by ID

```bash
login_customer
curl $BASE/support/tickets/$TICKET_ID \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — full ticket detail

---

## STEP 25 — Customer Adds a Message to Ticket

```bash
login_customer
curl -X POST $BASE/support/tickets/$TICKET_ID/messages \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have attached proof of the incorrect order. Please refund or redeliver."
  }'
```

**Expected:** `201`

---

## STEP 26 — Admin Replies to Ticket

```bash
login_admin
curl -X POST $BASE/support/tickets/$TICKET_ID/messages \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "We sincerely apologize for the error. We will process a full refund within 2-3 business days."
  }'
```

**Expected:** `201`

---

## STEP 27 — Get All Messages for Ticket

```bash
login_customer
curl $BASE/support/tickets/$TICKET_ID/messages \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — thread with customer + admin messages

---

## STEP 28 — Admin Resolves the Ticket

```bash
login_admin
curl -X PATCH $BASE/support/tickets/$TICKET_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

**Expected:** `200` — status: `resolved`

---

## STEP 29 — Admin Closes Second Ticket

```bash
login_admin
curl -X PATCH $BASE/support/tickets/$TICKET_ID_2/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

**Expected:** `200`

---

## ❌ Negative Tests

```bash
# Redeem more points than balance → 400
login_customer
curl -X POST $BASE/loyalty/redeem \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"'$NEW_ORDER_ID'","points":99999}'

# Review with rating > 5 → 400
login_customer
curl -X POST $BASE/reviews \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"'$ORDER_ID'","restaurant_id":"'$RESTAURANT_ID'","overall_rating":6,"comment":"Too high"}'

# Customer updating ticket status (only admin/support) → 403
login_customer
curl -X PATCH $BASE/support/tickets/$TICKET_ID/status \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed"}'

# Register device with empty token → 400
login_customer
curl -X POST $BASE/notifications/register-device \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"","platform":"android"}'

# Earn points from someone else's order → 403
login_manager
curl -X POST $BASE/loyalty/earn \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"'$ORDER_ID'"}'
```
