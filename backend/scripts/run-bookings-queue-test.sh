#!/usr/bin/env bash
set -euo pipefail

# Run the bookings & queue curl tests from docs/Testing/07-bookings-queue.md
# Usage:
#   BASE="http://localhost:5001/api/v1" CUSTOMER_TOKEN="..." HOST_TOKEN="..." BRANCH_ID="..." bash backend/scripts/run-bookings-queue-test.sh
#   or run with --auto to skip prompts: bash backend/scripts/run-bookings-queue-test.sh --auto

BASE_DEFAULT="http://localhost:5001/api/v1"
BASE="${BASE:-$BASE_DEFAULT}"
AUTO=false

for arg in "$@"; do
  case "$arg" in
    --auto) AUTO=true ;;
  esac
done

run_cmd() {
  desc="$1"; shift
  cmd="$@"
  echo
  echo "--- $desc ---"
  echo "+ $cmd"
  eval $cmd
  echo
  if [ "$AUTO" = false ]; then
    read -r -p "Press Enter to continue..."
  fi
}

echo "Using BASE=$BASE"

# Bookings
run_cmd "STEP 1 — Customer Creates a Booking" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/bookings\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"booking_date\":\"2026-05-15\",\"booking_time\":\"19:30\",\"party_size\":4,\"special_requests\":\"Window seat preferred, one high chair needed\"}'"

run_cmd "STEP 2 — Customer Creates Another Booking (for cancel test)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/bookings\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"booking_date\":\"2026-05-20\",\"booking_time\":\"20:00\",\"party_size\":2,\"special_requests\":\"Anniversary dinner\"}'"

run_cmd "STEP 3 — Get My Bookings (Customer)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' \"$BASE/bookings/user/me\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\""

run_cmd "STEP 4 — Get Booking by ID" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' \"$BASE/bookings/$BOOKING_ID\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\""

run_cmd "STEP 5 — Get Branch Bookings (Host)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' \"$BASE/bookings/branch/$BRANCH_ID?date=2026-05-15\" -H \"Authorization: Bearer $HOST_TOKEN\""

run_cmd "STEP 6 — Customer Marks Arrived" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/bookings/$BOOKING_ID/arrived\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\""

run_cmd "STEP 7 — Host Seats the Guest" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/bookings/$BOOKING_ID/seat\" -H \"Authorization: Bearer $HOST_TOKEN\" -H \"Content-Type: application/json\" -d '{\"table_id\":\"'$TABLE_1_ID'\"}'"

run_cmd "STEP 8 — Customer Cancels Their Booking" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/bookings/$BOOKING_ID_2/cancel\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"reason\":\"Change of plans\"}'"

echo "Note: For STEP 9 and STEP 10 the script will POST new bookings but you should capture the returned IDs to run subsequent cancel/no-show patches manually."

run_cmd "STEP 9 — Create booking for manager cancel (then run cancel manually)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/bookings\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"booking_date\":\"2026-05-22\",\"booking_time\":\"13:00\",\"party_size\":6}'"

run_cmd "STEP 10 — Create booking for host no-show test (then run no-show manually)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/bookings\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"booking_date\":\"2026-05-10\",\"booking_time\":\"18:00\",\"party_size\":3}'"

# Queue
run_cmd "STEP 11 — Walk-in Joins Queue (public)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/queue/join\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"party_size\":3,\"name\":\"Raj Kapoor\",\"phone\":\"+919876540001\"}'"

run_cmd "STEP 12 — Another Walk-in Joins Queue" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/queue/join\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"party_size\":2,\"name\":\"Meena Shah\",\"phone\":\"+919876540002\"}'"

run_cmd "STEP 13 — Get Branch Queue (Host)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' \"$BASE/queue/branch/$BRANCH_ID\" -H \"Authorization: Bearer $HOST_TOKEN\""

run_cmd "STEP 14 — Check Queue Position (replace QUEUE_ID_1)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' \"$BASE/queue/position/$QUEUE_ID_1\" -H \"Authorization: Bearer $HOST_TOKEN\""

run_cmd "STEP 15 — Mark First Guest as Arrived" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/queue/$QUEUE_ID_1/arrive\" -H \"Authorization: Bearer $HOST_TOKEN\""

run_cmd "STEP 16 — Assign Table to Queue Guest" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/queue/$QUEUE_ID_1/assign-table\" -H \"Authorization: Bearer $HOST_TOKEN\" -H \"Content-Type: application/json\" -d '{\"table_id\":\"'$TABLE_2_ID'\"}'"

run_cmd "STEP 17 — Mark Second Guest as No-Show" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X PATCH \"$BASE/queue/$QUEUE_ID_2/no-show\" -H \"Authorization: Bearer $HOST_TOKEN\""

run_cmd "STEP 18 — Add and Remove Someone from Queue (Manager)" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/queue/join\" -H \"Content-Type: application/json\" -d '{\"branch_id\":\"'$BRANCH_ID'\",\"party_size\":2,\"name\":\"Amit Roy\",\"phone\":\"+919876540003\"}' && echo '-> save id to QUEUE_ID_3 then run DELETE using MANAGER_TOKEN'"

# Geo check-in example
run_cmd "STEP 19 — Geo Arrival Check" \
  "curl -s -w '\nHTTP_CODE:%{http_code}\n' -X POST \"$BASE/geo/arrival-check\" -H \"Authorization: Bearer $CUSTOMER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"lat\":19.0760,\"lon\":72.8777,\"booking_id\":\"'$BOOKING_ID'\"}'"

echo
echo "Negative tests (examples) — run manually if desired:"
echo "  - Booking in the past -> expect 400"
echo "  - Party size 0 -> expect 400"
echo "  - Cancel already-cancelled booking -> expect 400"
echo
echo "Script finished. Capture IDs from responses and run any role-specific PATCH/DELETE calls manually using the tokens appropriate to each role."

exit 0
