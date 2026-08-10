#!/usr/bin/env bash
# Ставит nginx + certbot на хосте и выпускает Let's Encrypt для DOMAIN.
# Запускать на сервере из каталога проекта (/opt/resume).
#
# Пример:
#   DOMAIN=resume.example.com LETSENCRYPT_EMAIL=you@mail.com ./scripts/setup-ssl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-${EMAIL:-}}"
UPSTREAM="${UPSTREAM:-127.0.0.1:8787}"
SITE_NAME="${SITE_NAME:-resume}"
WEBROOT="${WEBROOT:-/var/www/certbot}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: DOMAIN=resume.example.com LETSENCRYPT_EMAIL=you@mail.com $0"
  exit 1
fi
if [[ -z "$EMAIL" ]]; then
  echo "Укажите LETSENCRYPT_EMAIL=... для Let's Encrypt"
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

echo "==> apt: nginx certbot"
$SUDO apt-get update -y
$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

echo "==> webroot ACME: $WEBROOT"
$SUDO mkdir -p "$WEBROOT"
$SUDO chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true

TEMPLATE="$ROOT/deploy/nginx/resume.conf.template"
TMP="$(mktemp)"
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__UPSTREAM__|${UPSTREAM}|g" "$TEMPLATE" > "$TMP"

if [[ -d /etc/nginx/sites-available ]]; then
  $SUDO cp "$TMP" "/etc/nginx/sites-available/${SITE_NAME}.conf"
  $SUDO ln -sfn "/etc/nginx/sites-available/${SITE_NAME}.conf" "/etc/nginx/sites-enabled/${SITE_NAME}.conf"
  # убрать дефолт, если мешает
  $SUDO rm -f /etc/nginx/sites-enabled/default || true
else
  $SUDO cp "$TMP" "/etc/nginx/conf.d/${SITE_NAME}.conf"
fi
rm -f "$TMP"

$SUDO nginx -t
$SUDO systemctl enable --now nginx
$SUDO systemctl reload nginx

echo "==> certbot --nginx -d $DOMAIN"
$SUDO certbot --nginx \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --redirect \
  --keep-until-expiring

$SUDO nginx -t
$SUDO systemctl reload nginx

echo "==> SSL ok: https://${DOMAIN}"
curl -fsSI "https://${DOMAIN}/api/health" | head -5 || true
