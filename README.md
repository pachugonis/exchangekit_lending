# ExchangeKit License Platform

Платформа продажи пожизненной лицензии на софт криптообменника **ExchangeKit**:
лендинг + личный кабинет + бэкенд продаж (ЮКасса, атомарная выдача лицензий из пула).

См. подробную спецификацию в [CLAUDE.md](./CLAUDE.md).

## Стек
- **Frontend:** Next.js 16 (App Router) + React 19, Tailwind CSS, Framer Motion
- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 + Alembic
- **БД:** PostgreSQL 16, **Кэш:** Redis 7
- **Платежи:** YooKassa, **Auth:** JWT (httpOnly cookie) + bcrypt
- **Инфра:** Nginx + systemd (bare-metal, без Docker)

## Структура
```
backend/        # FastAPI
frontend/       # Next.js
deploy/         # bare-metal деплой на VPS (см. deploy/README.md)
licenses_pool/  # исходные .txt для импорта (реальные НЕ коммитить)
```

## Деплой на VPS (Ubuntu 24.04)
Один скрипт ставит PostgreSQL, Redis, Nginx, Python, Node, systemd-сервисы и SSL:
```bash
git clone https://github.com/pachugonis/exchangekit_lending.git /opt/exchangekit
cd /opt/exchangekit
sudo ./deploy/deploy.sh --domain exchangekit.cc \
  --admin-email admin@exchangekit.cc --le-email you@example.com
```
Обновление из GitHub: `sudo /opt/exchangekit/deploy/update.sh`.
Подробности — в [deploy/README.md](deploy/README.md).

## Локальная разработка
Нужны локальные PostgreSQL и Redis.

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env        # поправить пароли/хосты
alembic upgrade head
uvicorn app.main:app --reload      # :8000  (Swagger: /docs)
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev                        # :3000
```
