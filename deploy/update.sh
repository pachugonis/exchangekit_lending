#!/usr/bin/env bash
#
# update.sh — обновление ExchangeKit из GitHub без потери данных и секретов.
#
#   • забирает свежий код (git reset --hard origin/<branch>)
#   • пересобирает образы и перезапускает стек
#   • перегенерирует nginx-конфиг (HTTPS) под сохранённый домен
#   • применяет новые миграции и импортирует свежие лицензии
#
# .env, сертификаты и тома БД НЕ трогаются (они gitignored / в volume).
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

log "Обновляю код из origin/$BRANCH ..."
git -C "$REPO_DIR" fetch origin "$BRANCH"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
ok "Код обновлён до $(git -C "$REPO_DIR" rev-parse --short HEAD)."

# Конфиг nginx живёт в git и был перезаписан reset'ом — генерируем заново.
if [ -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
  render_nginx https
else
  warn "Сертификат не найден — остаюсь на HTTP. Запустите deploy.sh для выпуска SSL."
  render_nginx http
fi

log "Пересобираю и перезапускаю стек..."
dc up -d --build

wait_for_db
run_migrations
import_licenses

log "Перезагружаю nginx..."
dc exec -T nginx nginx -t && dc exec -T nginx nginx -s reload || dc restart nginx

ok "Обновление завершено: https://$DOMAIN"
