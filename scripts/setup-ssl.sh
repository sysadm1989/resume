#!/usr/bin/env bash
# Ставит nginx + Let's Encrypt (webroot, без плагина nginx — он часто ломает challenge).
#
#   DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=alexnazarov89@yandex.ru ./scripts/setup-ssl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-${EMAIL:-}}"
UPSTREAM="${UPSTREAM:-127.0.0.1:8787}"
SITE_NAME="${SITE_NAME:-resume}"
WEBROOT="${WEBROOT:-/var/www/certbot}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=alexnazarov89@yandex.ru $0"
  exit 1
fi
if [[ -z "$EMAIL" ]]; then
  echo "Укажите LETSENCRYPT_EMAIL=... для Let's Encrypt"
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
echo "==> apt: nginx certbot"
run apt-get update -y
apt_install nginx certbot curl
# плагин nginx не обязателен для webroot
apt_install python3-certbot-nginx || true

echo "==> webroot ACME: $WEBROOT"
run mkdir -p "$WEBROOT/.well-known/acme-challenge"
run chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true
run chmod -R a+rX "$WEBROOT"

echo "==> nginx HTTP (ACME + proxy)"
install_site "$ROOT/deploy/nginx/resume.conf.template"
run nginx -t
run systemctl enable --now nginx
run systemctl reload nginx

echo "==> self-check ACME"
echo "ok" | run tee "$WEBROOT/.well-known/acme-challenge/ping" >/dev/null
curl -fsS "http://127.0.0.1/.well-known/acme-challenge/ping" >/dev/null
curl -fsS "http://${DOMAIN}/.well-known/acme-challenge/ping" >/dev/null
echo "    ACME path OK"

echo "==> certbot certonly --webroot -d $DOMAIN"
run certbot certonly \
  --webroot \
  -w "$WEBROOT" \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring \
  --preferred-challenges http \
  --deploy-hook "systemctl reload nginx"

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
