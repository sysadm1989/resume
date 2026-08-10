#!/usr/bin/env bash
# Ставит nginx + Let's Encrypt.
#
# HTTP (если :80 доступен с интернета отовсюду):
#   DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=… ./scripts/setup-ssl.sh
#
# DNS-01 (рекомендуется на Timeweb, если LE пишет connection на :80):
#   DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=… ACME_MODE=dns ./scripts/setup-ssl.sh
#   → скрипт покажет TXT-запись, добавьте в панели DNS Timeweb, нажмите Enter
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-${EMAIL:-}}"
UPSTREAM="${UPSTREAM:-127.0.0.1:8787}"
SITE_NAME="${SITE_NAME:-resume}"
WEBROOT="${WEBROOT:-/var/www/certbot}"
ACME_MODE="${ACME_MODE:-http}" # http|dns

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=you@mail [ACME_MODE=dns] $0"
  exit 1
fi
if [[ -z "$EMAIL" ]]; then
  echo "Укажите LETSENCRYPT_EMAIL=..."
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO=(sudo)
else
  SUDO=()
fi

run() { "${SUDO[@]}" "$@"; }

apt_install() {
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

install_site() {
  local template="$1"
  local tmp
  tmp="$(mktemp)"
  sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__UPSTREAM__|${UPSTREAM}|g" "$template" > "$tmp"
  if [[ -d /etc/nginx/sites-available ]]; then
    run cp "$tmp" "/etc/nginx/sites-available/${SITE_NAME}.conf"
    run ln -sfn "/etc/nginx/sites-available/${SITE_NAME}.conf" "/etc/nginx/sites-enabled/${SITE_NAME}.conf"
    run rm -f /etc/nginx/sites-enabled/default || true
  else
    run cp "$tmp" "/etc/nginx/conf.d/${SITE_NAME}.conf"
  fi
  rm -f "$tmp"
}

ensure_ssl_options() {
  run mkdir -p /etc/letsencrypt
  if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    run tee /etc/letsencrypt/options-ssl-nginx.conf >/dev/null <<'EOF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
EOF
  fi
}

echo "==> OS: $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
echo "==> ACME_MODE=${ACME_MODE}"
echo "==> apt: nginx certbot"
run apt-get update -y
apt_install nginx certbot curl

echo "==> nginx HTTP"
run mkdir -p "$WEBROOT/.well-known/acme-challenge"
run chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true
run chmod -R a+rX "$WEBROOT"
install_site "$ROOT/deploy/nginx/resume.conf.template"
run nginx -t
run systemctl enable --now nginx
run systemctl reload nginx

if [[ "$ACME_MODE" == "dns" ]]; then
  echo "==> certbot DNS-01 (ручной TXT в панели Timeweb)"
  echo "    Когда certbot покажет _acme-challenge.${DOMAIN} → добавьте TXT и подождите 1–2 мин,"
  echo "    проверьте: dig +short TXT _acme-challenge.${DOMAIN} @ns1.timeweb.ru"
  echo
  run certbot certonly \
    --manual \
    --preferred-challenges dns \
    --manual-public-ip-logging-ok \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --keep-until-expiring
else
  echo "==> self-check ACME (локально)"
  echo "ok" | run tee "$WEBROOT/.well-known/acme-challenge/ping" >/dev/null
  curl -fsS "http://127.0.0.1/.well-known/acme-challenge/ping" >/dev/null
  echo "    local OK — если LE падает с connection, используйте ACME_MODE=dns"

  echo "==> certbot certonly --webroot -d $DOMAIN"
  run certbot certonly \
    --webroot \
    -w "$WEBROOT" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    --preferred-challenges http
fi

ensure_ssl_options

echo "==> nginx HTTPS"
install_site "$ROOT/deploy/nginx/resume-ssl.conf.template"
if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
  if [[ -d /etc/nginx/sites-available ]]; then
    CONF="/etc/nginx/sites-available/${SITE_NAME}.conf"
  else
    CONF="/etc/nginx/conf.d/${SITE_NAME}.conf"
  fi
  run sed -i '/ssl_dhparam/d' "$CONF"
fi

run nginx -t
run systemctl reload nginx

echo "==> SSL ok: https://${DOMAIN}"
curl -fsSI "https://${DOMAIN}/api/health" | head -8 || true
