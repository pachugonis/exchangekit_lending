#!/usr/bin/env bash
#
# deploy.sh — однокомандный деплой ExchangeKit на чистый Ubuntu 24.04 VPS.
#
# Делает всё:
#   • ставит Docker + compose plugin, git, openssl
#   • настраивает фаервол (ufw: 22/80/443)
#   • генерирует .env с уникальными секретами
#   • поднимает стек (db, redis, backend, frontend, nginx)
#   • выпускает SSL-сертификат Let's Encrypt и включает HTTPS
#   • применяет миграции, импортирует пул лицензий
#   • создаёт администратора
#   • вешает авто-обновление сертификата (cron)
#
# Идемпотентен: повторный запуск ничего не ломает.
#
# Использование (от root):
#   sudo ./deploy/deploy.sh \
#        --domain exchangekit.cc \
#        --admin-email admin@exchangekit.cc \
#        --le-email you@example.com \
#        [--admin-password 'Пароль'] \
#        [--repo git@github.com:pachugonis/exchangekit_lending.git] \
#        [--staging] [--no-firewall]
#
# Любой пропущенный обязательный параметр будет запрошен интерактивно.

set -euo pipefail

# ---------- Разбор аргументов ----------
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

# ---------- Определяем директорию репозитория ----------
# Если скрипт лежит внутри клонированного репо — используем его.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../docker-compose.yml" ]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  REPO_DIR="/opt/exchangekit"
fi
export REPO_DIR

# Запросить недостающее.
prompt() { local v; read -r -p "$1: " v; printf '%s' "$v"; }
[ -n "$DOMAIN" ]      || DOMAIN="$(prompt 'Домен (например exchangekit.cc)')"
[ -n "$LE_EMAIL" ]    || LE_EMAIL="$(prompt 'Email для Let'\''s Encrypt (уведомления о сертификате)')"
[ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="$(prompt 'Email администратора')"

# ---------- Установка системных пакетов ----------
install_prereqs() {
  echo "==> Устанавливаю зависимости системы..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl git openssl ufw

  if ! command -v docker >/dev/null 2>&1; then
    echo "==> Ставлю Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    local arch codename
    arch="$(dpkg --print-architecture)"
    codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
    echo "deb [arch=$arch signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $codename stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin
  fi
  systemctl enable --now docker
}

# ---------- Клонирование/обновление репо ----------
fetch_repo() {
  if [ -d "$REPO_DIR/.git" ]; then
    echo "==> Репозиторий уже на месте: $REPO_DIR"
  else
    echo "==> Клонирую $REPO_URL -> $REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  fi
}

# ---------- Фаервол ----------
setup_firewall() {
  [ "$SETUP_FIREWALL" -eq 1 ] || { echo "==> Фаервол пропущен (--no-firewall)."; return; }
  echo "==> Настраиваю ufw (22, 80, 443)..."
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

install_prereqs
fetch_repo
setup_firewall

# Теперь, когда репо точно есть, подключаем общую библиотеку.
# shellcheck disable=SC1091
source "$REPO_DIR/deploy/lib.sh"

mkdir -p "$CERT_DIR" "$WEBROOT_DIR"

save_state
write_env
[ -n "$ADMIN_PASSWORD" ] || { ADMIN_PASSWORD="$(gen_password)"; GENERATED_PW=1; }

# ---------- Фаза 1: HTTP-only nginx + старт стека ----------
log "Поднимаю стек (HTTP, до выпуска сертификата)..."
render_nginx http
dc up -d --build

wait_for_db
run_migrations
import_licenses

# ---------- Фаза 2: выпуск сертификата Let's Encrypt ----------
issue_cert() {
  if [ -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
    ok "Сертификат для $DOMAIN уже есть — пропускаю выпуск."
    return
  fi
  log "Выпускаю SSL-сертификат Let's Encrypt для $DOMAIN ..."
  local staging_flag=""
  [ "$STAGING" -eq 1 ] && staging_flag="--staging"
  dc run --rm certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --email "$LE_EMAIL" --agree-tos --no-eff-email \
    $staging_flag --non-interactive \
    || die "Не удалось выпустить сертификат. Проверь, что A-запись домена указывает на этот сервер и порт 80 открыт."
  ok "Сертификат получен."
}
issue_cert

# ---------- Фаза 3: включаем HTTPS ----------
log "Переключаю nginx на HTTPS..."
render_nginx https
dc exec -T nginx nginx -t && dc exec -T nginx nginx -s reload
ok "HTTPS включён."

# ---------- Создание администратора ----------
log "Создаю администратора $ADMIN_EMAIL ..."
dc exec -T backend python -m app.scripts.create_admin "$ADMIN_EMAIL" "$ADMIN_PASSWORD"

# ---------- Авто-обновление сертификата ----------
setup_renewal() {
  log "Настраиваю авто-обновление сертификата (cron)..."
  cat > /etc/cron.d/exchangekit-certbot <<EOF
# Обновление SSL ExchangeKit дважды в сутки + reload nginx
0 3,15 * * * root cd $REPO_DIR && docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml run --rm certbot certbot renew --webroot -w /var/www/certbot --quiet && docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml exec -T nginx nginx -s reload
EOF
  chmod 0644 /etc/cron.d/exchangekit-certbot
  ok "Cron-обновление установлено."
}
setup_renewal

# ---------- Итог ----------
echo
ok "============================================================"
ok " ExchangeKit развёрнут: https://$DOMAIN"
ok "============================================================"
echo  "  Админ-логин : $ADMIN_EMAIL"
if [ "${GENERATED_PW:-0}" -eq 1 ]; then
  echo "  Админ-пароль: $ADMIN_PASSWORD   (сгенерирован — сохраните!)"
fi
echo
echo  "  Дальше:"
echo  "   • Впишите боевые ключи YooKassa и SMTP в $REPO_DIR/.env, затем:"
echo  "       cd $REPO_DIR && docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d"
echo  "   • Положите .txt лицензии в $REPO_DIR/licenses_pool/ и выполните update.sh"
echo  "   • Обновление из GitHub:  sudo $REPO_DIR/deploy/update.sh"
echo
