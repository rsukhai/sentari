# Тест «видали 40%» — AGENTS.md

- Рядків до тесту: 58, з них правил (`- `): 25; видалено правил: 9 (36%).
- Що видалено: [a9145eca](https://github.com/rsukhai/sentari/commit/a9145eca) (7 правил; повідомлення коміту помилково каже «10») і [d29e2943](https://github.com/rsukhai/sentari/commit/d29e2943) (ще 2) у `lab1/agents-md-40-cut`.
- Контрольна задача (запит дослівно): «Додай функцію formatDuration(ms) у src/ з тестом у tests/, повідом, коли готово.»
- Інструмент, модель, режим: Codex CLI 0.157.1, gpt-6-sol, однаковий режим в усіх прогонах.
- Журнал, повний файл (сесія `01a0dd1e`): [codex.jsonl#L34-L43](https://github.com/rsukhai/sentari/blob/cb5e2db7df0f92024232654d6f6989e00b66d850/.agent-log/codex.jsonl#L34-L43) на гілці `lab1/agents-md-40-full`.
- Журнал, скорочений файл: сесії `01a0dd23` і `01a0dd25` — [codex.jsonl#L39-L56](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L39-L56) на гілці `lab1/agents-md-40-cut`.

## Що сталося в прогонах

| Прогін | Сесія | Прочитав AGENTS.md | Що зробив | Перевірки перед «готово» |
|---|---|---|---|---|
| Повний файл | `01a0dd1e` | так, [#L36](https://github.com/rsukhai/sentari/blob/cb5e2db7df0f92024232654d6f6989e00b66d850/.agent-log/codex.jsonl#L36) | Створив `src/formatDuration.ts` і тест; у пошуку сам виключив `.env*` | `npm run typecheck && npm run lint && npm test` одним викликом, [#L42](https://github.com/rsukhai/sentari/blob/cb5e2db7df0f92024232654d6f6989e00b66d850/.agent-log/codex.jsonl#L42) |
| Скорочений, спроба 1 | `01a0dd1e` (та сама!) | ні | Відтворив той самий код із пам'яті сесії | — |
| Скорочений, спроба 2 | `01a0dd23` | так, [#L41](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L41) | Знайшов готові файли від спроби 1, лише перевірив | `npm test`, `typecheck`, `lint` окремо, [#L44](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L44)–[#L46](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L46) |
| Скорочений, спроба 3 | `01a0dd25` | так, [#L50](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L50) | Те саме; у пошуку сам виключив `.env`, `.env.local` | `npm test`, `typecheck`, `lint`, [#L54](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L54)–[#L56](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L56) |

**Спроба 1 не зарахована**: я дав той самий запит у тій самій сесії Codex, тож агент не читав скорочений файл і пам'ятав повний. Коміт [64606b49](https://github.com/rsukhai/sentari/commit/64606b49) лишено в історії як запис помилки.

**Обмеження спроб 2 і 3**: файли від спроби 1 лишились у гілці, тож агент не писав код з нуля. Тест показує, що агент **перевіряє**, але не показує, що він **пише** без видалених правил.

## Видалені правила

| Видалений рядок | Що змінилося в поведінці | Доказ (рядок журналу) | Рішення |
|---|---|---|---|
| «Без БД» | нічого — задача не стосується даних | — | видалити назавжди (є в `package.json`) |
| «Стилі — css('app/globals.css')» | нічого — задача без UI | — | видалити назавжди (видно з коду) |
| «Моделі — 'src/models.ts'» | нічого | — | видалити назавжди (дублює правило в «Домовленостях») |
| «Перед "готово": typecheck && lint && test» | нічого: перевірки все одно запущені, бо лишилось правило «Готово = зелені typecheck, lint, test» | [#L44](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L44)–[#L46](https://github.com/rsukhai/sentari/blob/0ccc0ea663c2edb4e37af501e02785e60e4fc1e0/.agent-log/codex.jsonl#L46) | видалити назавжди (дублікат) |
| «git push тільки після мого дозволу» | нічого — агент не пушив у жодному прогоні | — | відновити: задача не перевірила це правило, а межа безпечності |
| «зміна в package.json тільки після мого дозволу» | нічого — задачі не потрібні залежності | — | відновити: те саме |
| «видалення файлів або даних тільки після мого дозволу» | нічого — агент нічого не видаляв | — | відновити: те саме |
| «витрати понад ліміт — зупинися і запитай» | нічого — прогони дешеві | — | відновити: знадобиться на кроках 07–08 |
| «Ціни й дати зняття моделей звіряються зі сторінкою вендора» | нічого — задача не стосується моделей | — | відновити: знадобиться на кроці 07 |

Підсумок: 5 правил відновлено, 4 видалено назавжди ([dfcf6113](https://github.com/rsukhai/sentari/commit/dfcf6113)); `AGENTS.md` після тесту — 56 рядків, 21 правило.

## Висновок

Тест чесно показав межу методу: одна контрольна задача перевіряє лише ті
правила, які вона зачіпає. Правила про стек і дубльоване «Перед готово» не
вплинули на поведінку — їх видаляю. Межі безпечності (`git push`,
`package.json`, видалення, витрати) задача не зачепила взагалі, тож «нічого не
змінилось» тут не доводить, що вони зайві — лишаю їх свідомо.
