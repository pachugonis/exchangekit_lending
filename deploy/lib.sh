#!/usr/bin/env bash
# Общие функции для deploy.sh и update.sh. Подключается через `source`.
# Не запускать напрямую.

set -euo pipefail

# ---------- Логирование ----------
c_reset=$'\033[0m'; c_blue=$'\033[1;34m'; c_green=$'\033[1;32m'
c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'

log()  { printf '%s==>%s %s\n' "$c_blue"  "$c_reset" "$*"; }
ok()   { printf '%s[ok]%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s[!]%s %s\n'  "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s[x]%s %s\n'  "$c_red"   "$c_reset" "$*" >&2; exit 1; }

# ---------- Пути ----------
# REPO_DIR должен быть выставлен вызывающим скриптом до подключения lib.sh.
: "${REPO_DIR:?REPO_DIR не задан}"

COMPOSE_BASE="$REPO_DIR/docker-compose.yml"
COMPOSE_PROD="$REPO_DIR/deploy/docker-compose.prod.yml"
NGINX_CONF="$REPO_DIR/nginx/conf.d/default.conf"
CERT_DIR="$REPO_DIR/deploy/certbot/conf"
WEBROOT_DIR="$REPO_DIR/deploy/certbot/www"
STATE_FILE="$REPO_DIR/deploy/.deploy.env"

# Обёртка над docker compose с фиксированным проектом и набором файлов.
dc() {
  docker compose -p exchangekit -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" "$@"
}

# ---------- Секреты ----------
gen_secret() { openssl rand -hex 32; }
gen_password() { openssl rand -base64 18 | tr -d '/+=' | cut -c1-20; }

# ---------- Состояние деплоя (домен/почта) ----------
save_state() {
  mkdir -p "$REPO_DIR/deploy"
  cat > "$STATE_FILE" <<EOF
# Сгенерировано deploy.sh — параметры деплоя. НЕ коммитить.
DOMAIN=$DOMAIN
LE_EMAIL=$LE_EMAIL
ADMIN_EMAIL=$ADMIN_EMAIL
EOF
  ok "Параметры деплоя сохранены в deploy/.deploy.env"
}

load_state() {
  [ -f "$STATE_FILE" ] || die "Не найден $STATE_FILE — сначала запустите deploy.sh"
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  : "${DOMAIN:?DOMAIN отсутствует в state}"
}

# ---------- Генерация .env (прод) ----------
# Создаёт .env только если его ещё нет; секреты генерируются один раз.
write_env() {
  local env_file="$REPO_DIR/.env"
  if [ -f "$env_file" ]; then
    warn ".env уже существует — оставляю как есть (секреты не пересоздаю)."
    return
  fi

  local pg_pass jwt secret
  pg_pass="$(gen_password)"
  jwt="$(gen_secret)"
  secret="$(gen_secret)"

  cat > "$env_file" <<EOF
# App (production) — сгенерировано deploy.sh
APP_BASE_URL=https://$DOMAIN
SECRET_KEY=$secret
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql+asyncpg://exchangekit:$pg_pass@db:5432/exchangekit
POSTGRES_USER=exchangekit
POSTGRES_PASSWORD=$pg_pass
POSTGRES_DB=exchangekit
REDIS_URL=redis://redis:6379/0

# YooKassa — ЗАПОЛНИТЬ боевыми ключами перед приёмом платежей!
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_RETURN_URL=https://$DOMAIN/payment/success
LICENSE_PRICE=29900.00

# Email (SMTP) — заполнить для писем верификации/выдачи лицензии
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@$DOMAIN

# JWT
JWT_SECRET=$jwt
JWT_EXPIRE_MINUTES=1440

# Frontend (SSR-rewrites внутри docker-сети идут на backend)
NEXT_PUBLIC_API_BASE_URL=http://backend:8000
EOF
  chmod 600 "$env_file"
  ok ".env сгенерирован с уникальными секретами (chmod 600)."
}

# ---------- Рендер nginx-конфига ----------
# render_nginx <mode>   mode = http | https
# http  — только 80 порт (работает до выпуска сертификата + отдаёт ACME-challenge)
# https — 80 редиректит на 443 (кроме ACME), полноценный TLS на 443
render_nginx() {
  local mode="$1"
  mkdir -p "$(dirname "$NGINX_CONF")"

  # Общая «шапка»: allowlist ЮКасса, апстримы, rate-limit зоны.
  cat > "$NGINX_CONF" <<'HEAD'
# ExchangeKit — reverse proxy (сгенерировано deploy.sh, не редактировать вручную).

geo $yookassa_allowed {
    default 0;
    185.71.76.0/27   1;
    185.71.77.0/27   1;
    77.75.153.0/25   1;
    77.75.156.11/32  1;
    77.75.156.35/32  1;
    77.75.154.128/25 1;
    2a02:5180::/32   1;
}

upstream backend_upstream  { server backend:8000; }
upstream frontend_upstream { server frontend:3000; }

limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=60r/m;
HEAD

  if [ "$mode" = "http" ]; then
    _nginx_server_block 80 "" >> "$NGINX_CONF"
  else
    # HTTP: только ACME + редирект на HTTPS.
    cat >> "$NGINX_CONF" <<HTTPREDIR

server {
    listen 80;
    server_name __DOMAIN__ www.__DOMAIN__;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}
HTTPREDIR
    _nginx_server_block 443 ssl >> "$NGINX_CONF"
  fi

  sed -i "s/__DOMAIN__/$DOMAIN/g" "$NGINX_CONF"
  ok "nginx-конфиг сгенерирован (режим: $mode)."
}

# Внутренний помощник: server-блок с проксированием.
# $1 = порт (80|443), $2 = "ssl" чтобы включить TLS.
_nginx_server_block() {
  local port="$1" ssl="${2:-}"

  if [ "$ssl" = "ssl" ]; then
    cat <<SSLHEAD

server {
    listen 443 ssl;
    http2 on;
    server_name __DOMAIN__ www.__DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
SSLHEAD
  else
    cat <<PLAINHEAD

server {
    listen 80;
    server_name __DOMAIN__ www.__DOMAIN__;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
PLAINHEAD
  fi

  # Общее тело (одинаково для http и https).
  cat <<'BODY'

    client_max_body_size 2m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Webhook ЮКасса — только с их IP-диапазонов.
    location = /api/payment/webhook {
        if ($yookassa_allowed = 0) { return 403; }
        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate-limit на auth.
    location ~ ^/api/(register|login)$ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
BODY
}

# ---------- Ожидание готовности БД ----------
wait_for_db() {
  log "Жду готовности PostgreSQL..."
  local i
  for i in $(seq 1 30); do
    if dc exec -T db pg_isready -U exchangekit -d exchangekit >/dev/null 2>&1; then
      ok "PostgreSQL готов."
      return 0
    fi
    sleep 2
  done
  die "PostgreSQL не поднялся за отведённое время."
}

# ---------- Миграции + импорт пула лицензий ----------
run_migrations() {
  log "Применяю миграции Alembic..."
  dc exec -T backend alembic upgrade head
  ok "Миграции применены."
}

import_licenses() {
  log "Импортирую пул лицензий из licenses_pool/..."
  dc exec -T backend python -m app.scripts.import_licenses || warn "Импорт лицензий завершился с предупреждением."
}
