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
| gemini-1 | google | gemini-3.8-flash | … | … | … | … | … | 0.000000 | … | … | … |

Команда: npx tsx --env-file=.env.local scripts/measure-cost.ts gemini
Чим оцінено до виклику: Gemini countTokens (REST, generateContentRequest) · факт: usageMetadata.promptTokenCount

## 2. Кешування

Префікс: scripts/doctor.ts + scripts/sync-skills.ts + src/models.ts (для Ollama — перші 6000 символів).

| прогін | провайдер | модель | вхідні | кешовані | вихідні | оцінка входу до виклику | похибка % | $ фактично | $ за прайсом models.ts | затримка, мс | дата |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ollama-1 | ollama | qwen3:4b | 2012 | 0 | 64 | — | — | 0.000000 | 0.000000 | 5604 | 2026-09-26 |
| ollama-2 | ollama | qwen3:4b | 2012 | 2011 | 64 | — | — | 0.000000 | 0.000000 | 1000 | 2026-09-26 |

Назва поля кешу: `cache_read_input_tokens` (Ollama `/v1/messages`) · сирий usage другого виклику: `{"input_tokens":1,"cache_read_input_tokens":2011,"output_tokens":64}`
Для Ollama: це повторне використання префікса моделі, а не знижка в рахунку. Затримка другого виклику впала з 5,6 с до 1,0 с.

Команда: `OLLAMA_MODEL=qwen3:4b npx tsx scripts/measure-cost.ts ollama` (модель передано змінною середовища, бо агент не читає `.env.local`).

## 3. Множник «українська / англійська»

| Провайдер | Модель | Текст (про що, скільки слів) | Токени en | Токени ua | ua / en |
|---|---|---|---|---|---|
| google | gemini-3.8-flash | … | … | … | … |
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

## 4. Три прогони (крок 11)
