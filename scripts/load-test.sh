#!/usr/bin/env bash
# Simple concurrent load to test multi-instance coordination and rate limiting
# Usage: ./scripts/load-test.sh <SESSION_ID> <SEAT_ID>

set -euo pipefail
SESSION_ID=${1:-}
SEAT_ID=${2:-}

if [ -z "$SESSION_ID" ] || [ -z "$SEAT_ID" ]; then
  echo "Usage: $0 <SESSION_ID> <SEAT_ID>"
  exit 1
fi

# Fire N concurrent reservation attempts from different users against the same seat
N=${N:-20}
TTL=${TTL:-30}
API=${API:-http://localhost:3000}

pids=()
for i in $(seq 1 $N); do
  USER_ID="user-$i"
  (
    curl -s -X POST "$API/reservations" \
      -H 'Content-Type: application/json' \
      -H "x-user-id: $USER_ID" \
      -H "Idempotency-Key: $USER_ID-$SESSION_ID-$SEAT_ID" \
      -d "{\"userId\":\"$USER_ID\",\"sessionId\":\"$SESSION_ID\",\"seatIds\":[\"$SEAT_ID\"],\"ttlSeconds\":$TTL}"
  ) &
  pids+=("$!")
done

# Wait for all
for p in "${pids[@]}"; do
  wait "$p" || true
done

# Show availability after race
curl -s "$API/sessions/$SESSION_ID/availability" | jq .

# Show HTTP status distribution if GNU parallel not available; quick summary via repeated calls
seq 1 100 | xargs -I{} curl -s -o /dev/null -w "%{http_code}\n" "$API/sessions/$SESSION_ID/availability" | sort | uniq -c
