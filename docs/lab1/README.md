# Лабораторна 1 — пакет доказів

> Повний індекс доказів заповнюється на кроці 11. Нижче — те, що має зберегтися вже зараз, бо безкоштовні плани зберігають дані недовго (Langfuse Hobby — 30 днів, логи Vercel Hobby — 1 година).

## Деплой із трасами (крок 10)

- Ендпоінт: `POST https://sentari-flax.vercel.app/api/agent` (Vercel Hobby, коміт `547e7353`).
- Модель: `gemini-3.8-flash` (Gemini API free tier), інструмент `getTime`, ліміт `isStepCount(3)`.
- Трасування: Langfuse Cloud через OpenTelemetry (`instrumentation.node.ts`, `src/otel/langfuse.ts`), `telemetry.functionId: 'lab01-agent'`.

Команда виклику (Git Bash / zsh):

```bash
URL='https://sentari-flax.vercel.app/api/agent'
for p in 'Котра зараз година?' 'Скільки хвилин лишилось до півночі?' 'Привітайся одним реченням'; do
  printf '{"prompt":"%s"}' "$p" | curl -s -X POST "$URL" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-; echo
done
```

### Траси (скріншоти — `traces/`)

| Траса | Час (Kyiv) | Інструмент | Токени | Вартість у Langfuse | Звірка з `src/models.ts` |
|---|---|---|---|---|---|
| [`trace-1-gettime.png`](traces/trace-1-gettime.png) — «Котра зараз година?» | 2026-09-27 13:17:11 | `getTime` викликано | 109 (крок 1) | $0.000259 | — |
| [`trace-2-greeting.png`](traces/trace-2-greeting.png) — «Привітайся одним реченням» | 2026-09-27 13:18:02 | — | 270 (52 вх. / 218 вих., з них 206 роздумів) | $0.000857 | 52 × $0.75/1M + 218 × $3.75/1M = $0.0008565 ✅ |
| 3-тя траса | — | — | — | — | **відкрито**: денна квота Gemini free tier (20 запитів) вичерпана; повторити після відновлення |

Список трас: [`traces-list.png`](traces/traces-list.png) — видно й невдалі запити (`429` квоти, порожній ключ до виправлення змінної на Vercel).

Фактичний рахунок — $0 (безкоштовний рівень); Langfuse показує вартість за прайсом, і вона збігається з колонкою «$ за прайсом» у [`cost.md`](cost.md).

## Посилання на прогони CI

- Крок 06 (e2e, скріншот): https://github.com/rsukhai/sentari/actions/runs/36238213904
- Крок 09 (тест підтвердження `write_file`): https://github.com/rsukhai/sentari/actions/runs/36309592250
- Крок 10 (код трасування): https://github.com/rsukhai/sentari/actions/runs/36309974508
