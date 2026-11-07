# Пакет доказів · Лабораторна 2

Автор: Роман Сухай · репозиторій: https://github.com/rsukhai/sentari · тема — асистент по колекції документів (OBD-II / автодіагностика): специфікація, еталонний набір, субагенти, верифікатор, гібридний пошук, MCP-сервер.

> Межа з Лабораторною 1 — тег `lab1-submission` → коміт [`8c640b6c`](https://github.com/rsukhai/sentari/commit/8c640b6cc9a66c6e5f1eee7635e3131bb3731dea). Тека `docs/lab1/` не змінювалась (`git diff lab1-submission..HEAD -- docs/lab1` порожній). Усе нове — у `docs/lab2/`, `src/rag/`, `src/mcp/`, `src/verify/`, `scripts/` і `tests/lab2/`.

## Головний результат (одне твердження, яке можна перевірити)

За однієї методики (набір `5240af6b`, `gpt-5.6-luna`, системний промпт базової лінії, вердикти ставила людина за правилом з `baseline.md`) гібридний пошук **підняв правильні відмови з 0 до 3 із 4** і дав цитати, але **не підняв точність**: 44% (7/16) без пошуку → **13% (2/16)** з пошуком → 38% (6/16) після виправлення промпту генерації, підібраного на цьому ж наборі. Пошук доставляє потрібний документ у 84% запитів (recall@5 = 0,84, MRR@5 = 0,86). **Ціль G1 і критерій A3 (≥ 60%) не досягнуто.** Деталі, розбір помилок і межі вимірювання — [`eval-report.md`](eval-report.md), розділ «Підсумок».

## Брами

| Брама | Стан | Доказ |
|---|---|---|
| CI на `main` зелений | так | [прогін після злиття кроків 04–05](https://github.com/rsukhai/sentari/actions/runs/41333807034) *(останній прогін на `main` після злиття кроків 06–10 — рядок «Фінальний стан» нижче)* |
| `docs/lab1/` не змінено | так | `git diff lab1-submission..HEAD --stat -- docs/lab1` → порожньо |
| Репозиторій публічний | перевіряє власник у приватному вікні | https://github.com/rsukhai/sentari |
| Журнал автономності ≥ 4 сесій | так | [`autonomy-log.md`](autonomy-log.md) — сесії від 2026-10-31, 2026-11-01 і 2026-11-07, кожна з датою, інструментом і моделлю, режимом, втручаннями й доказами; записи додавались по ходу роботи (історія комітів файлу) |
| Секретів немає | так | у git із файлів оточення лише [`.env.example`](../../.env.example) (без значень); конфігурації MCP без ключів; транскрипт агента перевірено на рядки `sk-…` |
| **Верифікатор** | **червоний на A3 для кроку 06** | див. «Верифікатор» нижче: брама спрацювала, зміну злито свідомим рішенням власника |

## Кроки: файл → коміт → прогін

| Крок | Артефакт | Ключові коміти | Прогін / доказ |
|---|---|---|---|
| 00 Специфікація | [`spec.md`](spec.md) *(писав власник, не агент)* | [`e42c784e`](https://github.com/rsukhai/sentari/commit/e42c784edab53cb32822f5bac331fa5060edcb96) — перший коміт Лаб. 2, раніше за будь-який код | `git log --reverse -- docs/lab2/spec.md` |
| 01 Еталонний набір, базова лінія | [`eval-set.md`](eval-set.md), [`golden/queries.jsonl`](golden/queries.jsonl), [`baseline.md`](baseline.md), [`baseline-run.jsonl`](baseline-run.jsonl), [`baseline-grades.jsonl`](baseline-grades.jsonl) | колекція [`5842ba75`](https://github.com/rsukhai/sentari/commit/5842ba75), чернетка набору [`35372021`](https://github.com/rsukhai/sentari/commit/35372021bb1bd636027ff06bcbb5e131a750b619) → [`0aec027b`](https://github.com/rsukhai/sentari/commit/0aec027bad1ba6741de59efe5eb8165abbc3720e), **заморозка [`5240af6b`](https://github.com/rsukhai/sentari/commit/5240af6b5bf28654493d1f3ab8e11d107d98f5d6)**, скрипт [`4126bbc1`](https://github.com/rsukhai/sentari/commit/4126bbc169b6df797f42e549532c89c58d9af294), базова лінія [`0b19b71e`](https://github.com/rsukhai/sentari/commit/0b19b71efd3f6ddec1313a5171b94e15972cd9ee) | [CI зі зеленим валідатором набору](https://github.com/rsukhai/sentari/actions/runs/41195462280); `git log 5240af6b..HEAD -- docs/lab2/golden/queries.jsonl` порожній |
| 02 Субагенти | [`subagents.md`](subagents.md), [`.claude/agents/spec-auditor.md`](../../.claude/agents/spec-auditor.md), [`.claude/agents/explorer.md`](../../.claude/agents/explorer.md) | [`786855de`](https://github.com/rsukhai/sentari/commit/786855de3b68894b2babc691634dba1954411b89) | рядки делегування в [`.agent-log/claude-code.jsonl`](../../.agent-log/claude-code.jsonl) (permalink-и в `subagents.md`) |
| 03 Верифікатор | [`verifier.md`](verifier.md), [`src/verify/`](../../src/verify), [`scripts/verify.ts`](../../scripts/verify.ts), [`.github/workflows/verifier.yml`](../../.github/workflows/verifier.yml), [`calibration/`](calibration) | розмітка до прогону [`cf8ff413`](https://github.com/rsukhai/sentari/commit/cf8ff4132c44ffaacabf108d93136805ed92bf22), верифікатор [`2f52bb49`](https://github.com/rsukhai/sentari/commit/2f52bb4995e748d8e256b5cc5ad2e89e35027594) | **стоп**: [PR #2](https://github.com/rsukhai/sentari/pull/2), демо-коміт [`3a9ef7b1`](https://github.com/rsukhai/sentari/commit/3a9ef7b1417ebf80e2ce36999d2d5ad175ba4e00) → [червоний прогін](https://github.com/rsukhai/sentari/actions/runs/41199301716) (`fail A4`) → виправлення [`35b24e5f`](https://github.com/rsukhai/sentari/commit/35b24e5f65ccf03aa22f6464936cd6d62ad55096) → [зелений прогін](https://github.com/rsukhai/sentari/actions/runs/41199438100) |
| 04 Індексація | [`indexing.md`](indexing.md), [`src/rag/chunk.ts`](../../src/rag/chunk.ts), [`src/rag/embed.ts`](../../src/rag/embed.ts), [`src/rag/store.ts`](../../src/rag/store.ts), [`scripts/build-index.ts`](../../scripts/build-index.ts), [`data/index.json`](../../data/index.json) | [`64c28feb`](https://github.com/rsukhai/sentari/commit/64c28feb44f7f1b1a1a15522480aa85bb77276f9) | [PR #4](https://github.com/rsukhai/sentari/pull/4); 23 документи, 461 фрагмент, 1200/200/120, `embeddinggemma-2:270m`; тести `tests/lab2/{chunk,index}.test.ts` |
| 05 Гібридний пошук | [`retrieval.md`](retrieval.md), [`src/rag/{bm25,rrf,search,cite,answer}.ts`](../../src/rag) | [`68736cac`](https://github.com/rsukhai/sentari/commit/68736cac96f08f15d11b25b944c842afdc3d4302) | [PR #5](https://github.com/rsukhai/sentari/pull/5); приклад відповіді з джерелами (q-12) і відмови (q-16) — у `retrieval.md`, розділ 5; тести `tests/lab2/retrieval.test.ts` |
| 06 Оцінювання | [`eval-report.md`](eval-report.md), [`eval-run-1.jsonl`](eval-run-1.jsonl) + [`eval-grades-1.jsonl`](eval-grades-1.jsonl) (прогін 1), [`eval-run.jsonl`](eval-run.jsonl) + [`eval-grades.jsonl`](eval-grades.jsonl) (прогін 2), [`scripts/eval-run.ts`](../../scripts/eval-run.ts), [`src/metrics.ts`](../../src/metrics.ts) | [`13c05994`](https://github.com/rsukhai/sentari/commit/13c05994775e266c6b434c24fd43d80d8c07add2), виправлення генерації [`c9d78c8d`](https://github.com/rsukhai/sentari/commit/c9d78c8d940bea3af2cbdd447c8016b25eb869ce) | [PR #6](https://github.com/rsukhai/sentari/pull/6), [червоний прогін верифікатора (`fail A3`)](https://github.com/rsukhai/sentari/actions/runs/41335544190); `git diff --no-index scripts/baseline.ts scripts/eval-run.ts` — у звіті |
| 07 Паралельність, бюджет | [`budget.md`](budget.md), [`parallel-run.json`](parallel-run.json), [`scripts/parallel-eval.ts`](../../scripts/parallel-eval.ts), [`src/rag/pool.ts`](../../src/rag/pool.ts) | [`2b2c6da7`](https://github.com/rsukhai/sentari/commit/2b2c6da7cc14668150d98f8479fbe86f32dad87c) | [CI гілки](https://github.com/rsukhai/sentari/actions/runs/41337587326); час стіни 22,4 → 3,0 с (7,5×) за тих самих токенів |
| 08 MCP-сервер | [`mcp-spec.md`](mcp-spec.md), [`src/mcp/tools.ts`](../../src/mcp/tools.ts), [`src/mcp/server.ts`](../../src/mcp/server.ts), [`tests/lab2/mcp.test.ts`](../../tests/lab2/mcp.test.ts) | специфікація **раніше за код**: [`15d298df`](https://github.com/rsukhai/sentari/commit/15d298dfd555fa47bba7b662389c391a6bf3fda6) → [`2deeced0`](https://github.com/rsukhai/sentari/commit/2deeced0f2843cb3421d947fa4c82c6c80289189) | [CI гілки](https://github.com/rsukhai/sentari/actions/runs/41339024549); smoke Inspector — [`traces/mcp-smoke.md`](traces/mcp-smoke.md) |
| 09 Підключення | [`mcp-integration.md`](mcp-integration.md), [`.mcp.json`](../../.mcp.json), [`scripts/mcp-demo.ts`](../../scripts/mcp-demo.ts) | [`09ab8d30`](https://github.com/rsukhai/sentari/commit/09ab8d30de86e8e46b6ab108cca614589854bfe6) | [CI гілки](https://github.com/rsukhai/sentari/actions/runs/41341417169); транскрипт агента [`traces/claude-code-mcp.jsonl`](traces/claude-code-mcp.jsonl), застосунок [`traces/app-mcp.txt`](traces/app-mcp.txt), журнал сервера з `source=claude-code` і `source=sentari-app` — [`traces/mcp-calls.jsonl`](traces/mcp-calls.jsonl) |
| 10 Пакет | цей файл, [`autonomy-log.md`](autonomy-log.md) | — | — |

**Фінальний стан `main`:** рядок CI-прогону на `main` після злиття кроків 06–10 додається коммітом сюди одразу після злиття *(див. історію цього файлу)*.

## Верифікатор: що він зупинив і чого не зупинив

- **Зупинив і виправлено:** [PR #2](https://github.com/rsukhai/sentari/pull/2) — видалення двох статей колекції → `fail A4` (правильно); після повернення файлів — зелено. Це навмисна демонстрація, не злито.
- **Зупинив, зміну злито свідомо:** [PR #6](https://github.com/rsukhai/sentari/pull/6) — крок 06 дає `fail A3` (точність 13% < 60%; після виправлення 38%), `pass A5`. 2026-11-01 власник вирішив не зливати; 2026-11-07, після прогону 2 (A3 усе ще не виконано), — злити кроки 06–10 у `main` з червоним вердиктом, залишивши невиконаний критерій і числа в [`eval-report.md`](eval-report.md). Агент злиття не виконував.
- **Чесні вади судді:** калібрування 53/55 і 52/55, але лише 3/5 і 2/5 на рішучих клітинках; хибний `fail A1` на PR #2; `fail A3` на кроці 08 із хибним доказом (незмінний контекст журналу). Деталі — [`verifier.md`](verifier.md).

## Що не виконано або виконано частково (чесно)

- **A3 (точність ≥ 60%) і ціль G1** — не досягнуто: 13% / 38%.
- **Скріншотів трас немає** (`traces/eval-run.png`, `parallel-before.png`, `parallel-after.png`) — рішення власника. Замість них — числа в `eval-run*.jsonl`, `parallel-run.json` і виводи команд у `budget.md`, `mcp-integration.md`, `traces/`.
- **Розбіжності в `spec.md`** (писав власник, агент його не правив): обсяг колекції «~550 тис.» проти фактичних 355 тис. символів; ціль G3 «2 із 20 запитів tag=unanswerable» при 4 таких запитах; незакінчені місця («<» в розділі 5, «крипт» у розділі 6). Числа G1–G5 у `eval-report.md` звірено з їхнім дослівним текстом.
- **Перекалібрування верифікатора** після змін вхідних даних (`da11c4a5`) не робилось — записано в `verifier.md`.
- **Лаб. 1** (не частина цього пакета): група й посилання на PR викладача в `docs/lab1/README.md` лишаються за власником.

## Інструменти й моделі

| Роль | Інструмент / модель | Версія |
|---|---|---|
| Агент кодування | Claude Code (розширення VS Code, CLI) | 2.1.269; моделі: Claude Opus 5.5 (`claude-opus-5-5`) 2026-10-31 — 2026-11-01, Claude Sonnet 5.5 (`claude-sonnet-5-5`) з 2026-11-07 |
| Субагенти кроку 02 | spec-auditor (sonnet), explorer (haiku) через `claude -p --agent` | — |
| Відповіді асистента, базова лінія | OpenAI `gpt-5.6-luna` | Chat Completions, `reasoning_effort: none`; $0.20 / $1.20 за 1 млн (звірено 2026-10-31) |
| Верифікатор | OpenAI `gpt-5.6-terra` | $2 / $12 за 1 млн (звірено 2026-10-31) |
| Ембедінги | Ollama `embeddinggemma-2:270m`, 768 вимірів | Ollama 0.40.11 |
| MCP | `@modelcontextprotocol/server` і `client` | 2.3.1 (ревізія протоколу 2026-07-28); Inspector 2.13.0 |
| Середовище | Node 24, TypeScript 6, Vitest 5.0.0, tsx 4.23.13, zod 4.5.4, `ai` 7.0.118 | — |

## Як відтворити

```bash
npm install                                    # залежності (lock-файл відтворюється в Docker node:24)
ollama pull embeddinggemma-2:270m              # локальний ембедер; Ollama має працювати
npx tsx scripts/lab2/fetch-obd.ts check        # критерій A4: 23 документи в data/obd/ → exit 0
npx tsx scripts/validate-golden.ts docs/lab2/golden/queries.jsonl   # критерій A2
npm test                                       # тести без мережі і без ключів
npm run index                                  # індексація → data/index.json (461 фрагмент, ≈ 12 с)
npx tsx scripts/search.ts "Can I clean a dirty MAF sensor with brake cleaner?" --explain   # пошук
npm run mcp                                    # MCP-сервер (stdio); чекає на stdin
npx tsx scripts/mcp-demo.ts                    # застосунок викликає обидва інструменти сервера
# потребують ключа OpenAI (файл оточення поза git, через --env-file):
npx tsx --env-file=<файл> scripts/ask.ts "<запит>"                              # відповідь з джерелами
npx tsx --env-file=<файл> scripts/eval-run.ts docs/lab2/golden/queries.jsonl    # прогін набору
npx tsx scripts/eval-run.ts summary                                              # підсумок без мережі
```

Колекція (`data/obd/`) закомічена; її джерело — 23 статті англійської Вікіпедії під CC BY-SA 4.0, ревізії закріплено `oldid` у шапці кожного файлу, перелік — розділ 2 [`spec.md`](spec.md).

## Весь перелік `docs/lab2/`

[`spec.md`](spec.md) · [`eval-set.md`](eval-set.md) · [`baseline.md`](baseline.md) · [`subagents.md`](subagents.md) · [`verifier.md`](verifier.md) · [`indexing.md`](indexing.md) · [`retrieval.md`](retrieval.md) · [`eval-report.md`](eval-report.md) · [`budget.md`](budget.md) · [`mcp-spec.md`](mcp-spec.md) · [`mcp-integration.md`](mcp-integration.md) · [`autonomy-log.md`](autonomy-log.md) · [`traces/`](traces)
