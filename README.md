# GradeTier — Журнал оцінок

Веб-застосунок для перегляду студентських оцінок, рейтингів та аналітики.

## Що вміє

- **Рейтинг студентів** — сортування за балом, відвідуваністю, ПІБ
- **Графіки груп** — 4 види аналітики
- **Фільтри** — по групах, предметах, семестрах
- **Досягнення** — індикатори успішності
- **Експорт** — HTML

---

## Технології

- **Backend**: Node.js + Express
- **Database**: SQLite (Prisma)
- **Frontend**: JavaScript + Chart.js
- **Auth**: JWT tokens

---

## Архітектура

```
src/
├── web/              # Web інтерфейс (HTML, CSS, JS)
├── services/         # Бізнес-логіка
├── repository/       # Робота з БД
├── models/           # Моделі даних
└── lib/              # Допоміжні бібліотеки
    ├── priorityQueue/    # Пріоритетна черга
    ├── generators/       # Генератори
    ├── memoization/      # Кешування
    └── async-array/      # Асинхронні операції
```

---

## API

- `POST /api/v1/auth/login` — авторизація
- `GET /api/v1/report` — звіт з фільтрами
- `GET /api/v1/group-rating` — рейтинг груп
- `GET /api/v1/export` — експорт звіту
- `POST /api/v1/import/csv` — імпорт даних

---

## Запуск

# Встановлення

npm install

# Налаштування БД

npm run db:generate
npm run db:push

# Запуск сервера

## npm start

## Команди

|---------|------|
| `npm start` | Запуск сервера |
| `npm test` | Тести |
| `npm run lint` | Перевірка коду |
| `npm run db:generate` | Оновити Prisma |
| `npm run db:push` | Оновити БД |

---

## Автор

Черноплечий Андрій IM-52 — курсова робота 2026
