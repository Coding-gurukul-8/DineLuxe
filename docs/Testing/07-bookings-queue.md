# Group 07 — Bookings & Queue Testing

> **Base:** `http://localhost:5001/api/v1`
> **Who runs this:** Customer + Host + Manager
> **Purpose:** Full reservation lifecycle + walk-in queue management

---

## Prerequisites

```bash
BASE="http://localhost:5001/api/v1"
export BRANCH_ID="<branch UUID>"
export TABLE_1_ID="<table UUID>"
export TABLE_2_ID="<table UUID>"

# Tokens expire fast — use these helpers so every step can refresh its token
login() {
  local email="$1" password="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"emailOrUsername\":\"$email\",\"password\":\"$password\"}" \
    | jq -r '.data.accessToken'
}

login_customer() { export CUSTOMER_TOKEN=$(login "rahul.sharma@gmail.com" "Customer@123"); }
login_host()     { export HOST_TOKEN=$(login "pooja.host@spicegarden.com" "04072000"); }
login_manager()  { export MANAGER_TOKEN=$(login "arjun.manager@spicegarden.com" "15051988"); }
login_waiter()   { export WAITER_TOKEN=$(login "ravi.waiter@spicegarden.com" "20081999"); }
```

---

## ── BOOKINGS ──────────────────────────────────────────────────────

## STEP 1 — Customer Creates a Booking

```bash
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "booking_date": "2026-05-15",
    "booking_time": "19:30",
    "party_size": 4,
    "special_requests": "Window seat preferred, one high chair needed"
  }'
```

> Save: `export BOOKING_ID="<booking id>"`

**Expected:** `201` — booking with status `confirmed`

---

## STEP 2 — Customer Creates Another Booking (for cancel test)

```bash
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "booking_date": "2026-05-20",
    "booking_time": "20:00",
    "party_size": 2,
    "special_requests": "Anniversary dinner"
  }'
```

> Save: `export BOOKING_ID_2="<booking id>"`

---

## STEP 3 — Get My Bookings (Customer)

```bash
login_customer
curl $BASE/bookings/user/me \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — array of 2 bookings

---

## STEP 4 — Get Booking by ID

```bash
login_customer
curl $BASE/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — full booking detail

---

## STEP 5 — Get Branch Bookings (Host/Manager View)

```bash
login_host
curl "$BASE/bookings/branch/$BRANCH_ID?date=2026-05-15" \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — all bookings for that date

---

## STEP 6 — Customer Marks Arrived (Geo-triggered)

```bash
login_customer
curl -X PATCH $BASE/bookings/$BOOKING_ID/arrived \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

**Expected:** `200` — status: `arrived`

---

## STEP 7 — Host Seats the Guest

```bash
login_host
curl -X PATCH $BASE/bookings/$BOOKING_ID/seat \
  -H "Authorization: Bearer $HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "'$TABLE_1_ID'"
  }'
```

**Expected:** `200` — status: `seated`, table status → `occupied`

---

## STEP 8 — Customer Cancels Their Booking

```bash
login_customer
curl -X PATCH $BASE/bookings/$BOOKING_ID_2/cancel \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Change of plans"
  }'
```

**Expected:** `200` — status: `cancelled`

---

## STEP 9 — Manager Cancels a Booking (Restaurant-side)

```bash
# Create one more booking to cancel
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "booking_date": "2026-05-22",
    "booking_time": "13:00",
    "party_size": 6
  }'

# Save: export BOOKING_ID_3="<id>"

login_manager
curl -X PATCH $BASE/bookings/$BOOKING_ID_3/cancel \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Branch closed for private event"}'
```

**Expected:** `200`

---

## STEP 10 — Mark Booking as No-Show (Host)

```bash
# Create a booking that will be no-showed
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "booking_date": "2026-05-10",
    "booking_time": "18:00",
    "party_size": 3
  }'

# Save: export BOOKING_NOSHOW="<id>"

login_host
curl -X PATCH $BASE/bookings/$BOOKING_NOSHOW/no-show \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — status: `no_show`

---

## ── QUEUE ─────────────────────────────────────────────────────────

## STEP 11 — Walk-in Joins Queue (Public — No Token)

```bash
curl -X POST $BASE/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "party_size": 3,
    "name": "Raj Kapoor",
    "phone": "+919876540001"
  }'
```

> Save: `export QUEUE_ID_1="<queue id>"`

**Expected:** `201` — `{ position: 1, estimated_wait_minutes: 15 }`

---

## STEP 12 — Another Walk-in Joins Queue

```bash
curl -X POST $BASE/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "'$BRANCH_ID'",
    "party_size": 2,
    "name": "Meena Shah",
    "phone": "+919876540002"
  }'
```

> Save: `export QUEUE_ID_2="<queue id>"`

**Expected:** `201` — position: 2

---

## STEP 13 — Get Branch Queue (Host View)

```bash
login_host
curl $BASE/queue/branch/$BRANCH_ID \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — 2 people in queue with positions and wait times

---

## STEP 14 — Check Queue Position

```bash
login_host
curl $BASE/queue/position/$QUEUE_ID_1 \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — `{ position: 1, estimated_wait_minutes: ... }`

---

## STEP 15 — Mark First Guest as Arrived

```bash
login_host
curl -X PATCH $BASE/queue/$QUEUE_ID_1/arrive \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — status: `arrived`

---

## STEP 16 — Assign Table to Queue Guest

```bash
login_host
curl -X PATCH $BASE/queue/$QUEUE_ID_1/assign-table \
  -H "Authorization: Bearer $HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "'$TABLE_2_ID'"
  }'
```

**Expected:** `200` — status: `seated`, table → `occupied`, queue position removed

---

## STEP 17 — Mark Second Guest as No-Show

```bash
login_host
curl -X PATCH $BASE/queue/$QUEUE_ID_2/no-show \
  -H "Authorization: Bearer $HOST_TOKEN"
```

**Expected:** `200` — status: `no_show`

---

## STEP 18 — Remove Someone from Queue (Manager)

```bash
# Add a third person to queue first
curl -X POST $BASE/queue/join \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"'$BRANCH_ID'","party_size":2,"name":"Amit Roy","phone":"+919876540003"}'

# Save: export QUEUE_ID_3="<id>"

login_manager
curl -X DELETE $BASE/queue/$QUEUE_ID_3 \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

**Expected:** `200` — removed from queue

---

## ── GEO CHECK-IN ──────────────────────────────────────────────────

## STEP 19 — Geo Arrival Check (Customer Near Restaurant)

```bash
login_customer
curl -X POST $BASE/geo/arrival-check \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 19.0760,
    "lon": 72.8777,
    "booking_id": "'$BOOKING_ID'"
  }'
```

**Expected:** `200` — `{ isNearby: true | false, distance_meters: ... }`

---

## ❌ Negative Tests

```bash
# Booking in the past → 400
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"'$BRANCH_ID'","booking_date":"2020-01-01","booking_time":"19:00","party_size":2}'

# Party size 0 → 400
login_customer
curl -X POST $BASE/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"'$BRANCH_ID'","booking_date":"2026-06-01","booking_time":"19:00","party_size":0}'

# Cancel already-cancelled booking → 400
login_customer
curl -X PATCH $BASE/bookings/$BOOKING_ID_2/cancel \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Double cancel"}'

# Queue join with party size 0 → 400
curl -X POST $BASE/queue/join \
  -H "Content-Type: application/json" \
  -d '{"branch_id":"'$BRANCH_ID'","party_size":0,"name":"Zero","phone":"+919876540099"}'

# Waiter assigning table from queue → 403
login_waiter
curl -X PATCH $BASE/queue/$QUEUE_ID_1/assign-table \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_id":"'$TABLE_1_ID'"}'
```
