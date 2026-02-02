#!/bin/sh
# Minimal TCP host:port checker (POSIX sh)

CMDNAME=$(basename "$0")

QUIET=0
STRICT=0
TIMEOUT=15
CHILD=0

log() {
  [ "$QUIET" -ne 1 ] && echo "$@" >&2
}

usage() {
  echo "Usage:" >&2
  echo "  $CMDNAME host:port [--timeout=N] [--strict] [--quiet] -- command" >&2
  exit 1
}

# --------------------------------------------------
# Parse args
# --------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    *:*)
      HOST=$(echo "$1" | cut -d: -f1)
      PORT=$(echo "$1" | cut -d: -f2)
      shift
      ;;
    --timeout=*)
      TIMEOUT=$(echo "$1" | cut -d= -f2)
      shift
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --strict)
      STRICT=1
      shift
      ;;
    --quiet)
      QUIET=1
      shift
      ;;
    --child)
      CHILD=1
      shift
      ;;
    --)
      shift
      CMD="$@"
      break
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

[ -z "$HOST" ] && usage
[ -z "$PORT" ] && usage

# --------------------------------------------------
# Core check
# --------------------------------------------------
check_port() {
  START=$(date +%s)

  log "$CMDNAME: waiting for $HOST:$PORT"

  while :; do
    nc -z "$HOST" "$PORT" >/dev/null 2>&1 && return 0
    sleep 1
  done
}

# --------------------------------------------------
# Timeout wrapper (for SIGINT support)
# --------------------------------------------------
check_with_timeout() {
  timeout "$TIMEOUT" "$0" --child --host "$HOST" --port "$PORT" --quiet=$QUIET
}

# --------------------------------------------------
# Execution
# --------------------------------------------------
if [ "$CHILD" -eq 1 ]; then
  check_port
  exit $?
fi

if [ "$TIMEOUT" -gt 0 ]; then
  timeout "$TIMEOUT" sh -c "
    while :; do
      nc -z $HOST $PORT >/dev/null 2>&1 && exit 0
      sleep 1
    done
  "
  RESULT=$?
else
  check_port
  RESULT=$?
fi

if [ -n "$CMD" ]; then
  if [ "$RESULT" -ne 0 ] && [ "$STRICT" -eq 1 ]; then
    log "$CMDNAME: strict mode enabled, command not executed"
    exit "$RESULT"
  fi
  exec $CMD
fi

exit "$RESULT"
