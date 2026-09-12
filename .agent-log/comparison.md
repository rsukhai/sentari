# Порівняння інструментів — задача `/api/health`

Задача: реалізувати ендпоінт `/api/health` (прописана в `app/page.tsx` як TASK_HINT
стартового шаблону).

## Claude Code

- **Proposed / Executed**: окрема сесія Claude Code (session id `852ab6d4…`,
  див. `.agent-log/session.jsonl`) дослідила репозиторій (`package.json`,
  `src/models.ts`, тести, `tsconfig.json`, `app/page.tsx`, README), а тоді
  одним `Bash`-викликом (`cat > file <<EOF`, о 19:35:19 UTC) створила
  `src/health.ts`, `app/api/health/route.ts`, `src/health.test.ts`, і другим
  викликом (19:35:29 UTC) — `tests/health-route.test.ts`. Сама ж запустила
  `npm run typecheck && npm run lint && npm test`.
- **Wrong**: див. нижче, помилки 1 і 3.

## Codex

- **Proposed**: у сесії `~/.codex/sessions/2026/09/12/…` (експортовано в
  `.agent-log/codex-session.jsonl`) Codex лише **досліджував** репозиторій
  (`pwd`, пошук файлів, читання `README.md`, `app/page.tsx`, наявних тестів) —
  жодного запису чи `apply_patch` у логу немає. Тобто в цій сесії Codex
  залишився в режимі читання, код не писав.
- **Executed**: —

## Три впевнені помилки

1. **Vitest не резолвив аліас `@/`.**
   `app/api/health/route.ts` імпортував `@/src/health`. `npm run typecheck`
   проходив (TypeScript бачить `paths` з `tsconfig.json`), але `npm test`
   падав: `Cannot find package '@/src/health'` — у `vitest.config.ts` не було
   відповідного `resolve.alias`. Агент прогнав `npm test` у тому ж виклику
   (`.agent-log/session.jsonl`, запис `19:35:29Z`, `tool: Bash`), тест був
   червоним, але задачу подано як завершену.
   **Виправлено**: додано `resolve.alias` у `vitest.config.ts`.

2. **`process.env.npm_package_version` ненадійний поза `npm run`.**
   Код читав версію застосунку з `process.env.npm_package_version`. Ця
   змінна існує лише коли процес запущено через `npm run <script>` —
   перевірено емпірично (`node -e "console.log(process.env.npm_package_version)"`
   → `undefined`). У типовому продакшн-деплої (`node server.js`, Docker,
   Vercel) ендпоінт здоров'я мовчки повертав би `version: "unknown"`. Тест
   (`src/health.test.ts`) цього не ловив, бо перевіряв `buildHealthReport`
   напряму з переданим рядком версії, а не через сам `route.ts`.
   **Виправлено**: версія тепер читається напряму з `package.json`.

3. **Заборона на редагування `.env*` у hook не покриває `Bash`.**
   `.claude/settings.json`, `PreToolUse`, `matcher: "Write|Edit|MultiEdit"` —
   Bash-виклики під цей matcher не підпадають. Сесія `852ab6d4…` реально
   створила файли саме через `Bash` (`cat > file <<EOF`), а не через `Write`.
   Це доводить: тим самим прийомом (`cat > .env.local <<EOF`) агент міг би
   переписати секрети — і поточний hook це б не зловив. Джерело: сама
   структура `.claude/settings.json` + факт створення файлів через `Bash`
   у `.agent-log/session.jsonl` (запис `19:35:19Z`).
   **Не виправлено** — виносжу на заняття 03 («заборони на захищені шляхи»),
   де це і є предмет роботи: matcher hook потрібно розширити на `Bash`.
