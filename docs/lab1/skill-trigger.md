# Тест спрацьовування навички: add-api-route

Опис на момент тесту: "Додає API-маршрут у app/api: zod-схема в src/, обробник route.ts, тест у tests/. Використовувати, коли просять новий ендпоінт, API-маршрут або HTTP-обробник. Не для сторінок, компонентів чи стилів."

Умови: кожен запит — нова неінтерактивна сесія, лише читання, щоб агент нічого не змінював у коді:
- Claude Code 2.1.269 (claude-sonnet-5): `claude -p --permission-mode plan "<запит>"`;
- Codex CLI 0.157.1 (gpt-6-sol): `codex exec --sandbox read-only "<запит>" < /dev/null`.

Посилання: Claude Code — коміт [`94eb2235`](https://github.com/rsukhai/sentari/commit/94eb22358b327a6fdfdf9ab70b8718a429b90ff9), `.agent-log/claude-code.jsonl`; Codex — коміт [`c9e7fb89`](https://github.com/rsukhai/sentari/commit/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4), `.agent-log/codex.jsonl`.

| # | Запит (без назви навички) | Очікування | Claude Code | Доказ (ts · tool) | Codex | Доказ (ts · tool) |
|---|---|---|---|---|---|---|
| 1 | Додай ендпоінт /api/version, що повертає версію з package.json | викликає | викликав (`07dcc6bc`) | [#L134](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L134) · `10:06:52Z` · `Read` SKILL.md | викликав (`01a0dd5c-3cee`) | [#L35](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L35) · `10:56:51Z` · `Bash` `cat .agents/skills/…/SKILL.md` |
| 2 | Потрібен API-маршрут, що повертає список ролей моделей із src/models.ts | викликає | викликав (`2e947e9f`) | [#L156](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L156) · `10:09:52Z` · `Bash` `cat … SKILL.md` | викликав (`01a0dd5c-7fc6`) | [#L44](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L44) · `10:57:07Z` · `Bash` |
| 3 | Зроби POST-обробник /api/echo, який повертає тіло запиту | викликає | викликав (`58f34aff`) | [#L169](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L169) · `10:11:32Z` · `Bash` `cat … SKILL.md` | викликав (`01a0dd5c-d5b1`) | [#L54](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L54) · `10:57:30Z` · `Bash` |
| 4 | Зміни текст заголовка на головній сторінці | не викликає | не викликав (`23ddb8e1`) | [#L190-L195](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L190-L195) — жодного `SKILL.md` | не викликав (`01a0dd5d-28aa`) | [#L60-L69](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L60-L69) — жодного `SKILL.md` |
| 5 | Напиши тест для src/models.ts | не викликає | не викликав (`74153a5a`) | [#L196-L209](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L196-L209) — жодного `SKILL.md` | не викликав (`01a0dd5d-eda8`) | [#L70-L75](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L70-L75) — жодного `SKILL.md` |
| 6 | Поясни, що робить app/api/health/route.ts | не викликає | не викликав (`4f59c05d`) | [#L210](https://github.com/rsukhai/sentari/blob/94eb22358b327a6fdfdf9ab70b8718a429b90ff9/.agent-log/claude-code.jsonl#L210) — жодного `SKILL.md` | не викликав (`01a0dd5e-2945`) | [#L76-L78](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L76-L78) — жодного `SKILL.md` |

Результат: **12 з 12** як очікувалось (Claude Code 6/6, Codex 6/6). Зміни в описі: не знадобились.

## Історія

- Перша спроба для Codex (26.09, 13:17) — 0 з 6: `ERROR: Quota exceeded` на ключі OpenAI, сесії завершувались за ~2 с без жодного виклику. Спроба з локальною моделлю (`--oss`, qwen3.5:4b) за 10+ хв не дійшла до виклику інструмента. Після поповнення балансу тест повторено.
- `codex exec` у неінтерактивному середовищі чекає додаткового вводу зі stdin і зависає — потрібне `< /dev/null`.

## Спостереження

- Жоден інструмент не використав окремий інструмент `Skill`: обидва знаходять навичку за описом і читають `SKILL.md` (Claude Code — `Read`/`cat`, Codex — `cat .agents/skills/add-api-route/SKILL.md`). Тому в журналі шукаємо `SKILL.md`.
- Обидва агенти в запитах 1–3 також прочитали `scripts/check-route.mjs`. Codex бере `SKILL.md` зі своєї копії `.agents/skills/`, але скрипт запускає за шляхом із тексту навички — `.claude/skills/…` ([#L42](https://github.com/rsukhai/sentari/blob/c9e7fb89bc1ba3f3ea964ede31502416153b4cb4/.agent-log/codex.jsonl#L42)); працює, бо обидві копії є в репозиторії.
