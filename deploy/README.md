# Деплой ExchangeKit на VPS (Ubuntu 24.04)

Автоматическая установка на чистый сервер: Docker, домен, SSL (Let's Encrypt),
администратор, миграции, импорт лицензий и обновление из GitHub.

## Что нужно заранее

1. VPS с Ubuntu 24.04 и root/sudo доступом.
2. Домен, A-запись (и `www`) которого указывает на IP сервера.
3. Открытые порты 80 и 443 (скрипт сам настроит `ufw`).

## Первый запуск

```bash
# на сервере, от root
git clone https://github.com/pachugonis/exchangekit_lending.git /opt/exchangekit
cd /opt/exchangekit
sudo ./deploy/deploy.sh \
  --domain exchangekit.cc \
  --admin-email admin@exchangekit.cc \
  --le-email you@example.com
```

Можно запускать вообще без аргументов — скрипт спросит домен, email админа и
email для Let's Encrypt интерактивно. Пароль администратора, если не передан
через `--admin-password`, будет сгенерирован и показан в конце.

Полезные флаги:

| Флаг | Назначение |
|------|------------|
| `--admin-password 'Pass'` | задать пароль админа явно |
| `--repo <url>` | другой источник клонирования |
| `--staging` | тестовый сертификат Let's Encrypt (для отладки, без лимитов) |
| `--no-firewall` | не трогать `ufw` |

Скрипт **идемпотентен** — повторный запуск не пересоздаёт `.env`/секреты и не
перевыпускает существующий сертификат.

## После установки

Заполните боевые ключи в `/opt/exchangekit/.env` (YooKassa, SMTP) и примените:

```bash
cd /opt/exchangekit
docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

Лицензии: положите `.txt` в `/opt/exchangekit/licenses_pool/` и запустите
`update.sh` (он импортирует пул) либо вручную:

```bash
docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  exec backend python -m app.scripts.import_licenses
```

## Обновление из GitHub

```bash
sudo /opt/exchangekit/deploy/update.sh           # ветка main
sudo /opt/exchangekit/deploy/update.sh --branch dev
```

`update.sh` забирает свежий код (`git reset --hard`), пересобирает образы,
перегенерирует nginx-конфиг под сохранённый домен, применяет миграции и
импортирует новые лицензии. `.env`, сертификаты и БД не затрагиваются.

## SSL-сертификат

Выпускается при первом `deploy.sh` через certbot (webroot-челлендж). Авто-
обновление — cron `/etc/cron.d/exchangekit-certbot` (дважды в сутки + reload nginx).

## Управление

```bash
cd /opt/exchangekit
DC="docker compose -p exchangekit -f docker-compose.yml -f deploy/docker-compose.prod.yml"

$DC ps                 # статус
$DC logs -f backend    # логи
$DC restart            # перезапуск
$DC down               # остановка (данные в volume сохраняются)
```

Назначить/снять админа у существующего пользователя:

```bash
$DC exec backend python -m app.scripts.make_admin user@mail.ru          # назначить
$DC exec backend python -m app.scripts.make_admin user@mail.ru --revoke # снять
```

## Файлы деплоя

| Файл | Назначение |
|------|------------|
| `deploy.sh` | первичная установка (всё под ключ) |
| `update.sh` | обновление из GitHub |
| `lib.sh` | общие функции (логи, секреты, рендер nginx) |
| `docker-compose.prod.yml` | прод-оверлей (Let's Encrypt + certbot) |
| `.deploy.env` | сохранённые домен/почта (gitignored) |
| `certbot/` | сертификаты и webroot (gitignored) |
