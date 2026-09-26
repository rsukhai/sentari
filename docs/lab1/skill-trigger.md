# Тест спрацьовування навички: add-api-route

Опис на момент тесту: "Додає API-маршрут у app/api: zod-схема в src/, обробник route.ts, тест у tests/. Використовувати, коли просять новий ендпоінт, API-маршрут або HTTP-обробник. Не для сторінок, компонентів чи стилів."

Умови: кожен запит — нова неінтерактивна сесія, лише читання, щоб агент нічого не змінював у коді:
- Claude Code 2.1.269: `claude -p --permission-mode plan "<запит>"`;
- Codex CLI 0.157.1: `codex exec --sandbox read-only "<запит>"`.

Посилання — на коміт [`94eb2235`](https://github.com/rsukhai/sentari/commit/94eb22358b327a6fdfdf9ab70b8718a429b90ff9), файл `.agent-log/claude-code.jsonl`.

| # | Запит (без назви навички) | Очікування | Claude Code: сталося | Доказ (ts · tool) | Codex: сталося | Доказ |
|---|---|---|---|---|---|---|
| 1 | Додай ендпоінт /api/version, що повертає версію з package.json | викликає | викликав (сесія `07dcc6bc`) | [#L134](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L134) · `10:06:52Z` · `Read` SKILL.md | не виконано | квота OpenAI |
| 2 | Потрібен API-маршрут, що повертає список ролей моделей із src/models.ts | викликає | викликав (`2e947e9f`) | [#L156](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L156) · `10:09:52Z` · `Bash` (`cat … SKILL.md`) | не виконано | квота OpenAI |
| 3 | Зроби POST-обробник /api/echo, який повертає тіло запиту | викликає | викликав (`58f34aff`) | [#L169](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L169) · `10:11:32Z` · `Bash` (`cat … SKILL.md`) | не виконано | квота OpenAI |
| 4 | Зміни текст заголовка на головній сторінці | не викликає | не викликав (`23ddb8e1`) | [#L190-L195](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L190-L195) — жодного `SKILL.md` | не виконано | квота OpenAI |
| 5 | Напиши тест для src/models.ts | не викликає | не викликав (`74153a5a`) | [#L196-L209](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L196-L209) — жодного `SKILL.md` | не виконано | квота OpenAI |
| 6 | Поясни, що робить app/api/health/route.ts | не викликає | не викликав (`4f59c05d`) | [#L210](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L210) — жодного `SKILL.md` | не виконано | квота OpenAI |

Результат: Claude Code — **6 з 6** як очікувалось. Codex — **0 з 6 виконано**. Зміни в описі: не знадобились.

## Що не зроблено й чому

- **Codex.** Усі шість сесій `codex exec` (26.09, 13:17, `~/.codex/sessions/2026/09/26/`) завершились за ~2 с помилкою `ERROR: Quota exceeded. Check your plan and billing details.` — на API-ключі OpenAI скінчилась квота. Жодного виклику інструмента, тож у `.agent-log/codex.jsonl` рядків немає. Спроба з локальною моделлю (`codex exec --oss --local-provider ollama -m qwen3.5:4b`) за 10+ хв не дійшла до жодного виклику й була зупинена. **Критерій «навичку видно в журналі обох інструментів» поки не виконано** — для Codex тест треба повторити після поповнення квоти.
- Навичку Codex бачитиме з `.agents/skills/add-api-route/` (копія синхронна: `npm run sync-skills -- --check` → 0), але сам виклик не перевірено.

## Спостереження

- Claude Code у неінтерактивному режимі ні разу не використав окремий інструмент `Skill`: навичку знаходив за описом і читав `SKILL.md` через `Read` або `cat`. Тому в журналі шукаємо `SKILL.md`, а не `"tool":"Skill"`.
- У запитах 1 і 3 агент також прочитав `scripts/check-route.mjs` ([#L135](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L135), [#L182](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L182)), тобто взяв до уваги крок перевірки з навички.
