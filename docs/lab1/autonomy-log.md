# Журнал автономності — Лабораторна 1

Рівні довіри (з методички): **L0** — читання, агент нічого не змінює (`plan`);
**L1** — агент пропонує, кожну зміну приймаю вручну (`default`);
**L2** — файли без питань, команди лише з дозволу (`acceptEdits`).
Вище L2 (`auto`, `bypassPermissions`) лабораторній не потрібно.

Попередня ітерація журналу (до переходу на контракт зі схемою) лишається без
змін у `.agent-log/autonomy-log.md` і `.agent-log/comparison.md`: за
`AGENTS.md` у `.agent-log/` лише дописують.

Посилання на рядки журналу — на коміт `24000754` у `main`.

| Дата | Інструмент і модель | Режим дозволів | Рівень довіри | Задача | Що запропонував / що виконав | Де і чому я втрутився | Які докази прийняв | Журнал / коміт |
|---|---|---|---|---|---|---|---|---|
| 2026-09-12 | Claude Code (розширення VS Code), claude-sonnet-5 | `auto` (класифікатор сам схвалює дії) | вище L2 | Перший запуск: розібрати завдання, налаштувати середовище, hook-журнал | Пропонував і виконував команди `git`/`npm`, правив конфіги; спробував `git reset --hard origin/main` | `reset --hard` заблокував класифікатор як незворотний — виконав сам у терміналі; `AGENTS.md` писав сам, агент лише пояснював секції | `npm run doctor` → 0 FIX; `npm test`, `npm run build` зелені | `.agent-log/session.jsonl` (формат старого hook) |
| 2026-09-12 | Codex CLI 0.157, модель з `~/.codex/config.toml` (тоді — `gpt-5.4`, викликала помилку для ChatGPT-акаунта) | read-only | L0 | Перший запуск: задача `/api/health` лише як план | Лише читав репозиторій (`pwd`, `rg --files`, `README.md`, `app/page.tsx`), нічого не змінив | Перемкнув вхід з ChatGPT-акаунта на API-ключ | Журнал: у сесії жодного запису чи `apply_patch` | `.agent-log/codex-session.jsonl` (імпорт `npm run log:import`, лише сесія за 2026-09-12) |
| 2026-09-12 | Claude Code CLI 2.1 (термінал, вхід через `ANTHROPIC_API_KEY`), сесія `852ab6d4` | `default`, кожну дію підтверджував | L1 | Стара ітерація `/api/health` (до контракту зі схемою) | Створив файли через `Bash` (`cat > file <<EOF`), сам прогнав `typecheck && lint && test` | — (підтверджував дії, не перевіряючи результат `npm test`) | Тест насправді падав (аліас `@/` у Vitest) — виправлено пізніше; ця реалізація видалена комітом `a9b2a822` | [session.jsonl#L23](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/session.jsonl#L23) · `19:35:19Z` · `Bash` |
| 2026-09-26 | Codex CLI 0.157, gpt-6-sol, сесія `01a0dcdf` | фактично ≥ L2: писав у файли й виконував команди без запиту *(підтвердити режим)* | ≥ L2 | *(уточнити, яку задачу давав)* | Обнулив `.env.local` через `python3 … write_text("")`, потім `apply_patch` з порожніми ключами, потім `npm test/typecheck/lint` як «доказ» | Помітив порожні ключі; `.env.local` відновив вручну (агенту це заблоковано hook); після інциденту додано `PreToolUse`-заборону для Codex (`scripts/agent-env-guard.mjs`) | Перевірка guard: та сама команда → `deny`, exit 2 | [codex.jsonl#L5](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/codex.jsonl#L5) · `08:41:03Z` · `Bash`; [#L16](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/codex.jsonl#L16) · `apply_patch` |
| 2026-09-26 | Claude Code (VS Code), claude-sonnet-5 → claude-opus-5-5, сесія `4b9d5995` | `plan`, після схвалення — `auto` | L0 → вище L2 | `/api/health` за контрактом, гілка `lab1/health-claude-code` | План: один файл `app/api/health/route.ts`, докази `typecheck`, `test`, `build`, `curl`. Виконав за планом, контракт не займав | Прочитав план до схвалення; перевірив `git diff main -- tests/health.test.ts src/health.ts` — порожньо | Локально все зелене, але CI гілки був червоний (`npm ci`, lock-файл) — виправлено `659ed754` | [claude-code.jsonl#L39](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/claude-code.jsonl#L39) · `08:51:28Z` · `ExitPlanMode`; [#L40](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/claude-code.jsonl#L40) · `Write` |
| 2026-09-26 | Codex CLI 0.157, gpt-6-sol, сесія `01a0dcf1` | план, потім запис із мого дозволу | L0 → L1 | `/api/health` за контрактом, гілка `lab1/health-codex` | Один `apply_patch` на `app/api/health/route.ts`, двічі `typecheck && lint && test`, сам перевірив `git diff` контракту | Прочитав план і схвалив; незалежно перевірив `npm run build` (`ƒ /api/health`) і `curl` | Тести 60/60, build динамічний, контракт не змінено; злито в `main` (`24000754`) | [codex.jsonl#L25](https://github.com/rsukhai/sentari/blob/24000754c1bad655a690c47de7d63ca40b084129/.agent-log/codex.jsonl#L25) · `09:00:08Z` · `apply_patch` |
| 2026-09-26 | Claude Code (VS Code), claude-opus-5-5, сесія `4b9d5995` | `auto` | вище L2 | Інцидент із журналом | Під час конфлікту cherry-pick агент скоротив 3 рядки й прибрав 1 рядок у `session.jsonl` на `lab1/health-codex`. Спроба агента самому відновити їх заблокована класифікатором як втручання в журнал | Рядки дослівно відновив сам із коміту `90ee48fb`; мій `cp` зачепив ще 5 рядків — повернув їх із `3dba4f51`. Для журналів додано `merge=union` (`.gitattributes`) | `comm` між журналами `main` і гілки — порожньо | коміти `601d7d4c`, `ad747a12` |

## Висновок щодо рівня довіри

У двох сесіях Claude Code працював у режимі `auto` — вище L2, хоча методичка
каже, що жодному кроку це не потрібно. Саме в `auto` агент і зачепив журнал.
Далі — `plan` для планування і `acceptEdits` (L2) для реалізації.
