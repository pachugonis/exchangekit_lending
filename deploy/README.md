# Деплой ExchangeKit на VPS (Ubuntu 24.04) — без Docker

Установка напрямую на сервер: PostgreSQL, Redis, Nginx, Python (venv), Node.js,
systemd-сервисы, SSL (Let's Encrypt). Не зависит от Docker Hub — всё из apt и
NodeSource.

## Что нужно заранее

1. VPS с Ubuntu 24.04, root/sudo.
2. Домен, A-запись (и `www`) которого указывает на IP сервера.
3. Открытые порты 80 и 443 (скрипт настроит `ufw`).

## Первый запуск

```bash
git clone https://github.com/pachugonis/exchangekit_lending.git /opt/exchangekit
cd /opt/exchangekit
sudo ./deploy/deploy.sh \
  --domain exchangekit.cc \
  --admin-email admin@exchangekit.cc \
  --le-email you@example.com
```

Без аргументов скрипт спросит домен и email интерактивно. Пароль администратора,
если не задан через `--admin-password`, будет сгенерирован и показан в конце.

Флаги: `--admin-password`, `--repo <url>`, `--staging` (тестовый сертификат),
`--no-firewall`. Скрипт **идемпотентен**.

## Что разворачивается

| Компонент | Как |
|-----------|-----|
| PostgreSQL 16 | apt, роль+БД `exchangekit`, расширения `citext`/`pgcrypto`, localhost |
| Redis | apt, localhost:6379 |
| Backend | Python venv `/opt/exchangekit/.venv`, uvicorn, systemd `exchangekit-backend` |
| Frontend | Node 22, `next start`, systemd `exchangekit-frontend` |
| Nginx | apt, реверс-прокси на `127.0.0.1:8000/3000`, конфиг `/etc/nginx/conf.d/exchangekit.conf` |
| SSL | `certbot --webroot`, авто-renew штатным таймером certbot |

## Обновление из GitHub

```bash
sudo /opt/exchangekit/deploy/update.sh            # ветка main
sudo /opt/exchangekit/deploy/update.sh --branch dev
```

Тянет код (`git reset --hard`), обновляет venv, пересобирает фронт, мигрирует БД,
импортирует новые лицензии, перезапускает сервисы. `.env`, сертификаты и БД не
трогаются.

## После установки

Впишите боевые ключи YooKassa и SMTP в `/opt/exchangekit/.env`, затем:

```bash
sudo systemctl restart exchangekit-backend
```

Лицензии — положите `.txt` в `/opt/exchangekit/licenses_pool/` и запустите
`update.sh`, либо вручную:

```bash
cd /opt/exchangekit/backend
sudo -u exchangekit ../.venv/bin/python -m app.scripts.import_licenses /opt/exchangekit/licenses_pool
```

## Управление

```bash
systemctl status  exchangekit-backend exchangekit-frontend
systemctl restart exchangekit-backend
journalctl -u exchangekit-backend -f          # логи backend
journalctl -u exchangekit-frontend -f         # логи frontend
```

Назначить/снять админа у существующего пользователя:

```bash
cd /opt/exchangekit/backend
sudo -u exchangekit ../.venv/bin/python -m app.scripts.make_admin user@mail.ru
sudo -u exchangekit ../.venv/bin/python -m app.scripts.make_admin user@mail.ru --revoke
```

## Файлы деплоя

| Файл | Назначение |
|------|------------|
| `deploy.sh` | первичная установка под ключ |
| `update.sh` | обновление из GitHub |
| `lib.sh` | общие функции (логи, секреты, БД, nginx, сборка) |
| `systemd/*.service` | юниты backend и frontend (шаблоны с `__REPO_DIR__`) |
| `.deploy.env` | сохранённые домен/почта (gitignored) |

## Локальная разработка (без Docker)

```bash
# PostgreSQL и Redis локально, затем:
cp .env.example .env            # поправить пароли/хосты
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload          # :8000
cd ../frontend && npm install && npm run dev      # :3000
```
