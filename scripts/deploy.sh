#!/usr/bin/env bash
# Deploy Bitty Box (mybittybox) to staging or production.
#
#   bash scripts/deploy.sh staging   -> test.bittybox.org
#   bash scripts/deploy.sh prod      -> bittybox.org
#
# Promotes ONLY static assets. dist/server.cjs is the AI Studio dev server and
# is never published into a docroot.
set -euo pipefail

TARGET="${1:-}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$TARGET" in
  staging)
    DOCROOT=/var/www/test.bittybox.org/docs
    SERVICE=bittybox-test.service
    SNAPSHOT=optional
    ;;
  prod)
    DOCROOT=/var/www/bittybox.org/docs
    SERVICE=bittybox-api.service
    SNAPSHOT=required
    ;;
  *)
    echo "usage: $0 staging|prod" >&2
    exit 2
    ;;
esac

cd "$REPO"

echo "=== build ==="
[ -f .env ] || { echo "ERROR: .env missing. Run: cp /var/www/bittybox.org/.env .env" >&2; exit 1; }
npm run build

DIST="$REPO/dist"
[ -f "$DIST/index.html" ] || { echo "ERROR: dist/index.html missing — build failed." >&2; exit 1; }

echo "=== pre-flight: what this build does NOT provide ==="
if [ -d "$DOCROOT" ]; then
  removed=0
  PRESERVE="altaychat-room.html"
  while IFS= read -r rel; do
    [ -z "$rel" ] && continue
    case " $PRESERVE " in *" $rel "*) continue ;; esac
    if [ ! -e "$DIST/$rel" ]; then
      echo "  would be REMOVED: $rel"
      removed=$((removed + 1))
    fi
  done < <(cd "$DOCROOT" && find . -type f -not -path './.*' | sed 's|^\./||')
  echo "  files that would be removed: $removed"
  if [ "$removed" -gt 0 ] && [ "${2:-}" != "--replace" ]; then
    echo "" >&2
    echo "REFUSING: this would remove $removed file(s) not present in the build." >&2
    echo "That is a wholesale replacement, not a promotion. Review the list above." >&2
    echo "If it is genuinely intended, re-run:" >&2
    echo "    bash scripts/deploy.sh $TARGET --replace" >&2
    exit 3
  fi
fi

echo "=== snapshot ==="
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SNAP="/root/backups/${TARGET}-pre-deploy-$TS.tar.gz"
mkdir -p /root/backups
if [ -d "$DOCROOT" ]; then
  tar czf "$SNAP" -C "$DOCROOT" .
  echo "  $SNAP"
elif [ "$SNAPSHOT" = required ]; then
  echo "ERROR: prod docroot $DOCROOT missing." >&2
  exit 1
fi

# Preserve pages owned by other live services on this host.
KEEP="$(mktemp -d)"
for page in altaychat-room.html; do
  [ -f "$DOCROOT/$page" ] && cp -p "$DOCROOT/$page" "$KEEP/$page"
done

echo "=== promote static files ==="
find "$DOCROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$DIST"/. "$DOCROOT"/
rm -f "$DOCROOT/server.cjs" "$DOCROOT/server.cjs.map"
cp -p "$KEEP"/* "$DOCROOT"/ 2>/dev/null || true
rm -rf "$KEEP"

chmod 755 "$DOCROOT"
find "$DOCROOT" -type d -exec chmod 755 {} +
find "$DOCROOT" -type f -exec chmod 644 {} +

echo "=== restart $SERVICE ==="
systemctl restart "$SERVICE"

echo "=== verify: served == built (sha256) ==="
HOST=$([ "$TARGET" = prod ] && echo https://bittybox.org || echo https://test.bittybox.org)
fail=0
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  b="$(sha256sum "$DIST/$rel" | cut -d' ' -f1)"
  s="$(curl -fsS --max-time 25 "$HOST/$rel" | sha256sum | cut -d' ' -f1)"
  if [ "$b" = "$s" ]; then
    echo "  MATCH $rel"
  else
    echo "  DIFF  $rel"
    fail=1
  fi
done < <(cd "$DIST" && find . -type f ! -name 'server.cjs*' | sed 's|^\./||')

echo
echo "=== backend health ==="
curl -fsS --max-time 15 "https://${HOST#https://}/api/health" | head -c 200 || echo "  (health check failed)"
echo
[ "$fail" = 0 ] && echo "DEPLOY OK -> $TARGET" || { echo "DEPLOY VERIFY FAILED" >&2; exit 1; }
