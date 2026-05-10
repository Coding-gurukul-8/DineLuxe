# Group 05 — Orders & Kitchen Flow Testing

> **Base:** `http://localhost:5001/api/v1`
> **Who runs this:** Waiter → Chef → Waiter → Cashier
> **Purpose:** Full order lifecycle — create → kitchen → serve → complete




---

## Prerequisites

```bash
BASE="http://localhost:5001/api/v1"
export TABLE_1_ID="<table UUID>"
export BRANCH_ID="<branch UUID>"
export ITEM_PANEER_TIKKA="<menu item UUID>"
export ITEM_BUTTER_CHICKEN="<menu item UUID>"
export ITEM_DAL_MAKHANI="<menu item UUID>"
export ITEM_GARLIC_NAAN="<menu item UUID>"

# Tokens expire fast — use these helpers so every step can refresh its token
login() {
  local email="$1" password="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"emailOrUsername\":\"$email\",\"password\":\"$password\"}" \
    | jq -r '.data.accessToken'
}

login_owner()   { export OWNER_TOKEN=$(login "priya.mehta1@restaurant.com" "Owner@1234"); }
login_manager() { export MANAGER_TOKEN=$(login "arjun.manager@spicegarden.com" "15051988"); }
login_waiter()  { export WAITER_TOKEN=$(login "ravi.waiter@spicegarden.com" "20081999"); }
login_chef()    { export CHEF_TOKEN=$(login "sanjay.chef@spicegarden.com" "10031985"); }
login_cashier() { export CASHIER_TOKEN=$(login "sneha.cashier@spicegarden.com" "25111995"); }
login_host()    { export HOST_TOKEN=$(login "pooja.host@spicegarden.com" "04072000"); }
login_customer(){ export CUSTOMER_TOKEN=$(login "rahul.sharma@gmail.com" "Customer@123"); }
login_admin()   { export ADMIN_TOKEN=$(login "admin@platform.com" "Admin@Secure123"); }
```




---

## ── ORDER CREATION ────────────────────────────────────────────────

## STEP 1 — Waiter Creates a Dine-In Order(WORKING)

### (Optional) Find the correct addon name

Addons are stored on the menu item as JSON and are referenced by **name** when creating an order (there is no `addon_id`).

```bash
# View available addons for Butter Chicken (example)
login_waiter
curl -s $BASE/menu/items/$ITEM_BUTTER_CHICKEN | jq '.data.addons // .data.menu_addons // .data.addon'
```

```bash
login_waiter
ORDER_JSON=$(curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "'$TABLE_1_ID'",
    "order_type": "dine_in",
    "items": [
      {
        "menu_item_id": "'$ITEM_PANEER_TIKKA'",
        "quantity": 1,
        "notes": "Less spicy please"
      },
      {
        "menu_item_id": "'$ITEM_BUTTER_CHICKEN'",
        "quantity": 2,
        "addons": [
          {"name": "Extra Gravy", "quantity": 1}
        ]
      },
      {
        "menu_item_id": "'$ITEM_GARLIC_NAAN'",
        "quantity": 3
      }
    ],
    "special_instructions": "Guest is allergic to nuts"
  }')

echo "$ORDER_JSON" | jq
export ORDER_ID=$(echo "$ORDER_JSON" | jq -r '.data.id')
echo "ORDER_ID: $ORDER_ID"
```

> `ORDER_ID` is exported automatically above.

**Expected:** `201` — order created with status `confirmed`, KDS ticket generated

---

## STEP 2 — Get Order by ID(WORKING)

```bash
login_waiter
curl $BASE/orders/$ORDER_ID \
  -H "Authorization: Bearer $WAITER_TOKEN"
```

**Expected:** `200` — full order with items, status, totals

---

## STEP 3 — Get Orders by Table

```bash
login_waiter
curl $BASE/orders/table/$TABLE_1_ID \
  -H "Authorization: Bearer $WAITER_TOKEN"
```

**Expected:** `200` — array with the order we just created

---

## STEP 4 — Get Active Branch Orders (Manager View)

```bash
login_manager
curl $BASE/orders/branch/$BRANCH_ID/active \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

**Expected:** `200` — all active orders for the branch

---

## ── ORDER ITEMS ───────────────────────────────────────────────────

## STEP 5 — Get Items for the Order(WORKING)

```bash
login_waiter
ORDER_ITEMS_JSON=$(curl -s $BASE/order-items/order/$ORDER_ID \
  -H "Authorization: Bearer $WAITER_TOKEN"
)

echo "$ORDER_ITEMS_JSON" | jq
export ORDER_ITEM_1=$(echo "$ORDER_ITEMS_JSON" | jq -r '.data[0].id')
export ORDER_ITEM_2=$(echo "$ORDER_ITEMS_JSON" | jq -r '.data[1].id')
export ORDER_ITEM_3=$(echo "$ORDER_ITEMS_JSON" | jq -r '.data[2].id')
echo "ORDER_ITEM_1: $ORDER_ITEM_1"
echo "ORDER_ITEM_2: $ORDER_ITEM_2"
echo "ORDER_ITEM_3: $ORDER_ITEM_3"
```

**Expected:** `200` — array of order items, all status `pending`

> `ORDER_ITEM_1`, `ORDER_ITEM_2`, `ORDER_ITEM_3` are exported automatically above.

---

## ── KITCHEN FLOW ──────────────────────────────────────────────────

## STEP 6 — Chef Gets KDS Tickets(WORKING)

```bash
login_chef
curl $BASE/kitchen/branch/$BRANCH_ID/tickets \
  -H "Authorization: Bearer $CHEF_TOKEN"
```

**Expected:** `200` — active orders for kitchen to see

---

## STEP 7 — Chef: Order confirmed → preparing(WORKING)

```bash
login_chef
curl -X PATCH $BASE/kitchen/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'
```

**Expected:** `200` — status: `preparing`

---

## STEP 8 — Chef: Item-level Status Update (pending → preparing)(WORKING)

```bash
login_chef
curl -X PATCH $BASE/order-items/$ORDER_ITEM_1/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'

curl -X PATCH $BASE/order-items/$ORDER_ITEM_2/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'

curl -X PATCH $BASE/order-items/$ORDER_ITEM_3/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'
```

**Expected:** `200` each

---

## STEP 9 — Chef: Items Ready(WORKING)

```bash
login_chef
curl -X PATCH $BASE/order-items/$ORDER_ITEM_1/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'

curl -X PATCH $BASE/order-items/$ORDER_ITEM_2/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'

curl -X PATCH $BASE/order-items/$ORDER_ITEM_3/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'
```

---

## STEP 10 — Chef: Order Ready(WORKING)

```bash
login_chef
curl -X PATCH $BASE/kitchen/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready"}'
```

**Expected:** `200` — order status: `ready`, waiter notified

---

## STEP 11 — Waiter: Serve Individual Items(WORKING)

```bash
login_waiter
curl -X PATCH $BASE/order-items/$ORDER_ITEM_1/serve \
  -H "Authorization: Bearer $WAITER_TOKEN"

curl -X PATCH $BASE/order-items/$ORDER_ITEM_2/serve \
  -H "Authorization: Bearer $WAITER_TOKEN"

curl -X PATCH $BASE/order-items/$ORDER_ITEM_3/serve \
  -H "Authorization: Bearer $WAITER_TOKEN"
```

**Expected:** `200` each — item status: `served`

---

## STEP 12 — Check Overdue Orders (Chef/Manager)(WORKING)

```bash
login_chef
curl $BASE/kitchen/branch/$BRANCH_ID/overdue \
  -H "Authorization: Bearer $CHEF_TOKEN"
```

**Expected:** `200` — empty array (our order is done), or overdue ones if any

---

## STEP 13 — Create a Takeaway Order

```bash
login_cashier
TAKEAWAY_JSON=$(curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $CASHIER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "'$TABLE_1_ID'",
    "order_type": "takeaway",
    "items": [
      {
        "menu_item_id": "'$ITEM_DAL_MAKHANI'",
        "quantity": 1
      }
    ]
  }')

echo "$TAKEAWAY_JSON" | jq
export TAKEAWAY_ORDER_ID=$(echo "$TAKEAWAY_JSON" | jq -r '.data.id')
echo "TAKEAWAY_ORDER_ID: $TAKEAWAY_ORDER_ID"
```

> `TAKEAWAY_ORDER_ID` is exported automatically above.

---

## STEP 14 — Create a Delivery Order

```bash
login_waiter
DELIVERY_JSON=$(curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "'$TABLE_1_ID'",
    "order_type": "delivery",
    "items": [
      {
        "menu_item_id": "'$ITEM_PANEER_TIKKA'",
        "quantity": 2
      },
      {
        "menu_item_id": "'$ITEM_GARLIC_NAAN'",
        "quantity": 4
      }
    ]
  }')

echo "$DELIVERY_JSON" | jq
export DELIVERY_ORDER_ID=$(echo "$DELIVERY_JSON" | jq -r '.data.id')
echo "DELIVERY_ORDER_ID: $DELIVERY_ORDER_ID"
```

> `DELIVERY_ORDER_ID` is exported automatically above.

---

## STEP 15 — Cancel an Order (Manager)

```bash
login_manager
curl -X PATCH $BASE/orders/$TAKEAWAY_ORDER_ID/cancel \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Customer changed mind"}'
```

**Expected:** `200` — order status: `cancelled`

---

## ❌ Negative Tests

```bash
# Create order with empty items array → 400
login_waiter
curl -X POST $BASE/orders \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_id":"'$TABLE_1_ID'","order_type":"dine_in","items":[]}'

# Chef trying to go backwards: ready → preparing → 400
login_chef
curl -X PATCH $BASE/kitchen/orders/$ORDER_ID/status \
  -H "Authorization: Bearer $CHEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparing"}'

# Waiter cancelling order (not allowed) → 403
login_waiter
curl -X PATCH $BASE/orders/$ORDER_ID/cancel \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"test"}'

# Invalid order_type → 400
login_waiter
curl -X POST $BASE/orders \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_id":"'$TABLE_1_ID'","order_type":"pickup","items":[{"menu_item_id":"'$ITEM_PANEER_TIKKA'","quantity":1}]}'

# Get order that doesn't exist → 404
login_waiter
curl $BASE/orders/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $WAITER_TOKEN"
```
