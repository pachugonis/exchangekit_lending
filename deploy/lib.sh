#!/usr/bin/env bash
# Общие функции для deploy.sh и update.sh (bare-metal, без Docker).
# Подключается через `source`. Не запускать напрямую.

set -euo pipefail

# ---------- Логирование ----------
c_reset=$'\033[0m'; c_blue=$'\033[1;34m'; c_green=$'\033[1;32m'
c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'
log()  { printf '%s==>%s %s\n' "$c_blue"   "$c_reset" "$*"; }
ok()   { printf '%s[ok]%s %s\n' "$c_green"  "$c_reset" "$*"; }
warn() { printf '%s[!]%s %s\n'  "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s[x]%s %s\n'  "$c_red"    "$c_reset" "$*" >&2; exit 1; }

# ---------- Пути ----------
: "${REPO_DIR:?REPO_DIR не задан}"
VENV="$REPO_DIR/.venv"
ENV_FILE="$REPO_DIR/.env"
STATE_FILE="$REPO_DIR/deploy/.deploy.env"
NGINX_CONF="/etc/nginx/conf.d/exchangekit.conf"
WEBROOT_DIR="/var/www/certbot"
APP_USER="exchangekit"
DB_NAME="exchangekit"
DB_USER="exchangekit"

# ---------- Секреты ----------
gen_secret()   { openssl rand -hex 32; }
gen_password() { openssl rand -base64 18 | tr -d '/+=' | cut -c1-20; }

# ---------- Состояние деплоя ----------
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

# ---------- Чтение пароля БД из .env (для update) ----------
db_password_from_env() {
  grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-
}

# ---------- Генерация .env ----------
# Создаёт .env один раз; при повторном запуске не трогает (секреты стабильны).
write_env() {
  if [ -f "$ENV_FILE" ]; then
    warn ".env уже существует — оставляю как есть."
    return
  fi
  local pg_pass jwt secret
  pg_pass="$(gen_password)"; jwt="$(gen_secret)"; secret="$(gen_secret)"

  cat > "$ENV_FILE" <<EOF
# App (production) — сгенерировано deploy.sh
APP_BASE_URL=https://$DOMAIN
SECRET_KEY=$secret
ENVIRONMENT=production

# Database (локальный PostgreSQL)
DATABASE_URL=postgresql+asyncpg://$DB_USER:$pg_pass@localhost:5432/$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$pg_pass
POSTGRES_DB=$DB_NAME
REDIS_URL=redis://localhost:6379/0

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

# Frontend (запрос к API локально; в браузере всё идёт через nginx /api)
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
EOF
  chmod 600 "$ENV_FILE"
  ok ".env сгенерирован с уникальными секретами (chmod 600)."
}

# Выполнить команду backend в окружении из .env (CWD = backend/).
backend_run() {
  ( set -a; # shellcheck disable=SC1090
    . "$ENV_FILE"; set +a
    cd "$REPO_DIR/backend"
    "$@" )
}

# ---------- Рендер nginx-конфига ----------
# render_nginx <http|https>
render_nginx() {
  local mode="$1"
  cat > "$NGINX_CONF" <<'HEAD'
# ExchangeKit — reverse proxy (сгенерировано deploy.sh, не редактировать вручную).


upstream backend_upstream  { server 127.0.0.1:8000; }
upstream frontend_upstream { server 127.0.0.1:3000; }

limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=60r/m;
HEAD

  if [ "$mode" = "http" ]; then
    _nginx_server_block 80 "" >> "$NGINX_CONF"
  else
    cat >> "$NGINX_CONF" <<HTTPREDIR

server {
    listen 80;
    server_name __DOMAIN__ www.__DOMAIN__;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
HTTPREDIR
    _nginx_server_block 443 ssl >> "$NGINX_CONF"
  fi

  sed -i "s/__DOMAIN__/$DOMAIN/g" "$NGINX_CONF"
  ok "nginx-конфиг сгенерирован (режим: $mode)."
}

_nginx_server_block() {
  local ssl="${2:-}"
  if [ "$ssl" = "ssl" ]; then
    cat <<SSLHEAD

server {
    # http2 в одной директиве listen — совместимо с nginx < 1.25.1 (Ubuntu 24.04 = 1.24).
    listen 443 ssl http2;
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
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
PLAINHEAD
  fi

  cat <<'BODY'

    client_max_body_size 2m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Webhook ЮКасса. IP-фильтр намеренно не используем: бэкенд на каждый
    # вызов заново проверяет статус платежа через API ЮКасса (секретный ключ),
    # поэтому подделать выдачу лицензии через этот URL нельзя. Rate-limit —
    # только чтобы эндпоинт нельзя было заспамить.
    location = /api/payment/webhook {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

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

# ---------- БД: миграции + импорт пула ----------
wait_for_db() {
  log "Жду готовности PostgreSQL..."
  local i
  for i in $(seq 1 30); do
    if pg_isready -h localhost -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      ok "PostgreSQL готов."; return 0
    fi
    sleep 1
  done
  die "PostgreSQL не отвечает."
}

run_migrations() {
  log "Применяю миграции Alembic..."
  backend_run "$VENV/bin/alembic" upgrade head
  ok "Миграции применены."
}

import_licenses() {
  log "Импортирую пул лицензий из licenses_pool/..."
  backend_run "$VENV/bin/python" -m app.scripts.import_licenses "$REPO_DIR/licenses_pool" \
    || warn "Импорт лицензий завершился с предупреждением."
}

# ---------- Сборка приложения ----------
build_backend() {
  log "Создаю Python venv и ставлю зависимости..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip wheel >/dev/null
  "$VENV/bin/pip" install -r "$REPO_DIR/backend/requirements.txt"
  ok "Backend-зависимости установлены."
}

build_frontend() {
  log "Ставлю зависимости и собираю фронтенд (может занять пару минут)..."
  ( cd "$REPO_DIR/frontend"
    npm install --no-audit --no-fund
    npm run build )
  ok "Фронтенд собран."
}

# Проверить конфиг и перезагрузить nginx. Падает громко, если конфиг невалиден,
# чтобы битый конфиг не проходил молча (nginx -t && reload так не умеет под set -e).
nginx_reload() {
  nginx -t || die "nginx: конфиг невалиден (см. вывод выше) — reload отменён."
  systemctl reload nginx
  ok "nginx перезагружен."
}

# ---------- systemd ----------
restart_services() {
  log "Перезапускаю сервисы..."
  systemctl restart exchangekit-backend exchangekit-frontend
  ok "Сервисы перезапущены."
}
