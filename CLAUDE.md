# CLAUDE.md — ExchangeKit License Platform

> Главный файл-инструкция для Claude Code.
> Цель: собрать платформу для продажи **пожизненной лицензии** на софт обменника
> ExchangeKit. Лендинг + регистрация + оплата через ЮКасса + автоматическая
> выдача лицензии (`.txt`) из заранее подготовленного пула.

---

## 1. Что мы строим

Платформа из трёх связанных частей:

1. **Лендинг** — продающая страница софта обменника (демо: https://demo.exchangekit.cc).
2. **Личный кабинет** — регистрация, вход, покупка, скачивание лицензии.
3. **Бэкенд продаж** — приём платежей ЮКасса, атомарная выдача лицензии из пула, email.

**Продукт:** ExchangeKit — софт для криптообменника / обмена электронных денег.
**Модель:** одна пожизненная лицензия с бесплатными обновлениями.
**Цена:** `29 900 ₽`.
**Оплата:** ЮКасса (YooKassa), только Россия.
**Лицензия:** текстовый файл (`.txt`), лежит в пуле заранее, выдаётся при оплате.

### Ключевое требование к выдаче лицензий
Лицензии — это набор готовых `.txt` файлов, загруженных в БД **до** старта продаж.
При оплате система берёт **первую свободную** лицензию, помечает проданной и
привязывает к аккаунту. Выдача должна быть **атомарной** — два одновременных
платежа не должны получить одну и ту же лицензию.

---

## 2. Технологический стек

| Слой            | Технология                          | Зачем                                            |
|-----------------|-------------------------------------|--------------------------------------------------|
| Frontend        | **Next.js 16 (App Router) + React 19** | SSR/SEO, лендинг + кабинет в одном проекте     |
| Стилизация      | **Tailwind CSS**                    | Быстрая, поддерживаемая стилизация                |
| Анимации        | **Framer Motion**                   | Scroll-reveal, микро-взаимодействия, переходы     |
| Backend         | **FastAPI (Python 3.12)**           | Async, удобная интеграция ЮКасса и webhook        |
| ORM             | **SQLAlchemy 2.0 + Alembic**        | Модели + миграции                                 |
| БД              | **PostgreSQL 16**                   | Пользователи, лицензии, платежи                   |
| Кэш / сессии    | **Redis 7**                         | Сессии, токены верификации email, rate-limit      |
| Платежи         | **YooKassa SDK (Python)**           | Создание платежа + обработка webhook              |
| Email           | **SMTP (SendPulse / собственный)**  | Письма верификации и выдачи лицензии              |
| Auth            | **JWT (httpOnly cookie) + bcrypt**  | Сессии и безопасное хранение паролей              |
| Reverse proxy   | **Nginx**                           | TLS-терминирование, маршрутизация                 |
| Развёртывание   | **systemd + Nginx (bare-metal)**    | Без Docker; сервисы напрямую на VPS (deploy/)     |
| Хостинг         | **VPS в РФ** (Timeweb / Selectel)   | Требование ЮКасса + скорость для аудитории РФ      |

**Структура репозитория — монорепо:**
```
/
├── CLAUDE.md
├── .env.example
├── frontend/        # Next.js
├── backend/         # FastAPI
├── deploy/          # bare-metal деплой на VPS (systemd, nginx, SSL)
└── licenses_pool/   # исходные .txt для импорта (НЕ коммитить реальные!)
```

---

## 3. Архитектура и поток покупки

```
Регистрация → подтверждение email → вход в кабинет
        ↓
Кнопка «Купить лицензию» (29 900 ₽)
        ↓
Backend создаёт платёж в ЮКасса → редирект на оплату
        ↓
Пользователь оплачивает
        ↓
ЮКасса → webhook (payment.succeeded) → Backend
        ↓
Backend верифицирует подпись/статус →
  атомарно берёт свободную лицензию из пула →
  привязывает к user_id → помечает sold
        ↓
Email с лицензией + кнопка «Скачать .txt» в кабинете
```

**Важно:** доверять только webhook + повторной проверке статуса платежа через API
ЮКасса. Никогда не выдавать лицензию по факту редиректа пользователя на success-страницу
(её легко подделать).

---

## 4. Модель данных (PostgreSQL)

### `users`
| поле                 | тип          | примечание                       |
|----------------------|--------------|----------------------------------|
| id                   | UUID PK      |                                  |
| email                | citext UNIQUE| нормализованный                  |
| password_hash        | text         | bcrypt                           |
| is_email_verified    | bool         | default false                    |
| created_at           | timestamptz  |                                  |

### `licenses`
| поле          | тип          | примечание                                   |
|---------------|--------------|----------------------------------------------|
| id            | UUID PK      |                                              |
| license_key   | text         | содержимое .txt файла                        |
| filename      | text         | имя исходного файла                          |
| status        | enum         | `free` / `reserved` / `sold`                 |
| user_id       | UUID FK NULL | заполняется при продаже                      |
| sold_at       | timestamptz  | NULL пока свободна                            |
| created_at    | timestamptz  |                                              |

Индекс: `(status)` для быстрого поиска свободной.

### `payments`
| поле               | тип          | примечание                          |
|--------------------|--------------|-------------------------------------|
| id                 | UUID PK      |                                     |
| user_id            | UUID FK      |                                     |
| yookassa_payment_id| text UNIQUE  | id из ЮКасса (идемпотентность)      |
| amount             | numeric      | 29900.00                            |
| status             | enum         | `pending`/`succeeded`/`canceled`    |
| license_id         | UUID FK NULL | привязанная лицензия                |
| created_at         | timestamptz  |                                     |

---

## 5. Backend (FastAPI)

### Структура
```
backend/
├── app/
│   ├── main.py
│   ├── config.py          # pydantic-settings, читает .env
│   ├── db.py              # async engine, session
│   ├── models/           # SQLAlchemy модели
│   ├── schemas/          # Pydantic схемы
│   ├── api/
│   │   ├── auth.py       # /register /login /verify /logout
│   │   ├── payment.py    # /payment/create /payment/webhook
│   │   └── license.py    # /license/me /license/download
│   ├── services/
│   │   ├── yookassa.py   # обёртка над SDK
│   │   ├── licenses.py   # атомарная выдача из пула
│   │   └── mailer.py     # SMTP
│   ├── security.py       # JWT, bcrypt, зависимости
│   └── scripts/
│       └── import_licenses.py  # загрузка .txt из licenses_pool/ в БД
└── alembic/
```

### Ключевые эндпоинты
- `POST /api/register` — создание пользователя, отправка письма верификации.
- `GET  /api/verify?token=` — подтверждение email.
- `POST /api/login` — выдача JWT в httpOnly cookie.
- `POST /api/payment/create` — создаёт платёж в ЮКасса, возвращает `confirmation_url`.
- `POST /api/payment/webhook` — приём уведомлений ЮКасса (главная логика выдачи).
- `GET  /api/license/me` — статус лицензии текущего пользователя.
- `GET  /api/license/download` — отдаёт `.txt` (только владельцу).

### Атомарная выдача лицензии (критично)
В обработчике webhook, внутри одной транзакции:
```sql
SELECT id FROM licenses
WHERE status = 'free'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```
Затем — обновить статус на `sold`, проставить `user_id`, `sold_at`, привязать к платежу.
`SKIP LOCKED` исключает гонку при одновременных покупках.
Если свободных нет — залогировать алерт (продаём «в минус» / нужно докинуть пул) и
вернуть платёж/уведомить администратора, но платёж не терять.

### Идемпотентность webhook
ЮКасса может прислать уведомление повторно. Перед выдачей проверять, не обработан
ли уже `yookassa_payment_id` (UNIQUE). Если платёж уже `succeeded` — ничего не делать.

---

## 6. Интеграция ЮКасса

- Использовать официальный `yookassa` Python SDK.
- При создании платежа: сумма `29900.00 RUB`, `confirmation: {type: redirect, return_url}`,
  `capture: true`, `metadata: {user_id, payment_id}`.
- Включить **чек по 54-ФЗ** (`receipt`) — для России обязательно при онлайн-оплате:
  передавать позицию «Лицензия ExchangeKit», НДС, email покупателя.
- Webhook: настроить в личном кабинете ЮКасса на `https://<domain>/api/payment/webhook`,
  событие `payment.succeeded` (и `payment.canceled`).
- **Безопасность webhook:** проверять, что запрос реально от ЮКасса — повторно
  запрашивать статус платежа через API по `payment_id` перед выдачей лицензии
  (не доверять телу запроса вслепую). Ограничить доступ по IP-диапазонам ЮКасса на Nginx.

---

## 7. Импорт пула лицензий

Скрипт `scripts/import_licenses.py`:
- читает все `.txt` из `licenses_pool/`,
- для каждого создаёт запись в `licenses` со `status='free'`,
- пропускает уже импортированные (по `filename`/хэшу содержимого).

Запуск разовый перед стартом и при пополнении пула:
```
cd backend && ../.venv/bin/python -m app.scripts.import_licenses ../licenses_pool
```
Реальные `.txt` **не коммитить** в git (добавить `licenses_pool/*.txt` в `.gitignore`).

---

## 8. Frontend (Next.js) — страницы

```
frontend/app/
├── page.tsx                # Лендинг
├── (auth)/
│   ├── register/page.tsx
│   └── login/page.tsx
├── verify/page.tsx         # подтверждение email
├── dashboard/page.tsx      # личный кабинет
├── payment/
│   ├── success/page.tsx
│   └── cancel/page.tsx
└── layout.tsx
```

### Лендинг — секции (сверху вниз)
1. **Hero** — заголовок-оффер, подзаголовок, CTA «Купить лицензию», кнопка «Демо» (ссылка на demo.exchangekit.cc).
2. **Преимущества** — 3–6 карточек (скорость, безопасность, поддержка, обновления).
3. **Скриншоты / демо** — превью интерфейса обменника.
4. **Возможности** — список фич софта.
5. **Цена** — единственный тариф: 29 900 ₽, пожизненно, обновления включены.
6. **FAQ** — про лицензию, обновления, возврат, техподдержку.
7. **Футер** — контакты, оферта, политика конфиденциальности (нужны для ЮКасса).

### Личный кабинет
- Если лицензии нет → крупная кнопка «Купить лицензию» → `POST /payment/create` → редирект на ЮКасса.
- Если куплена → блок с кнопкой «Скачать лицензию (.txt)» и датой покупки.
- Статус email-верификации, выход.

---

## 9. Дизайн-система — современный стиль с анимацией

**Общая эстетика:** тёмная тема по умолчанию, «tech / fintech» ощущение,
глубокий фон, неоновый/градиентный акцент, много воздуха, крупная типографика,
стекло (glassmorphism) на карточках.

### Палитра
```
--bg:          #0A0A0F   (почти чёрный фон)
--bg-elev:     #12121A   (приподнятые поверхности)
--surface:     rgba(255,255,255,0.04)  (стеклянные карточки)
--border:      rgba(255,255,255,0.08)
--text:        #EDEDF2
--text-muted:  #9A9AB0
--accent:      #6C5CE7   (фиолетово-синий)
--accent-2:    #00D2FF   (циан, для градиентов)
--gradient:    linear-gradient(135deg, #6C5CE7, #00D2FF)
--success:     #2ECC71
--danger:      #FF5C5C
```
Акцентный градиент использовать в заголовке Hero, активной CTA и подсветке цены.

### Типографика
- Шрифт: **Inter** (или Space Grotesk для заголовков + Inter для текста).
- Заголовок Hero: 56–72px, bold, tight letter-spacing.
- Тело: 16–18px, line-height 1.6.

### Компоненты
- **Карточки** — стекло: полупрозрачный фон, `backdrop-blur`, тонкая граница, мягкая тень,
  лёгкий внутренний градиент-свечение в углу.
- **Кнопки CTA** — градиентная заливка, скруглённые, при наведении — подъём + усиление свечения.
- **Бейджи** — «Пожизненная лицензия», «Обновления включены».

### Анимации (Framer Motion)
- **Hero:** плавное появление заголовка (fade + slide-up, stagger по словам/строкам);
  на фоне — медленно движущийся анимированный градиент или сетка/частицы (canvas/SVG),
  с пониженной нагрузкой (`prefers-reduced-motion` уважать).
- **Scroll-reveal:** секции и карточки появляются при попадании во вьюпорт
  (`whileInView`, opacity 0→1, y 40→0, stagger между карточками).
- **Микро-взаимодействия:** кнопки — `whileHover`/`whileTap` (scale 1.03 / 0.97);
  карточки — лёгкий tilt или подсветка границы при наведении.
- **Цена:** число 29 900 — count-up анимация при появлении секции.
- **Переходы страниц:** мягкий fade между маршрутами.
- **Загрузка оплаты:** спиннер/скелетон при создании платежа.

**Правило:** анимации — поддержка смысла, не перегруз. Длительности 0.3–0.6s,
easing `ease-out`. Обязательно поддержать `prefers-reduced-motion: reduce`
(отключать движущийся фон и крупные перемещения).

### Адаптивность
Mobile-first. Hero и карточки перестраиваются в одну колонку.
Тач-таргеты ≥ 44px. Тестировать на 360px ширине.

---

## 10. Безопасность

- Пароли — **bcrypt**, никогда не хранить в открытом виде.
- JWT в **httpOnly + Secure + SameSite=Strict** cookie.
- Верификация подписи/статуса webhook ЮКасса (см. §6).
- **Rate-limit** на `/register`, `/login`, `/payment/create` (Redis + middleware или Nginx).
- CSRF-защита на изменяющих запросах.
- Скачивание лицензии — только авторизованному владельцу (проверка `user_id`).
- HTTPS обязателен (Let's Encrypt), HSTS.
- Секреты только в `.env`, не в репозитории.
- Лог аудита: кто, когда, какую лицензию получил.

---

## 11. Переменные окружения (`.env.example`)

```
# App
APP_BASE_URL=https://exchangekit.cc
SECRET_KEY=change_me

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/exchangekit
REDIS_URL=redis://redis:6379/0

# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_RETURN_URL=https://exchangekit.cc/payment/success
LICENSE_PRICE=29900.00

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@exchangekit.cc

# JWT
JWT_SECRET=change_me
JWT_EXPIRE_MINUTES=1440
```

---

## 12. Запуск

### Dev (локально, нужны PostgreSQL и Redis на localhost)
```
cp .env.example .env          # заполнить значения
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload      # :8000  (Swagger: /docs)
cd ../frontend && npm install && npm run dev # :3000
```

### Прод (VPS, bare-metal) — см. `deploy/README.md`
```
sudo ./deploy/deploy.sh --domain <домен> --admin-email <admin> --le-email <email>
sudo ./deploy/update.sh       # обновление из GitHub
```
Сервисы: `exchangekit-backend`, `exchangekit-frontend` (systemd) + Nginx + certbot.

---

## 13. Чек-лист перед запуском в прод

- [ ] Заполнен пул лицензий, импорт выполнен, есть мониторинг остатка свободных.
- [ ] ЮКасса: магазин активирован, webhook настроен, чек по 54-ФЗ протестирован.
- [ ] Оферта + политика конфиденциальности опубликованы (требование ЮКасса).
- [ ] HTTPS, HSTS, домен exchangekit.cc настроен.
- [ ] Rate-limit и логирование включены.
- [ ] Протестирован полный цикл: регистрация → оплата → выдача → скачивание.
- [ ] Протестирована гонка: два параллельных платежа не получают одну лицензию.
- [ ] Резервное копирование PostgreSQL.
- [ ] Алерт при нулевом остатке свободных лицензий.

---

## 14. Правила для Claude Code

- Никогда не выдавать лицензию по факту редиректа на success — только по верифицированному webhook.
- Любая выдача лицензии — внутри транзакции с `FOR UPDATE SKIP LOCKED`.
- Webhook должен быть идемпотентным (UNIQUE по `yookassa_payment_id`).
- Реальные `.txt` лицензии и `.env` — в `.gitignore`, не коммитить.
- Уважать `prefers-reduced-motion` во всех анимациях.
- Все суммы хранить в `numeric`, не во float.
- Email пользователя нормализовать (lowercase, citext) для уникальности.
