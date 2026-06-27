#!/usr/bin/env bash
#
# update.sh — обновление ExchangeKit из GitHub (bare-metal, без Docker).
#
#   • git reset --hard origin/<branch>
#   • обновляет Python-зависимости и пересобирает фронтенд
#   • перегенерирует nginx-конфиг под сохранённый домен
#   • применяет миграции, импортирует свежие лицензии
#   • перезапускает systemd-сервисы
#
# .env, сертификаты и БД не затрагиваются.
#
# Использование (от root):
#   sudo /opt/exchangekit/deploy/update.sh [--branch main]

set -euo pipefail

BRANCH="main"
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2;;
    -h|--help) grep '^#' "$0" | sed 's/^# \?//'; exit 0;;
    *) echo "Неизвестный аргумент: $1" >&2; exit 1;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Запускайте через sudo / от root." >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export REPO_DIR

# shellcheck disable=SC1091
source "$REPO_DIR/deploy/lib.sh"
load_state

log "Обновляю код из origin/$BRANCH..."
git -C "$REPO_DIR" fetch origin "$BRANCH"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
ok "Код обновлён до $(git -C "$REPO_DIR" rev-parse --short HEAD)."

build_backend
build_frontend
chown -R "$APP_USER:$APP_USER" "$REPO_DIR"

# nginx-конфиг живёт в /etc/nginx (вне git) — перегенерируем под текущее состояние SSL.
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  render_nginx https
else
  warn "Сертификат не найден — остаюсь на HTTP."
  render_nginx http
fi

# Миграции применяем при работающем backend? Нет — backend перезапустим после.
# Запускаем backend, чтобы venv/код уже были свежими, затем мигрируем.
systemctl restart exchangekit-backend
wait_for_db
run_migrations
import_licenses
systemctl restart exchangekit-frontend

nginx_reload
ok "Обновление завершено: https://$DOMAIN"
