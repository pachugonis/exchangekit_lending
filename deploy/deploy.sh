#!/usr/bin/env bash
#
# deploy.sh — bare-metal деплой ExchangeKit на чистый Ubuntu 24.04 (без Docker).
#
# Ставит и настраивает напрямую на сервере:
#   • PostgreSQL 16, Redis, Nginx, Python 3.12 (venv), Node.js 22 (NodeSource)
#   • фаервол ufw (22/80/443)
#   • БД + пользователь + расширения citext/pgcrypto
#   • .env с уникальными секретами
#   • systemd-сервисы backend (uvicorn) и frontend (next start)
#   • SSL Let's Encrypt (certbot webroot) + авто-renew
#   • миграции, импорт пула лицензий, создание администратора
#
# Идемпотентен: повторный запуск ничего не ломает.
#
# Использование (от root):
#   sudo ./deploy/deploy.sh \
#        --domain exchangekit.cc \
#        --admin-email admin@exchangekit.cc \
#        --le-email you@example.com \
#        [--admin-password 'Пароль'] \
#        [--repo https://github.com/pachugonis/exchangekit_lending.git] \
#        [--staging] [--no-firewall]

set -euo pipefail

DOMAIN=""; ADMIN_EMAIL=""; ADMIN_PASSWORD=""; LE_EMAIL=""
REPO_URL="https://github.com/pachugonis/exchangekit_lending.git"
STAGING=0; SETUP_FIREWALL=1

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)         DOMAIN="$2"; shift 2;;
    --admin-email)    ADMIN_EMAIL="$2"; shift 2;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2;;
    --le-email)       LE_EMAIL="$2"; shift 2;;
    --repo)           REPO_URL="$2"; shift 2;;
    --staging)        STAGING=1; shift;;
    --no-firewall)    SETUP_FIREWALL=0; shift;;
    -h|--help)        grep '^#' "$0" | sed 's/^# \?//'; exit 0;;
    *) echo "Неизвестный аргумент: $1" >&2; exit 1;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Запускайте через sudo / от root." >&2; exit 1; }

# Простой fail до подключения lib.sh (на ранних шагах установки).
fail() { printf '[x] %s\n' "$*" >&2; exit 1; }
warn_plain() { printf '[!] %s\n' "$*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../backend/requirements.txt" ]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  REPO_DIR="/opt/exchangekit"
fi
export REPO_DIR

prompt() { local v; read -r -p "$1: " v; printf '%s' "$v"; }
[ -n "$DOMAIN" ]      || DOMAIN="$(prompt 'Домен (например exchangekit.cc)')"
[ -n "$LE_EMAIL" ]    || LE_EMAIL="$(prompt 'Email для Let'\''s Encrypt')"
[ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="$(prompt 'Email администратора')"

# ---------- Системные пакеты ----------
install_prereqs() {
  echo "==> Устанавливаю системные пакеты (apt)..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y \
    ca-certificates curl git openssl ufw \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    certbot \
    python3 python3-venv python3-dev build-essential

  install_node

  systemctl enable --now postgresql redis-server nginx
}

# Текущая мажорная версия node (0, если не установлен).
node_major() { node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p' | head -1; }

# Установка Node.js 22 с фолбэками: NodeSource -> официальный бинарник (nodejs.org
# с зеркалом npmmirror). Next 16 требует Node >= 20.
install_node() {
  local have; have="$(node_major)"
  if [ -n "$have" ] && [ "$have" -ge 20 ]; then
    echo "==> Node.js уже установлен (v$have) — пропускаю."
    return
  fi

  echo "==> Ставлю Node.js 22 через NodeSource..."
  if curl -fsSL --connect-timeout 15 https://deb.nodesource.com/setup_22.x | bash - \
     && apt-get install -y nodejs; then
    have="$(node_major)"
    [ -n "$have" ] && [ "$have" -ge 20 ] && { echo "==> Node $(node -v) установлен."; return; }
  fi

  warn_plain "NodeSource недоступен — ставлю официальный бинарник Node.js."
  install_node_binary
}

# Скачивание официального статического бинарника Node в /usr/local.
install_node_binary() {
  local ver="v22.14.0" arch node_arch tarball url tmp
  arch="$(dpkg --print-architecture)"
  case "$arch" in
    amd64) node_arch="x64" ;;
    arm64) node_arch="arm64" ;;
    armhf) node_arch="armv7l" ;;
    *) fail "Неизвестная архитектура для Node: $arch" ;;
  esac
  tarball="node-${ver}-linux-${node_arch}.tar.xz"
  tmp="$(mktemp -d)"

  local m ok=0
  for m in \
    "https://nodejs.org/dist/${ver}/${tarball}" \
    "https://npmmirror.com/mirrors/node/${ver}/${tarball}"
  do
    echo "==> Скачиваю $m"
    if curl -fsSL --connect-timeout 20 -o "$tmp/$tarball" "$m"; then ok=1; break; fi
  done
  [ "$ok" -eq 1 ] || { rm -rf "$tmp"; fail "Не удалось скачать Node.js ни с одного зеркала."; }

  tar -xJf "$tmp/$tarball" -C /usr/local --strip-components=1
  rm -rf "$tmp"
  hash -r
  command -v node >/dev/null 2>&1 || fail "Node.js установлен, но не виден в PATH (/usr/local/bin)."
  echo "==> Node $(node -v) установлен из бинарника."
}

fetch_repo() {
  if [ -d "$REPO_DIR/.git" ]; then
    echo "==> Репозиторий на месте: $REPO_DIR"
  else
    echo "==> Клонирую $REPO_URL -> $REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  fi
}

setup_firewall() {
  [ "$SETUP_FIREWALL" -eq 1 ] || { echo "==> Фаервол пропущен."; return; }
  echo "==> Настраиваю ufw (22, 80, 443)..."
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
  ufw allow 80/tcp; ufw allow 443/tcp
  ufw --force enable
}

install_prereqs
fetch_repo
setup_firewall

# shellcheck disable=SC1091
source "$REPO_DIR/deploy/lib.sh"

# ---------- Системный пользователь ----------
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Создаю системного пользователя $APP_USER..."
  useradd --system --home-dir "$REPO_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

save_state
write_env

# ---------- PostgreSQL: роль, БД, расширения ----------
setup_database() {
  local pg_pass; pg_pass="$(db_password_from_env)"
  log "Настраиваю PostgreSQL (роль/БД/расширения)..."
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$pg_pass';"
  else
    sudo -u postgres psql -c "ALTER ROLE $DB_USER PASSWORD '$pg_pass';"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  fi
  sudo -u postgres psql -d "$DB_NAME" -c \
    "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;"
  ok "PostgreSQL настроен."
}
setup_database

# ---------- Сборка ----------
build_backend
build_frontend

# Права: всё приложение принадлежит сервисному пользователю.
chown -R "$APP_USER:$APP_USER" "$REPO_DIR"

# ---------- systemd-юниты ----------
install_units() {
  log "Устанавливаю systemd-юниты..."
  local u node_bin
  node_bin="$(command -v node)" || fail "node не найден в PATH."
  for u in backend frontend; do
    sed -e "s|__REPO_DIR__|$REPO_DIR|g" -e "s|__NODE_BIN__|$node_bin|g" \
      "$REPO_DIR/deploy/systemd/exchangekit-$u.service" \
      > "/etc/systemd/system/exchangekit-$u.service"
  done
  systemctl daemon-reload
  systemctl enable exchangekit-backend exchangekit-frontend
  ok "Юниты установлены."
}
install_units

# ---------- Запуск backend + миграции ----------
systemctl restart exchangekit-backend
wait_for_db
run_migrations
import_licenses
systemctl restart exchangekit-frontend

# ---------- Nginx (HTTP) + SSL ----------
mkdir -p "$WEBROOT_DIR"
rm -f /etc/nginx/sites-enabled/default
render_nginx http
nginx -t && systemctl reload nginx

issue_cert() {
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    ok "Сертификат для $DOMAIN уже есть — пропускаю выпуск."; return
  fi
  log "Выпускаю SSL-сертификат Let's Encrypt для $DOMAIN..."
  local staging=""; [ "$STAGING" -eq 1 ] && staging="--staging"
  certbot certonly --webroot -w "$WEBROOT_DIR" \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --email "$LE_EMAIL" --agree-tos --no-eff-email --non-interactive $staging \
    --deploy-hook "systemctl reload nginx" \
    || die "Не удалось выпустить сертификат. Проверь A-запись домена и доступность порта 80."
  ok "Сертификат получен."
}
issue_cert

log "Включаю HTTPS..."
render_nginx https
nginx -t && systemctl reload nginx
ok "HTTPS включён."

# ---------- Администратор ----------
[ -n "$ADMIN_PASSWORD" ] || { ADMIN_PASSWORD="$(gen_password)"; GENERATED_PW=1; }
log "Создаю администратора $ADMIN_EMAIL..."
backend_run "$VENV/bin/python" -m app.scripts.create_admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD"

# ---------- Итог ----------
echo
ok "============================================================"
ok " ExchangeKit развёрнут: https://$DOMAIN"
ok "============================================================"
echo  "  Админ-логин : $ADMIN_EMAIL"
[ "${GENERATED_PW:-0}" -eq 1 ] && echo "  Админ-пароль: $ADMIN_PASSWORD   (сохраните!)"
echo
echo  "  Сервисы:  systemctl status exchangekit-backend exchangekit-frontend"
echo  "  Логи:     journalctl -u exchangekit-backend -f"
echo  "  Дальше:   впишите ключи YooKassa и SMTP в $REPO_DIR/.env и"
echo  "            sudo systemctl restart exchangekit-backend"
echo  "  Лицензии: положите .txt в $REPO_DIR/licenses_pool/ и sudo $REPO_DIR/deploy/update.sh"
echo  "  Обновление из GitHub:  sudo $REPO_DIR/deploy/update.sh"
echo
