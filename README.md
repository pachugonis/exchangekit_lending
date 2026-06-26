# ExchangeKit License Platform

Платформа продажи пожизненной лицензии на софт криптообменника **ExchangeKit**:
лендинг + личный кабинет + бэкенд продаж (ЮКасса, атомарная выдача лицензий из пула).

См. подробную спецификацию в [CLAUDE.md](./CLAUDE.md).

## Стек
- **Frontend:** Next.js 16 (App Router) + React 19, Tailwind CSS, Framer Motion
- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 + Alembic
- **БД:** PostgreSQL 16, **Кэш:** Redis 7
- **Платежи:** YooKassa, **Auth:** JWT (httpOnly cookie) + bcrypt
- **Inфра:** Nginx, Docker Compose

## Структура
```
backend/        # FastAPI
frontend/       # Next.js
nginx/          # reverse proxy + TLS
licenses_pool/  # исходные .txt для импорта (реальные НЕ коммитить)
```

## Запуск (dev)
```bash
cp .env.example .env          # заполнить значения
docker compose up --build     # db, redis, backend, frontend, nginx
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.import_licenses
```

- Frontend: http://localhost (через nginx) / http://localhost:3000
- Backend API + Swagger: http://localhost:8000/docs

## Локальная разработка без Docker
**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
