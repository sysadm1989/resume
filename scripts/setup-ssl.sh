#!/usr/bin/env bash
# Ставит nginx + certbot на хосте и выпускает Let's Encrypt для DOMAIN.
# Проверено на Ubuntu 22.04 / 24.04 / 26.04 (resolute).
#
#   DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=sysadm1989@gmail.com ./scripts/setup-ssl.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-${EMAIL:-}}"
UPSTREAM="${UPSTREAM:-127.0.0.1:8787}"
SITE_NAME="${SITE_NAME:-resume}"
WEBROOT="${WEBROOT:-/var/www/certbot}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: DOMAIN=alexnazarov.site LETSENCRYPT_EMAIL=sysadm1989@gmail.com $0"
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

# apt с noninteractive — через env, иначе sudo воспринимает VAR= как команду
apt_install() {
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

echo "==> OS: $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"

echo "==> apt: nginx certbot"
run apt-get update -y

# Ubuntu 26: python3-certbot-nginx в universe
if ! apt-cache show python3-certbot-nginx >/dev/null 2>&1; then
  echo "==> пакет python3-certbot-nginx не найден — включаю universe"
  apt_install software-properties-common || true
  if command -v add-apt-repository >/dev/null 2>&1; then
    run add-apt-repository -y universe || true
  fi
  run apt-get update -y
fi

apt_install nginx certbot python3-certbot-nginx curl

echo "==> webroot ACME: $WEBROOT"
run mkdir -p "$WEBROOT"
run chown -R www-data:www-data "$WEBROOT" 2>/dev/null || true

TEMPLATE="$ROOT/deploy/nginx/resume.conf.template"
TMP="$(mktemp)"
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__UPSTREAM__|${UPSTREAM}|g" "$TEMPLATE" > "$TMP"

if [[ -d /etc/nginx/sites-available ]]; then
  run cp "$TMP" "/etc/nginx/sites-available/${SITE_NAME}.conf"
  run ln -sfn "/etc/nginx/sites-available/${SITE_NAME}.conf" "/etc/nginx/sites-enabled/${SITE_NAME}.conf"
  run rm -f /etc/nginx/sites-enabled/default || true
else
  run cp "$TMP" "/etc/nginx/conf.d/${SITE_NAME}.conf"
fi
rm -f "$TMP"

run nginx -t
run systemctl enable --now nginx
run systemctl reload nginx

echo "==> certbot --nginx -d $DOMAIN"
run certbot --nginx \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --redirect \
  --keep-until-expiring

run nginx -t
run systemctl reload nginx

echo "==> SSL ok: https://${DOMAIN}"
curl -fsSI "https://${DOMAIN}/api/health" | head -5 || true
