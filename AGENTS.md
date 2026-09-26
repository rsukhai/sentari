<!-- AGENTS.md — карта проєкту для агента. Цей файл пише ЛЮДИНА, не агент. -->
<!-- Правила курсу:                                                          -->
<!--  * тиждень 1 — до 60 рядків; до кінця курсу — до 200;                   -->
<!--  * кожен рядок відповідає на питання «що агент зробить неправильно,     -->
<!--    якщо цього рядка не буде?». Не відповідає — рядок видалити;          -->
<!--  * тест на якість: видали 40% рядків — робота агента не ламається;      -->
<!--  * не переказувати README: README — для людей, AGENTS.md — для агента.  -->
<!--  * це карта, а не енциклопедія: посилайся на файл, не копіюй його вміст.-->

# AGENTS.md

- Це проект який читає логи автомобіля які передаються із OBD, та в подальшому їх аналізує для того щоб надати рекомендації користувачеві(водієві авто).

## Стек

- TypeScript (`strict`), Next.js (App Router), Vitest.
- Node >=22.12.0
- npm (not yarn/pnpm)


## Команди

- `npm test` — тести (Vitest), без мережі.
- `npm run typecheck` — перевірка типів, без емісії.
- `npm run lint` — лінтер.


## Межі

- `.env` і `.env.local` агент не читає і не редагує: секрети веде людина.
- Тести не ходять у мережу і не викликають платні API.
- package-lock.json - не редагувати вручну, тільки 'npm install'
- .agent-log/ - тільки нові записи, старі не редагуєш/видаляєш


## Домовленості

- Модель обирається роллю з `src/models.ts` (`MODELS.cheap`), а не рядком-ідентифікатором.

- Компоненти — PascalCase, файли-хуки — з префіксом `use`.
- Логіка розбору OBD-логів — окремо від UI-компонентів (наприклад, у `src/obd/`).
- Коміти — Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`.
- «Готово» = зелені typecheck, lint, test (див. «Команди»).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
