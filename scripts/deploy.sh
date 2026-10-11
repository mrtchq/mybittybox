#!/usr/bin/env bash
# Deploy Bitty Box (mybittybox) to staging or production.
#
#   bash scripts/deploy.sh staging             -> replaces test.bittybox.org root
#   bash scripts/deploy.sh prod --replace      -> replaces bittybox.org root
#   bash scripts/deploy.sh staging studio      -> test.bittybox.org/studio/
#   bash scripts/deploy.sh prod studio         -> bittybox.org/studio/
#
# A sub-path deploy (e.g. "studio") is the SAFE coexistence mode: it builds the
# SPA with base=/<subpath>/ so its asset URLs can never collide with the legacy
# static site, and it wipes ONLY <docroot>/<subpath> — the rest of the docroot
# is untouched.
#
# A root deploy replaces the whole docroot and is therefore refused when the
# build does not provide files that are already there, unless --replace is
# given. That guard exists because bittybox.org currently serves a different
# application (a vanilla-JS/Quill multi-page site) from the same directory.
#
# Promotes ONLY static assets. dist/server.cjs is the AI Studio dev server and
# is never published into a docroot.
set -euo pipefail

TARGET=""
SUBPATH=""
REPLACE=0
for arg in "$@"; do
  case "$arg" in
    staging|prod) TARGET="$arg" ;;
    --replace)    REPLACE=1 ;;
    -*)           echo "unknown flag: $arg" >&2; exit 2 ;;
    *)            SUBPATH="$arg" ;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$TARGET" in
  staging)
    DOCROOT=/var/www/test.bittybox.org/docs
    SERVICE=bittybox-test.service
    NGINX_CONF=/etc/nginx/sites-available/test.bittybox.org.conf
    HOST=https://test.bittybox.org
    ;;
  prod)
    DOCROOT=/var/www/bittybox.org/docs
    SERVICE=bittybox-api.service
    NGINX_CONF=/etc/nginx/sites-available/bittybox.org.conf
    HOST=https://bittybox.org
    ;;
  *)
    echo "usage: $0 staging|prod [subpath] [--replace]" >&2
    exit 2
    ;;
esac

if [ -n "$SUBPATH" ]; then
  DOCDIR="$DOCROOT/$SUBPATH"
  VITE_BASE="/$SUBPATH/"
  TARGETDESC="$TARGET/$SUBPATH"
else
  DOCDIR="$DOCROOT"
  VITE_BASE="/"
  TARGETDESC="$TARGET"
fi

cd "$REPO"

echo "=== build (base=$VITE_BASE) ==="
[ -f .env ] || { echo "ERROR: .env missing. Run: cp /var/www/bittybox.org/.env .env" >&2; exit 1; }
VITE_BASE="$VITE_BASE" npm run build

DIST="$REPO/dist"
[ -f "$DIST/index.html" ] || { echo "ERROR: dist/index.html missing — build failed." >&2; exit 1; }

# asset URLs must actually be scoped to the sub-path, or they would collide
if [ -n "$SUBPATH" ]; then
  if ! grep -qF "/$SUBPATH/assets/" "$DIST/index.html"; then
    echo "ERROR: build did not scope assets to /$SUBPATH/ — refusing." >&2
    grep -oE '(src|href)="[^"]*"' "$DIST/index.html" | head -5 >&2
    exit 1
  fi
  echo "  assets correctly scoped to /$SUBPATH/"
fi

echo "=== pre-flight: what this build does NOT provide ==="
if [ -d "$DOCDIR" ]; then
  removed=0
  PRESERVE="altaychat-room.html"
  while IFS= read -r rel; do
    [ -z "$rel" ] && continue
    case " $PRESERVE " in *" $rel "*) continue ;; esac
    if [ ! -e "$DIST/$rel" ]; then
      echo "  would be REMOVED: $rel"
      removed=$((removed + 1))
    fi
  done < <(cd "$DOCDIR" && find . -type f -not -path './.*' | sed 's|^\./||')
  echo "  files that would be removed: $removed"
  if [ "$removed" -gt 0 ] && [ "$REPLACE" != 1 ]; then
    echo "" >&2
    echo "REFUSING: this would remove $removed file(s) not present in the build." >&2
    echo "That is a wholesale replacement, not a promotion. Review the list above." >&2
    echo "If it is genuinely intended, re-run with --replace." >&2
    exit 3
  fi
fi

echo "=== snapshot ==="
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SNAP="/root/backups/${TARGETDESC//\//-}-pre-deploy-$TS.tar.gz"
mkdir -p /root/backups
if [ -d "$DOCDIR" ]; then
  tar czf "$SNAP" -C "$DOCDIR" .
  echo "  $SNAP"
fi

# Preserve pages owned by other live services on this host (root deploys only).
KEEP="$(mktemp -d)"
if [ -z "$SUBPATH" ]; then
  for page in altaychat-room.html; do
    [ -f "$DOCROOT/$page" ] && cp -p "$DOCROOT/$page" "$KEEP/$page"
  done
fi

echo "=== promote static files ==="
mkdir -p "$DOCDIR"
find "$DOCDIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$DIST"/. "$DOCDIR"/
rm -f "$DOCDIR/server.cjs" "$DOCDIR/server.cjs.map"
cp -p "$KEEP"/* "$DOCDIR"/ 2>/dev/null || true
rm -rf "$KEEP"

find "$DOCDIR" -type d -exec chmod 755 {} +
find "$DOCDIR" -type f -exec chmod 644 {} +

if [ -z "$SUBPATH" ]; then
  echo "=== restart $SERVICE ==="
  systemctl restart "$SERVICE"
else
  echo "=== nginx location for /$SUBPATH/ ==="
  if ! grep -q "location \^~ /$SUBPATH/" "$NGINX_CONF"; then
    echo "  NOTE: no 'location ^~ /$SUBPATH/' in $NGINX_CONF — add it and reload nginx." >&2
  else
    echo "  present"
  fi
fi

echo "=== verify: served == built (sha256) ==="
fail=0
URLPREFIX=""
[ -n "$SUBPATH" ] && URLPREFIX="/$SUBPATH"
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  b="$(sha256sum "$DIST/$rel" | cut -d' ' -f1)"
  s="$(curl -fsS --max-time 25 "$HOST$URLPREFIX/$rel" | sha256sum | cut -d' ' -f1)"
  if [ "$b" = "$s" ]; then
    echo "  MATCH $rel"
  else
    echo "  DIFF  $rel"
    fail=1
  fi
done < <(cd "$DIST" && find . -type f ! -name 'server.cjs*' | sed 's|^\./||')

echo
echo "=== backend health ==="
curl -fsS --max-time 15 "$HOST/api/health" | head -c 200 || echo "  (health check failed)"
echo
[ "$fail" = 0 ] && echo "DEPLOY OK -> $TARGETDESC" || { echo "DEPLOY VERIFY FAILED" >&2; exit 1; }
