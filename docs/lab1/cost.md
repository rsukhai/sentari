# Вартість викликів — Лабораторна 1

Ollama: `ollama version is 0.34.4` · дата вимірів: 2026-09-26

Звірка цін `src/models.ts` зі сторінками вендорів (2026-09-26): **усі рядки збігаються** —
Anthropic (Haiku 4.5 $1/$5, Sonnet 5 $2/$10 — вступна ціна тепер стандартна, Opus 5 $5/$25,
Fable 5.1 $10/$50), OpenAI (gpt-5.6-luna $0.20/$1.20, terra $2/$12, sol $4/$20, gpt-6-astra $10/$50),
Google (gemini-3.8-flash $0.75/$3.75 до 2026-12-31, далі $1.50/$7.50; gemini-3.5-flash-lite $0.30/$2.50).
`models.ts` і `models.test.ts` не змінювались.

## 1. Звірка оцінки вхідних токенів (хмарна модель, критерій ≤ 10%)

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gemini-1 | google | gemini-3.8-flash | 14208 | 0 | 312 | 14208 | 0.0 | 0.000000 | 0.011826 | 4039 | 2026-09-26 |
| gemini-2 | google | gemini-3.8-flash | 14208 | 0 | 868 | 14208 | 0.0 | 0.000000 | 0.013911 | 5901 | 2026-09-26 |

Команда: npx tsx --env-file=.env.local scripts/measure-cost.ts gemini (запускав власник репозиторію — ключ у `.env.local`)
Чим оцінено до виклику: Gemini countTokens (REST, generateContentRequest) · факт: usageMetadata.promptTokenCount

Вердикт: **у межах 10%** — похибка 0.0% в обох викликах. Вихід 312 = 83 (`candidatesTokenCount`) + 229 (`thoughtsTokenCount`): роздуми моделі тарифікуються як вихід, і без `fromGeminiUsage` вихід був би занижений майже вчетверо.
Сирий usageMetadata першого виклику: `{"promptTokenCount":14208,"candidatesTokenCount":83,"totalTokenCount":14520,"promptTokensDetails":[{"modality":"TEXT","tokenCount":14208}],"thoughtsTokenCount":229,"serviceTier":"standard"}`

## 2. Кешування

Префікс: scripts/doctor.ts + scripts/sync-skills.ts + src/models.ts (для Ollama — перші 6000 символів).

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ollama-1 | ollama | qwen3:4b | 2012 | 0 | 64 | — | — | 0.000000 | 0.000000 | 5604 | 2026-09-26 |
| ollama-2 | ollama | qwen3:4b | 2012 | 2011 | 64 | — | — | 0.000000 | 0.000000 | 1000 | 2026-09-26 |

Назва поля кешу: `cache_read_input_tokens` (Ollama `/v1/messages`) · сирий usage другого виклику: `{"input_tokens":1,"cache_read_input_tokens":2011,"output_tokens":64}`
Для Ollama: це повторне використання префікса моделі, а не знижка в рахунку. Затримка другого виклику впала з 5,6 с до 1,0 с.

Gemini (free tier): у двох однакових викликах `cachedContentTokenCount` відсутній (0) при префіксі 14 208 токенів (≥ 4096), третій виклик завершився `HTTP 503 — model is currently experiencing high demand`. Неявний кеш Gemini не гарантований; доказ кешу — Ollama вище.

Команда: `OLLAMA_MODEL=qwen3:4b npx tsx scripts/measure-cost.ts ollama` (модель передано змінною середовища, бо агент не читає `.env.local`).

## 3. Множник «українська / англійська»

| Провайдер | Модель | Текст (про що, скільки слів) | Токени en | Токени ua | ua / en |
|---|---|---|---|---|---|
| google | gemini-3.8-flash | правила проєкту з AGENTS.md, 3 абзаци (ua 171 / en 203 слова) | 244 | 331 | 1.36 |
| ollama | qwen3:4b | правила проєкту з AGENTS.md, 3 абзаци (ua 171 / en 203 слова) | 238 | 509 | 2.14 |

Команда: npx tsx --env-file=.env.local scripts/measure-cost.ts lang docs/lab1/cost.md
Тексти, на яких виміряно множник (скрипт читає саме ці два блоки):

```ua
Це проєкт, який читає логи автомобіля, що передаються через OBD, і згодом аналізує їх, щоб надати рекомендації водієві. Він написаний на TypeScript у суворому режимі, на Next.js з App Router, а тести запускаються у Vitest. Перш ніж сказати, що задачу виконано, агент мусить прогнати перевірку типів, лінтер і тести, і всі три мають бути зеленими.

Файли з секретами агент не читає і не редагує: ключі веде людина. Тести не ходять у мережу і не викликають платні сервіси. Lock-файл не редагують вручну — лише через встановлення залежностей. У журнал дій агента можна тільки дописувати нові записи, старі не можна ні змінювати, ні видаляти.

Відправлення змін у віддалений репозиторій, зміна залежностей і видалення файлів чи даних можливі лише після дозволу власника. Якщо витрати перевищують ліміт, агент зупиняється і питає, чи можна продовжити. Модель обирають за роллю з реєстру моделей, а не рядком з назвою, а ціни й дати зняття моделей звіряють зі сторінкою вендора, а не з пам'яті. Логіку розбору логів тримають окремо від компонентів інтерфейсу, а коміти пишуть у форматі Conventional Commits.
```

```en
This project reads car logs transmitted over OBD and later analyses them to give recommendations to the driver. It is written in TypeScript in strict mode, on Next.js with the App Router, and the tests run in Vitest. Before saying a task is done, the agent must run the type check, the linter and the tests, and all three must be green.

The agent does not read or edit files with secrets: keys are managed by a human. Tests do not go to the network and do not call paid services. The lock file is never edited by hand — only by installing dependencies. The agent's action log may only be appended to; old entries may be neither changed nor deleted.

Pushing changes to the remote repository, changing dependencies and deleting files or data are allowed only with the owner's permission. If spending exceeds the limit, the agent stops and asks whether it may continue. The model is chosen by its role from the model registry, not by a name string, and prices and model retirement dates are checked against the vendor's page, not from memory. Log-parsing logic is kept separate from UI components, and commits are written in the Conventional Commits format.
```

Висновок: той самий зміст українською дорожчий в 1.36 раза в Gemini і в 2.14 раза в локальній qwen3:4b — множник залежить від токенізатора. Для правил, навичок і промптів, які йдуть у контекст **кожного** запиту, це прямі гроші й місце у вікні контексту.

## 4. Три прогони (крок 11)

Той самий вхід для всіх: `scripts/measure-loop.ts` — промпт, задача `/api/health` і інструменти `list_files`/`read_file` однакові. Колонки — ті самі 12 (форму API, зупинку, кроки й session скрипт друкує окремо).

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| хмарний провайдер | openai | gpt-5.6-luna | 5438 | 1035 | 283 | — | — | 0.001427 | 0.001427 | 9819 | 2026-09-27 |
| шлюз | — | — | — | — | — | — | — | — | — | — | не виміряно |
| локальна модель | Ollama | qwen3:4b | 2201 | 916 | 8704 | — | — | 0 | 0 | 140750 | 2026-09-27 |

Обидва прогони — на `main` (той самий стан репозиторію, маршрут `/api/health` уже реалізовано), той самий промпт і інструменти:
- хмара: `npx tsx --env-file=.env.local scripts/measure-loop.ts openai 1` (запускав власник, ключ OpenAI) — Chat Completions, 6 кроків, session `agent-loop-openai-2026-09-27T10-32-02-042Z`. Модель прочитала код і правильно відповіла, що ендпоінт уже реалізовано; запропонований `route.ts` дослівно збігається з наявним;
- локально: `OLLAMA_MODEL=qwen3:4b npx tsx scripts/measure-loop.ts ollama-messages 1` — Messages, 3 кроки, session `agent-loop-ollama-messages-2026-09-27T10-32-51-471Z`.

**Шлюз не виміряно — рішення власника репозиторію**: реєструвати сторонній шлюз (OpenRouter) не став; Vercel AI Gateway вимагає прив'язки картки; кафедрального ключа шлюзу (`AI_GATEWAY_API_KEY` у `.env.example`) немає. Режим `openrouter` у `scripts/measure-loop.ts` готовий — за наявності ключа це один запуск.

Порівняння двох виміряних: хмара швидша в 14 разів (9,8 проти 140,8 с) і дешевша за токенами виходу (283 проти 8704 — локальна модель витрачає тисячі токенів на «роздуми»), але коштує грошей ($0.0014 за задачу); локальна — $0 і дані не залишають ноутбук.

Хмарний провайдер — OpenAI, а не Gemini: денна квота Gemini free tier (20 запитів) вичерпана прогонами кроків 08–10 (див. `comparison.md`). OpenAI платний, тому «$ фактично» = «$ за прайсом».
