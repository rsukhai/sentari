# Пакет доказів · Лабораторна 3 — харнес автономних агентів

Автор: Роман Сухай · репозиторій: https://github.com/rsukhai/sentari · тема — харнес навколо агента (Claude Code): черга задач, ланцюг брам, верифікатор, зупинення, evals, калібрування судді, трасування, red-team.

> Межа з Лабораторними 1–2: тег `lab1-submission` → [`8c640b6c`](https://github.com/rsukhai/sentari/commit/8c640b6cc9a66c6e5f1eee7635e3131bb3731dea); `git diff lab1-submission..HEAD --stat -- docs/lab1` порожній. Кроки 06–10 Лаб. 2 злито в `main` ([PR #8](https://github.com/rsukhai/sentari/pull/8), [#9](https://github.com/rsukhai/sentari/pull/9)). Усе нове — у `docs/lab3/`, `scripts/harness|evals|judge|telemetry|redteam/`, `src/harness|telemetry|verify/`, `.github/workflows/gates.yml`.
>
> **Усі посилання нижче — permalink-и на коміт [`88f1dc3b`](https://github.com/rsukhai/sentari/commit/88f1dc3b321df13f07e82f71607eec43d71d55c6)**, а не на гілку.

## 1. Таблиця прийняття

| Критерій | Де доказ | Посилання |
|---|---|---|
| брама · CI зелений на поданому SHA | прогони Actions на `main` (`gates` і `CI`) | див. розділ 2: зелений на `4e318edd` (кроки 00–06); прогін на фінальному SHA — рядок розділу 2 |
| брама · журнал автономності, ≥ 4 сесії | `docs/lab3/autonomy-log.md` | [docs/lab3/autonomy-log.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/autonomy-log.md) — **9 записів-сесій (кроки 00–08), але всі датовані 2026-11-08 і належать одній довгій сесії `4b9d5995`; розподілу по тижнях немає, див. розділ 5** |
| брама · жодного обходу перевірок дозволів | `claudeArgs` у `run-task.ts` + тест `жодного обходу дозволів` | [scripts/harness/run-task.ts](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/scripts/harness/run-task.ts) · [tests/harness/run-task.test.ts](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/tests/harness/run-task.test.ts) |
| брама · немає секретів в історії | `git log --all` по шляхах секретів і за шаблонами ключів | розділ 6: порожній вивід по файлах секретів; збіги за шаблоном — лише хибні (розбір там само) |
| крок 00 · фабрика задач | `docs/lab3/factory.md` | [docs/lab3/factory.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/factory.md) |
| крок 01 · ланцюг брам | `docs/lab3/gates.md` | [docs/lab3/gates.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/gates.md) |
| крок 02 · верифікатор зупинив зміну | `docs/lab3/verifier.md` | [docs/lab3/verifier.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/verifier.md) |
| крок 03 · прогін зупинився сам | `docs/lab3/stop.md` | [docs/lab3/stop.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/stop.md) |
| крок 04 · регресійна брама в CI | `docs/lab3/evals.md` | [docs/lab3/evals.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/evals.md) |
| крок 05 · число згоди судді | `docs/lab3/judge.md` | [docs/lab3/judge.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/judge.md) |
| крок 06 · класифікація помилок | `docs/lab3/errors.md` | [docs/lab3/errors.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/errors.md) |
| крок 07 · ін'єкція промпту | `docs/lab3/redteam.md` | [docs/lab3/redteam.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/redteam.md) |
| крок 08 · цей звіт | `docs/lab3/README.md` | [`README.md`](https://github.com/rsukhai/sentari/blob/main/docs/lab3/README.md) *(самопосилання на `main`: SHA файлу, який містить власний SHA, неможливий)* |

Число за кожним кроком одним рядком: фабрика — 8 задач, 9 прогонів `ok`; брами — 5 задач у ланцюзі, навмисно червоний прогін падає лише на `types`; верифікатор — реальний стоп у CI (`c6`, `c7`), раннє `κ = 0,913`; зупинення — 3 зупинки лімітом ходів, брейкер відкрито й закрито; evals — 20 задач, regression `pass^3 = 0,43`; суддя — 23 випадки, `κ = 0,79–0,85`; помилки — 12 невдалих прогонів, 5 класів, дві знахідки харнеса; red-team — 7 сценаріїв, 0 пройшло після виправлень, 2 дірки закрито.

## 2. Прогони CI

- **Зелений на `main` після злиття кроків 00–06 (`4e318edd`):** [`gates` 42513114091](https://github.com/rsukhai/sentari/actions/runs/42513114091) (types, lint, tests, evals, build, record — success; verify — skipped, бо гілка не `harness/t-*`) і [`CI` 42513114165](https://github.com/rsukhai/sentari/actions/runs/42513114165).
- **Зелений на фінальному SHA:** *(кроки 07–08 потрапляють у `main` окремим PR; посилання на прогін на його merge-коміті додається наступним рядком після злиття)*.
- **Червоний, збережений як доказ №1 (верифікатор зупинив зміну):** [прогін 42502238475](https://github.com/rsukhai/sentari/actions/runs/42502238475), PR [#7](https://github.com/rsukhai/sentari/pull/7), коміт `1c7e036c` — `types`, `lint`, `tests`, `build` зелені, **`verify` червоний** (`c6=fail`, `c7=fail`: README неточно описує два скрипти). Прогін не видалявся й не перезапускався.
  - Виправлення після червоного: [`c5da034d`](https://github.com/rsukhai/sentari/commit/c5da034d) → [зелений повтор 42502722088](https://github.com/rsukhai/sentari/actions/runs/42502722088) (усі 6 задач success, 8 з 8 критеріїв `pass`). Розбір — [docs/lab3/verifier.md](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/verifier.md).
- **Червоний, збережений як доказ №2 (регресійна брама evals):** [прогін 42511107871](https://github.com/rsukhai/sentari/actions/runs/42511107871), гілка `lab3/04-evals-red2`, коміт `50e8531e` — **`evals` червоний**: «РЕГРЕСІЯ на 1 задачах: t-04: було pass^3=1, стало 0/3»; юніт-тести цю зміну не бачать. Зелений на батьківському коміті: [42510818323](https://github.com/rsukhai/sentari/actions/runs/42510818323).
- **Червоний, збережений як доказ №3 (ланцюг брам):** [прогін 42494757155](https://github.com/rsukhai/sentari/actions/runs/42494757155), гілка `harness/red-2026-11-08` — впала лише `types`, `lint`/`tests`/`build` пропущені, `record` виконалась.

## 3. Інструменти й моделі

| Роль | Інструмент | Модель із версією | Платний чи безкоштовний шлях |
|---|---|---|---|
| Агент кодування (ця робота) | Claude Code (розширення VS Code), 2.1.269 | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | платний (ключ Anthropic) |
| Виконавець фабрики кроків 00–03 | Claude Code `-p` 2.1.269, `dontAsk` | `sonnet` | платний |
| Виконавець evals, red-team (кроки 04, 06–07) | Claude Code `-p` 2.1.269, `dontAsk` | `haiku` | платний |
| Верифікатор (крок 02) і суддя (крок 05) | власний код, OpenAI Chat Completions | `gpt-5.6-terra`, $2 / $12 за 1 млн токенів | платний (інша родина, ніж виконавець) |
| Брами | GitHub Actions, ubuntu-latest, Node 24 | `actions/checkout@v7`, `setup-node@v7`, `upload-artifact@v7`, `download-artifact@v8` | безкоштовний |
| Тести й інструменти | Vitest 5.0.0, TypeScript 6, tsx 4.23.13, zod 4.5.4, `ai` 7.0.118 | — | безкоштовний |
| Трасування | власні спани з артефактів (без OpenTelemetry SDK і бекенду) | — | безкоштовний |

**Витрати:** ≈ **$7.7 із $10** (ліміт власник підняв із $4 до $10 на кроці 04 письмово): фабрика й проби ≈ $2.8, верифікатор і суддя ≈ $0.6, зупинення ≈ $0.7, evals ≈ $3.0, red-team ≈ $0.6. Усі вартості — клієнтська оцінка (`cost_usd_estimate`), а не рахунок.

## 4. Як повторити автономний прогін

1. `npm ci`; ключі лише в локальному файлі секретів (його читає людина, агент ні); `git fetch origin`.
2. **Режим дозволів:** `dontAsk` + явний `--allowedTools` (`Read, Glob, Grep, Edit, Write, Bash(npm test *), Bash(npm run typecheck *), Bash(npm run lint *), Bash(npx vitest *), Bash(npx tsx *), Bash(git diff *), Bash(git status *)`) + `--disallowedTools` на читання секретоподібних файлів + `--setting-sources project` + `--strict-mcp-config`; обходу дозволів немає ([`run-task.ts`](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/scripts/harness/run-task.ts)).
3. **Ізоляція:** окреме `git worktree` на кожну задачу чи спробу; мережа не вимкнена (див. `redteam.md`).
4. Прогони (кожен ХОДИТЬ У МЕРЕЖУ й коштує гроші; стелі — `--max-total-usd`):
   - черга: `npx tsx scripts/harness/run-queue.ts docs/lab3/tasks.jsonl --id t-07 --max-total-usd 1`
   - evals (агент): `HARNESS_MODEL=haiku npx tsx scripts/evals/run-evals.ts --max-total-usd 5`; перегрейд і брама **без мережі**: `npx tsx scripts/evals/regrade.ts && npx tsx scripts/evals/gate.ts`
   - верифікатор: `npx tsx --env-file=<файл секретів> scripts/harness/verify-task.ts --task t-08 --head <sha>`
   - суддя: `... scripts/judge/run-judge.ts --rubric docs/lab3/rubric/after.md`; числа: `npx tsx scripts/judge/calibrate.ts <вердикти> --final`
   - трасування й класифікація (без мережі): `npx tsx scripts/telemetry/export-traces.ts`
   - red-team: `HARNESS_MODEL=haiku npx tsx scripts/redteam/run-redteam.ts --phase fixed`
5. Перевірки репозиторію: `npm run typecheck && npm run lint && npm test` (306 тестів, без мережі й ключів).

## 5. Що не виконано або виконано частково (чесно)

- **Журнал автономності: критерій «≥ 4 сесії, дати розподілені по тижнях» не виконано за духом.** У `autonomy-log.md` 9 записів про Лаб. 3 (кроки 00–08), але вони відповідають **крокам**, а не окремим сесіям: усю Лаб. 3 зроблено однією довгою сесією `4b9d5995` за один день, 2026-11-08. Лаб. 1–2 мають сесії від 2026-10-31, 2026-11-01 і 2026-11-07 (їхні журнали). Задним числом цього не виправити, і я цього не приховую.
- **Обов'язкові перевірки на `main` (набір правил) не ввімкнено.** `gates.md`, розділ 2. Без цього ланцюг брам — рекомендація, а не брама. Причина відкладення описана там; вмикається лише з дозволу власника репозиторію.
- **Трасування не в бекенді:** власні спани з артефактів, без OpenTelemetry, Langfuse і знімків екрана (рішення власника). Дерево `invoke_agent → chat → execute_tool` не побудовано: `chat`-спанів у Claude Code немає ([`errors.md`](https://github.com/rsukhai/sentari/blob/88f1dc3b321df13f07e82f71607eec43d71d55c6/docs/lab3/errors.md)).
- **Evals у CI не запускають агента** (платно, ключа Anthropic у CI немає): CI перегрейджує збережені спроби й ловить регресії оцінювачів, міток і банку, але не регресії самого агента. У брамі лише **3 задачі** з 7 regression (`haiku` нестабільний на `typecheck`).
- **Суддя:** `κ` завищена (критерії й розмітку писав агент), відкладені 6 випадків легші за робочі; для виміру `code_behavior` суддя лише дає пораду.
- **Дозволи агента до коміту `37144424` були ширшими за документовані** (`dontAsk` підмішував користувацькі правила): знайдено на кроці 06, виправлено, попередні документи доповнено нотатками.
- **Red-team:** `haiku`, один прогін на сценарій; 3 із 7 «зупинок» — відмова агента, а не захист; запобіжник-модель не додано; мережа в ізоляції не вимкнена; вхід верифікатора (текст агента) не атакувався.
- **Не моє:** публічність репозиторію в приватному вікні, рядок групи й посилання на PR викладача з Лаб. 1 — за власником.

## 6. Перевірка історії на секрети

- Файли секретів у всіх гілках: `git log --all --diff-filter=A --name-only` з відбором `(^|/)\.env(\.local)?$` → **порожній вивід**. У git лише шаблон `.env.example`.
- Рядки за шаблонами ключів (`sk-…`, `AIza…`, `pk-lf-`, `sk-lf-`): `git log --all -G '<шаблон>'` дає 4 коміти, **усі хибні збіги**: `task-<hex>` у назві файлу траси (підрядок `sk-` + hex), тестова фікстура `sk-proj-abcdefghijklmnopqrstuvwx` у `tests/lab2/verify.test.ts`, і рядок команди пошуку в журналі Лаб. 2. Ключ у git не потрапляв, тож відкликати нічого не довелось.
- Канарка red-team (`канарка-NOT-A-SECRET-7f3a`) фальшива; файл-канарка названо `local-secrets.canary`, а не `.env`.

## 7. Файли `docs/lab3/`

[`factory.md`](factory.md) · [`gates.md`](gates.md) · [`verifier.md`](verifier.md) · [`stop.md`](stop.md) · [`evals.md`](evals.md) · [`judge.md`](judge.md) · [`errors.md`](errors.md) · [`redteam.md`](redteam.md) · [`autonomy-log.md`](autonomy-log.md) · [`traces/`](traces) · [`runs/`](runs) · [`evals-runs/`](evals-runs) · [`redteam-runs/`](redteam-runs) · `tasks.jsonl`, `tasks-rejected.jsonl`, `evals.jsonl`, `evals-baseline.json`, `judge-cases.jsonl`, `redteam.jsonl`, `stop-log.jsonl`
