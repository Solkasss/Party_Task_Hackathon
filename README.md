# 🎉 Тусовка — Платформа подій

> Веб-додаток для організації та відвідування подій з обмеженою кількістю місць, приватними запрошеннями та коментарями.

## Технологічний стек

| Шар | Технологія |
|---|---|
| Фреймворк | Next.js 15 (App Router) |
| Мова | TypeScript |
| Стилі | Tailwind CSS v4 |
| ORM | Prisma 6 |
| База даних | SQLite (`dev.db`) |
| Валідація | Zod |
| Аутентифікація | JWT (jose, HS256) + HttpOnly cookie |
| Іконки | Lucide React |

## Функціонал

- 🔐 Реєстрація та вхід (JWT-сесія в HttpOnly cookie)
- 📅 Створення, редагування та видалення публічних і приватних подій
- 🔒 Приватні події з унікальним посиланням-запрошенням
- 🖼️ Завантаження обкладинки (JPG / PNG / WebP, до 5 МБ) з перевіркою magic bytes
- ✅ Реєстрація на подію із захистом від race condition (транзакція + лічильник місць)
- 💬 Коментарі до подій
- 👤 Профіль: «Створені мною» та «Я йду»
- 🛡️ IDOR-захист на всіх маршрутах редагування та видалення

---

## Локальне розгортання

### Вимоги

- Node.js ≥ 18
- npm ≥ 9

### Крок 1 — Клонування репозиторію

```bash
git clone <repo-url> && cd Party_Task_Hackathon
```

### Крок 2 — Встановлення залежностей

```bash
npm install
```

> `postinstall` автоматично виконає `prisma generate`.

### Крок 3 — Налаштування змінних середовища

```bash
cp .env.example .env
```

Відкрийте `.env` і встановіть значення:

```env
# Шлях до файлу SQLite-бази даних
DATABASE_URL="file:./dev.db"

# Довільний секретний рядок для підпису JWT (мінімум 32 символи)
JWT_SECRET="your-long-random-secret-here"
```

> ⚠️ **Ніколи не комітьте `.env` у git.** Файл вже додано до `.gitignore`.

### Крок 4 — Ініціалізація бази даних

```bash
npx prisma db push
```

Команда створить файл `dev.db` та всі таблиці (User, Event, Registration, Comment).

### Крок 5 — Запуск у режимі розробки

```bash
npm run dev
```

Відкрийте у браузері: **http://localhost:3000**

---

## Корисні скрипти

```bash
npm run dev        # Режим розробки з hot-reload
npm run build      # Production-збірка
npm run start      # Запуск production (+ автоматичний db push)
npm run lint       # ESLint-перевірка
npm run test       # Vitest (на окремій test.db)
```

---

## Хмарне розгортання (Render / Railway)

При деплої на будь-який хостинг достатньо встановити дві змінні середовища:

| Змінна | Значення |
|---|---|
| `DATABASE_URL` | `file:./dev.db` |
| `JWT_SECRET` | Довгий випадковий рядок |

Скрипт `start` автоматично виконає `npx prisma db push` перед запуском сервера та прив'яже його до `0.0.0.0:$PORT`.

**Build command:** `npm install && npm run build`  
**Start command:** `npm run start`

---

## Структура проєкту

```
Party_Task_Hackathon/
├── app/
│   ├── api/
│   │   ├── auth/           # register · login · logout · me
│   │   ├── events/         # CRUD подій + реєстрація + коментарі
│   │   ├── upload/         # Завантаження зображень (magic bytes)
│   │   └── uploads/        # Роздача завантажених файлів
│   ├── events/
│   │   ├── [id]/           # Деталі події + edit
│   │   └── new/            # Форма створення
│   ├── login/              # Сторінка входу
│   ├── profile/            # Профіль користувача
│   └── register/           # Сторінка реєстрації
├── components/
│   ├── Navbar.tsx           # Server component
│   └── NavbarActions.tsx    # Client component (logout)
├── lib/
│   ├── auth.ts              # createSession / clearSession / getCurrentUser
│   ├── prisma.ts            # Singleton PrismaClient
│   └── validations.ts       # Zod-схеми
├── prisma/
│   └── schema.prisma        # User · Event · Registration · Comment
├── public/
│   └── default-cover.svg    # Дефолтна обкладинка події
├── uploads/                 # Runtime-директорія для завантажених файлів
├── .env.example
└── README.md
```

---

## Безпека та надійність

### IDOR-захист
Усі маршрути `PATCH` і `DELETE` для подій перевіряють `event.authorId === currentUser.id` перед виконанням будь-яких змін. Відхилення з `403 Forbidden` без розкриття деталей.

### Атомарні транзакції для місць
Реєстрація на подію виконується всередині `prisma.$transaction`: спочатку рахується поточна кількість зареєстрованих, і лише якщо `count < capacity` — створюється запис. Це усуває race condition при одночасних запитах.

### Перевірка зображень за magic bytes
Завантажені файли перевіряються по перших байтах буфера (не по MIME-заголовку або розширенню), що унеможливлює завантаження SVG, HTML чи скриптів — захист від Stored XSS. Дозволені формати: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`52 49 46 46 … 57 45 42 50`).

### Path Traversal у файловому сервері
`GET /api/uploads/[filename]` перевіряє ім'я файлу суворим regex UUID-формату перед будь-яким зверненням до файлової системи. Невалідне ім'я → `400 Bad Request`.

### Захист від email enumeration
`POST /api/auth/login` повертає однаковий generic error `401` як для «користувач не знайдений», так і для «невірний пароль».

### Крипто-безпечні invite-токени
Токени запрошень для приватних подій генеруються через `crypto.randomUUID()` (CSPRNG). Токен не розкривається в публічних API-відповідях — лише автору події.

### JWT-сесія
Токен підписується HS256 з `JWT_SECRET`, зберігається в `HttpOnly; SameSite=Lax` cookie (термін дії 7 днів). У production автоматично додається `Secure`.

---

## Моделі даних

```
User          Event              Registration     Comment
─────────     ────────────────   ─────────────    ───────────
id (uuid)     id (uuid)          id (uuid)        id (uuid)
email*        title              userId → User    content
name          description        eventId → Event  userId → User
passwordHash  startsAt           createdAt        eventId → Event
createdAt     capacity           @@unique([       createdAt
              coverUrl             userId,
              isPrivate            eventId])
              inviteToken*
              authorId → User
              createdAt
              updatedAt
              @@index([isPrivate, startsAt])
```

> `*` — унікальне поле

---

*Проєкт створено в межах Hackathon Party Task 2026.*
