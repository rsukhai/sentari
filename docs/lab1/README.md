# Пакет доказів · Лабораторна 1

Автор: Роман Сухай, група <група> · репозиторій: https://github.com/rsukhai/sentari

> Посилання на рядки журналу — GitHub permalink на конкретний коміт (`…/blob/<sha>/…#L<N>`). Скріншоти лежать у репозиторії, бо артефакти CI живуть 7 днів, дані Langfuse Hobby — 30 днів, логи Vercel Hobby — годину.

## Інструменти

| Роль | Інструмент | Версія (`<інструмент> --version`) | План або модель |
|---|---|---|---|
| Агент кодування A | Claude Code | 2.1.269 | розширення VS Code і CLI; claude-sonnet-5 / claude-opus-5-5 (API-ключ Anthropic) |
| Агент кодування B | Codex CLI | codex-cli 0.157.1 | gpt-6-sol (API-ключ OpenAI) |
| Локальна модель | Ollama | 0.34.4 | qwen3:4b (роль `local`), qwen3.5:4b, nomic-embed-text |

## Як запустити у двох інструментах

Спільне для обох:
1. `npm install` · `npm run doctor` (має бути 0 FIX) · `cp .env.example .env.local` і заповнити ключі (`.env.local` веде людина, агенти його не читають).
2. Правила проєкту — `AGENTS.md`; навичка — `.claude/skills/add-api-route/` (джерело) і `.agents/skills/add-api-route/` (копія: `npm run sync-skills`).
3. Журнал дій пишеться автоматично в `.agent-log/<інструмент>.jsonl`; журнали між гілками зливаються без конфліктів (`.gitattributes`: `merge=union`).

### Claude Code

1. `claude` у корені репозиторію (або розширення VS Code). `CLAUDE.md` імпортує `AGENTS.md` рядком `@AGENTS.md`.
2. Hooks з `.claude/settings.json` підхоплюються автоматично: журнал (`PostToolUse`, `PostToolUseFailure` → `.agent-log/claude-code.jsonl`) і заборона `.env*` (`PreToolUse` → `scripts/agent-env-guard.mjs claude-code`, плюс `permissions.deny`). Налаштування перечитуються після зміни гілки.
3. MCP Context7 — з `.mcp.json` (дозволено через `enabledMcpjsonServers`); перевірка: `claude mcp list`.
4. Режим плану: `Shift+Tab` → `plan` або `claude --permission-mode plan`.

### Codex CLI

1. `codex` у корені репозиторію. `AGENTS.md` Codex читає сам.
2. Hooks — `.codex/hooks.json` (журнал → `.agent-log/codex.jsonl`, заборона `.env*`). **Після першого запуску і після кожної зміни hook — `/hooks` і підтвердити довіру**, інакше hook мовчки не виконується.
3. MCP Context7 — з `.codex/config.toml`; перевірка: `codex mcp list`.
4. Режим плану: `/plan` або `codex --sandbox read-only`. Неінтерактивно: `codex exec … < /dev/null` (без `< /dev/null` чекає stdin).

## Прогони CI

- Зелений прогін на `main`: https://github.com/rsukhai/sentari/actions/runs/36312657838 (обидва jobs зелені)
- Зелений job «Playwright (не блокує)» зі скріншотом: https://github.com/rsukhai/sentari/actions/runs/36238213904 · копія скріншота: [`e2e-home.png`](e2e-home.png)
- Червоний прогін «поганого патча» від викладача: <посилання на PR і прогін — з'явиться, коли викладач відкриє пул-реквест>
- Самоперевірка брам до пул-реквесту: гілка `lab1/bad-patch-selfcheck` (прибрано `timestamp` у `/api/health`) → **червоний** job verify на кроці «Перевірка типів»: https://github.com/rsukhai/sentari/actions/runs/36312478143 (у `main` не злито)
- Тест підтвердження `write_file` (крок 09): https://github.com/rsukhai/sentari/actions/runs/36309592250

## Та сама задача в двох інструментах

- Контракт окремим комітом у `main` раніше за реалізації: [`a9b2a822`](https://github.com/rsukhai/sentari/commit/a9b2a822) (червоний CI до реалізації).
- `lab1/health-claude-code`: https://github.com/rsukhai/sentari/tree/lab1/health-claude-code · порівняння з контрактом: https://github.com/rsukhai/sentari/compare/a9b2a822...lab1/health-claude-code
- `lab1/health-codex`: https://github.com/rsukhai/sentari/tree/lab1/health-codex · порівняння з контрактом: https://github.com/rsukhai/sentari/compare/a9b2a822...lab1/health-codex
- У `main` злито: `lab1/health-codex`, коміт [`24000754`](https://github.com/rsukhai/sentari/commit/24000754)
- Власний цикл на тій самій задачі: `lab1/health-loop` (пропозиції не застосовано — не пройшли контракт), див. [`comparison.md`](comparison.md)

## Деплой і траси

- Ендпоінт: `POST https://sentari-flax.vercel.app/api/agent` · рантайм: Vercel Hobby (Node.js, Next.js 16) · модель: gemini-3.8-flash (free tier), інструмент `getTime`, `isStepCount(3)`
- Система трасування: Langfuse Cloud Hobby через OpenTelemetry (`instrumentation.node.ts`, `src/otel/langfuse.ts`), `telemetry.functionId: 'lab01-agent'` · скріншоти: [`traces/`](traces/)

Команда виклику (Git Bash / zsh):

```bash
URL='https://sentari-flax.vercel.app/api/agent'
for p in 'Котра зараз година?' 'Скільки хвилин лишилось до півночі?' 'Привітайся одним реченням'; do
  printf '{"prompt":"%s"}' "$p" | curl -s -X POST "$URL" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-; echo
done
```

| Траса | Час (Kyiv) | Інструмент | Токени | Вартість у Langfuse | Звірка з `src/models.ts` |
|---|---|---|---|---|---|
| [`trace-1-gettime.png`](traces/trace-1-gettime.png) — «Котра зараз година?» | 2026-09-27 13:17:11 | `getTime` | 109 (крок 1) | $0.000259 | — |
| [`trace-2-greeting.png`](traces/trace-2-greeting.png) — «Привітайся одним реченням» | 2026-09-27 13:18:02 | — | 270 (52 вх. / 218 вих.) | $0.000857 | 52 × $0.75/1M + 218 × $3.75/1M = $0.0008565 ✅ |
| 3-тя траса | — | — | — | — | див. нижче |

Список трас: [`traces-list.png`](traces/traces-list.png). **Третьої повної траси немає**: після двох успішних запитів денна квота Gemini free tier (20 запитів) вичерпалась, запит «до півночі» зупинився на `429` після виклику `getTime` (траса 13:17:38 на знімку списку — без відповіді другого кроку). Вирішено не чекати відновлення квоти.

## Докази за критеріями

| Критерій | Файл або посилання |
|---|---|
| AGENTS.md ≤ 200 рядків, тест 40% | [`AGENTS.md`](../../AGENTS.md) (56 рядків, 21 правило) · [`agents-md-40.md`](agents-md-40.md) · гілки `lab1/agents-md-40-full`, `lab1/agents-md-40-cut` |
| `CLAUDE.md` з `@AGENTS.md` | [`CLAUDE.md`](../../CLAUDE.md) |
| Журнал із двох інструментів | [`.agent-log/claude-code.jsonl`](../../.agent-log/claude-code.jsonl), [`.agent-log/codex.jsonl`](../../.agent-log/codex.jsonl); цикл — [`agent-loop.jsonl`](../../.agent-log/agent-loop.jsonl) |
| Впевнені помилки | [`confident-errors.md`](confident-errors.md) — 8 помилок з permalink |
| Навичка, обидва розташування, спрацювання | [`.claude/skills/add-api-route/`](../../.claude/skills/add-api-route/) · [`.agents/skills/add-api-route/`](../../.agents/skills/add-api-route/) · [`skill-trigger.md`](skill-trigger.md) (12/12) |
| Заборона: рядок `denied` | Claude Code: [`claude-code.jsonl#L240`](https://github.com/rsukhai/sentari/blob/e1cec645a1ccde3602dd8303ba34b2a9b171eacc/.agent-log/claude-code.jsonl#L240) (`echo … >> .env`), [`#L241`](https://github.com/rsukhai/sentari/blob/e1cec645a1ccde3602dd8303ba34b2a9b171eacc/.agent-log/claude-code.jsonl#L241) (`node -e`) · Codex: [`codex.jsonl#L83-L85`](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L83-L85) (`apply_patch`, `echo`, `node -e`) |
| MCP і ціна контексту | [`context-cost.md`](context-cost.md) |
| Оцінка токенів, кеш, ua/en, три прогони | [`cost.md`](cost.md) |
| Власний цикл і тести | [`src/agent/agent-loop.ts`](../../src/agent/agent-loop.ts) · [`tests/agent-loop.test.ts`](../../tests/agent-loop.test.ts) |
| Порівняння «та сама задача» | [`comparison.md`](comparison.md) |
| SDK і підтвердження дій | [`src/agent/agent-aisdk.ts`](../../src/agent/agent-aisdk.ts) · [`tests/agent-aisdk.test.ts`](../../tests/agent-aisdk.test.ts) |
| Скріншот-тест | [`tests/health-link.spec.ts`](../../tests/health-link.spec.ts) · [`e2e-home.png`](e2e-home.png) |
| Рішення про модель | [`model-decision.md`](model-decision.md) |
| Переносність | [`portability.md`](portability.md) |
| Журнал автономності | [`autonomy-log.md`](autonomy-log.md) |
| Чернетка «Вступу» | [`intro-draft.md`](intro-draft.md) |

## Відомі прогалини (чесно)

- Третя траса Langfuse — не зроблена (квота Gemini), див. «Деплой і траси».
- Цикл у хмарі на Gemini (`comparison.md`) — повного прогону немає (`503`/`429`); друга форма API закрита локально через `ollama-chat`.
- `.agent-log/session.jsonl` (старий шаблонний hook, до 26.09) містить вміст записаних файлів; секретів немає, рядки не видалено — інцидент описано в `autonomy-log.md`.
- `git log --stat -- .agent-log` показує видалені рядки в комітах `601d7d4c`, `ad747a12`: це відновлення дослівного журналу після помилки агента під час cherry-pick, а не підчищення — див. «Інциденти» в `autonomy-log.md`.
