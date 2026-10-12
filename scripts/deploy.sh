#!/usr/bin/env bash
# Deploy Bitty Box (mybittybox) to staging or production.
#
#   bash scripts/deploy.sh staging             -> replaces test.bittybox.org root
#   bash scripts/deploy.sh prod --replace      -> replaces bittybox.org root
#
# The "studio" sub-path target is RETIRED (2026-10-12). /studio/ used to hold a
# second copy of this SPA beside the legacy front door; once the front door
# itself became this SPA, the sub-tree could only drift out of step, so nginx now
# 301s /studio and /studio/* to / on both hosts. Do not redeploy into it.
#
# The root deploy no longer overwrites another application: bittybox.org's
# docroot now holds this SPA plus the /privacy and /terms pages and their
# assets. The guard below is kept as a change-detector — it still refuses a root
# deploy that would silently drop files already in the docroot unless --replace
# is given, so a legal page or an icon can never disappear unnoticed.
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

# Paths in a ROOT docroot that this build does not own. A root promote wipes the
# docroot before copying dist/, so anything not in dist/ must be carried across
# explicitly or it disappears from a live site. The legal pages matter most:
# /privacy and /terms are served by explicit Express routes that read these
# docroot files, so losing them does not 404 — it silently serves the SPA shell
# with a healthy 200, which is exactly how a legal page goes missing unnoticed.
PRESERVE_PATHS=(
  altaychat-room.html   # staging-only test page owned by another service
  privacy.html
  terms.html
  LICENSE.txt
  cognitive-theme.css
  favicon.svg
  theme-fonts
)

is_preserved() {
  local rel="$1" p
  for p in "${PRESERVE_PATHS[@]}"; do
    [ "$rel" = "$p" ] && return 0
    case "$rel" in "$p"/*) return 0 ;; esac
  done
  return 1
}

echo "=== pre-flight: what this build does NOT provide ==="
if [ -d "$DOCDIR" ]; then
  removed=0
  while IFS= read -r rel; do
    [ -z "$rel" ] && continue
    is_preserved "$rel" && continue
    if [ ! -e "$DIST/$rel" ]; then
      echo "  would be REMOVED: $rel"
      removed=$((removed + 1))
    fi
  done < <(cd "$DOCDIR" && find . -type f -not -path './.*' | sed 's|^\./||')
  echo "  files that would be removed: $removed"
  # The guard protects a ROOT docroot, which other applications share.
  # A sub-path directory is owned entirely by this build, so stale files
  # there (e.g. superseded hashed bundles) are expected and simply pruned.
  if [ "$removed" -gt 0 ] && [ "$REPLACE" != 1 ] && [ -z "$SUBPATH" ]; then
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
  for p in "${PRESERVE_PATHS[@]}"; do
    [ -e "$DOCROOT/$p" ] && cp -a "$DOCROOT/$p" "$KEEP/" && echo "  carry across: $p"
  done
fi

echo "=== promote static files ==="
mkdir -p "$DOCDIR"
find "$DOCDIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$DIST"/. "$DOCDIR"/
rm -f "$DOCDIR/server.cjs" "$DOCDIR/server.cjs.map"
cp -a "$KEEP"/. "$DOCDIR"/ 2>/dev/null || true
rm -rf "$KEEP"

find "$DOCDIR" -type d -exec chmod 755 {} +
find "$DOCDIR" -type f -exec chmod 644 {} +

if [ -z "$SUBPATH" ]; then
  echo "=== restart $SERVICE ==="
  systemctl restart "$SERVICE"
  # The verification below curls the live host on the next line. Without a
  # readiness wait the first requests land inside the restart window and come
  # back 502, which aborts the run under `set -e` and reports a failure on a
  # perfectly healthy deploy. Poll the real health endpoint instead.
  ready=no
  for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HOST/api/health" || true)" = 200 ]; then
      ready=yes
      break
    fi
    sleep 1
  done
  echo "  backend ready: $ready"
  [ "$ready" = yes ] || { echo "WARNING: health endpoint not 200 after 30s" >&2; }
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
  # `|| true` keeps a transient fetch failure from aborting the whole run under
  # `set -e`; it is reported as a DIFF instead, which is what it is.
  s="$(curl -fsS --max-time 25 "$HOST$URLPREFIX/$rel" 2>/dev/null | sha256sum | cut -d' ' -f1 || true)"
  if [ "$b" = "$s" ]; then
    echo "  MATCH $rel"
  else
    echo "  DIFF  $rel"
    fail=1
  fi
done < <(cd "$DIST" && find . -type f ! -name 'server.cjs*' | sed 's|^\./||')

echo
echo "=== verify: operator-owned pages survived the promote ==="
# A legal page that reverts to the SPA shell returns a healthy 200, so byte
# equality alone is not enough — the served page must differ from index.html.
SHELL_SHA="$(sha256sum "$DIST/index.html" | cut -d' ' -f1)"
for page in privacy.html terms.html; do
  if [ ! -f "$DOCROOT/$page" ]; then
    echo "  MISSING $page on disk"
    fail=1
    continue
  fi
  b="$(sha256sum "$DOCROOT/$page" | cut -d' ' -f1)"
  s="$(curl -fsS --max-time 25 "$HOST/$page" | sha256sum | cut -d' ' -f1)"
  if [ "$s" != "$b" ]; then
    echo "  DIFF  /$page served != disk"
    fail=1
  elif [ "$s" = "$SHELL_SHA" ]; then
    echo "  FAIL  /$page is serving the SPA shell, not the legal page"
    fail=1
  else
    echo "  OK    /$page is the real page ($(wc -c < "$DOCROOT/$page") bytes)"
  fi
  # the extension-less clean URLs are explicit Express routes, not static files
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HOST/${page%.html}")"
  [ "$code" = 200 ] && echo "  OK    /${page%.html} -> $code" || { echo "  FAIL  /${page%.html} -> $code"; fail=1; }
done

echo
echo "=== backend health ==="
curl -fsS --max-time 15 "$HOST/api/health" | head -c 200 || echo "  (health check failed)"
echo
[ "$fail" = 0 ] && echo "DEPLOY OK -> $TARGETDESC" || { echo "DEPLOY VERIFY FAILED" >&2; exit 1; }
