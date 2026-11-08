# Підключення MCP-сервера

Сервер — `sentari-obd` 1.0.0 ([`mcp-spec.md`](mcp-spec.md)), команда запуску в обох боках однакова: `npx tsx src/mcp/server.ts`. Перед першим запуском у клоні — `npm install` (інакше `npx` піде в мережу по `tsx`) і запущена Ollama з `embeddinggemma-2:270m` (для `search_corpus`; `fetch_chunk` працює й без неї).

## Бік 1 — агент кодування

- Який агент і версія: Claude Code 2.1.269, модель сесії — `sonnet`
- Чому саме він: доступ уже є (ключ API Anthropic власника репозиторію — платний план); ним написано весь код Лаб. 1–2. Codex CLI теж є, але методичка вимагає одного агента.
- Де лежить конфігурація: [`.mcp.json`](../../.mcp.json) у корені (скоуп `project`, комітиться) + `sentari-obd` у `enabledMcpjsonServers` у [`.claude/settings.json`](../../.claude/settings.json), щоб інтерактивна сесія не питала схвалення проєктного сервера.
- Конфігурація дослівно (секретів у ній немає взагалі — сервер їх не потребує; `OLLAMA_URL` — посилання на змінну з типовим значенням):

```json
"sentari-obd": {
  "type": "stdio",
  "command": "npx",
  "args": ["tsx", "src/mcp/server.ts"],
  "env": {
    "MCP_CLIENT_LABEL": "claude-code",
    "OLLAMA_URL": "${OLLAMA_URL:-http://localhost:11434}"
  }
}
```

- Як запускали (неінтерактивно, лише два інструменти поіменно, режим `dontAsk` — усе недозволене відхиляється, а не дозволяється):

```bash
claude -p "Виклич інструмент search_corpus сервера sentari-obd із query \"What happens if the EGR valve is clogged?\" і topK 3. Потім виклич fetch_chunk для id egr#0006. Потім виклич fetch_chunk для id egr#9999 (це навмисна перевірка відмови). Для кожного виклику коротко покажи, що повернулося." \
  --model sonnet --strict-mcp-config --mcp-config .mcp.json --permission-mode dontAsk \
  --allowedTools "mcp__sentari-obd__search_corpus,mcp__sentari-obd__fetch_chunk" \
  --output-format stream-json --verbose
```

- Що викликано (з транскрипту, сесія `4ff09854`, 2026-11-01 19:02 UTC, $0.217):

| Інструмент | Аргументи | Що повернулося |
|---|---|---|
| `mcp__sentari-obd__search_corpus` | `{"query":"What happens if the EGR valve is clogged?","topK":3}` | 3 фрагменти: `egr#0006` (cosine 0.8799), `map-sensor#0005`, `egr#0000` — з цитатами `[id] doc › заголовки · символи start–end` |
| `mcp__sentari-obd__fetch_chunk` | `{"id":"egr#0006"}` | фрагмент `egr#0006` («…the valve can become clogged with carbon deposits…») |
| `mcp__sentari-obd__fetch_chunk` | `{"id":"egr#9999"}` | **відмова**, `is_error: true`: «фрагмента egr#9999 немає в індексі» |

- Машинний доказ підключення: перша подія `system/init` у транскрипті — `"mcp_servers":[{"name":"context7","status":"connected"},{"name":"sentari-obd","status":"connected"}]`, помилок підключення немає.
- Доказ: транскрипт stream-json — [`traces/claude-code-mcp.jsonl`](traces/claude-code-mcp.jsonl) (перевірено: рядків, схожих на ключі API, немає) + три рядки `source=claude-code` у [`traces/mcp-calls.jsonl`](traces/mcp-calls.jsonl).

## Бік 2 — застосунок

- Де код клієнта: [`scripts/mcp-demo.ts`](../../scripts/mcp-demo.ts) — `@modelcontextprotocol/client@2.3.1` (та сама версія, що й сервер), `new Client(…)` + `StdioClientTransport`; оточення серверу — `getDefaultEnvironment()` + `MCP_CLIENT_LABEL`, **не** `...process.env`, щоб серверу не дісталися секрети застосунку; `cwd` — корінь репозиторію.
- Команда запуску: `npx tsx scripts/mcp-demo.ts` (ключів API не потрібно)
- Що викликано (2026-11-01 19:03 UTC): `listTools` (обидва інструменти з описами), `search_corpus` («Can I clean a dirty MAF sensor with brake cleaner?», topK 3 → першим `[maf#0008]`), `fetch_chunk` `maf#0008` → фрагмент, `fetch_chunk` `maf#9999` → **відмова** (`isError: true`, «фрагмента maf#9999 немає в індексі»).
- Доказ: вивід команди — [`traces/app-mcp.txt`](traces/app-mcp.txt), три рядки `source=sentari-app` у `traces/mcp-calls.jsonl`.

Підсумок журналу сервера (`traces/mcp-calls.jsonl`, рядки записав сам сервер під час викликів):

| source | інструмент · результат | рядків |
|---|---|---|
| `claude-code` | `search_corpus` · ok / `fetch_chunk` · ok / `fetch_chunk` · refused | 1 / 1 / 1 |
| `sentari-app` | `search_corpus` · ok / `fetch_chunk` · ok / `fetch_chunk` · refused | 1 / 1 / 1 |
| `unknown` | smoke-тест Inspector, крок 08 (`search_corpus` · ok, `fetch_chunk` · refused) | 2 |

## Що зламалося з першого разу

| Що саме | На якому боці | Причина | Що змінив у сервері чи конфігурації |
|---|---|---|---|
| `source` у журналі сервера — `unknown` | Inspector (крок 08) | Inspector запускає сервер із відфільтрованим оточенням: змінна з шелу не доходить | у сервері — нічого; мітку задано в `env` конфігурації кожного клієнта (`.mcp.json`, `mcp-demo.ts`) |
| smoke-виклик `fetch_chunk` зі шляхом до файлу секретів не запустився | агент, що писав код (Claude Code) | власний guard агента (`scripts/agent-env-guard.mjs`) блокує команду з назвою цього файлу в тексті | нічого — guard працює як задумано; випадок покрито unit-тестом |
| інструменти сервера не були в контексті одразу | Claude Code, `claude -p` | у Claude Code 2.1 інструменти MCP «відкладені»: модель спершу викликала `ToolSearch` (`select:mcp__sentari-obd__search_corpus,…`), щоб завантажити їхні схеми | нічого — це поведінка клієнта; у транскрипті видно першим кроком |
| серверу на старті потрібна Ollama | обидва | `loadIndex` + ембедер запиту | нічого: `fetch_chunk` працює без Ollama; вимога записана вище і в `mcp-spec.md` |

Чесно: у самому сервері після кроку 08 нічого міняти не довелося — шляхи від `import.meta.url` і відсутність `console.log` у дереві імпортів спрацювали з першого підключення з обох боків.

## Чим відрізняються два боки

- Робоча тека й оточення процесу: Claude Code запускає сервер з кореня проєкту зі своїм оточенням і `env` з `.mcp.json`; застосунок — з `cwd: process.cwd()` і мінімальним `getDefaultEnvironment()` + мітка. Сервер від цього не залежить: індекс і журнал шукаються від `import.meta.url`.
- Таймаути клієнта проти таймауту сервера: сервер — 10 с на обробник `search_corpus` (`LIMITS.timeoutMs`); SDK-клієнт — `DEFAULT_REQUEST_TIMEOUT_MSEC = 6e4` (60 с, з `@modelcontextprotocol/client` 2.3.1); Codex CLI — `tool_timeout_sec` 60 (типово, за методичкою; не підключався); таймаут Claude Code для інструментів MCP — не перевіряв. Серверний таймаут менший за обидва відомі клієнтські, тож зависання ембедера користувач побачить як відмову сервера з причиною, а не як помилку клієнта.
- Як бачить відмову кожен бік: агент — `tool_result` з `is_error: true` і текстом причини (модель прочитала й переказала її); застосунок — `result.isError === true`, `await callTool` при цьому завершується успішно.
- Що з цього зафіксовано в `mcp-spec.md` як вимогу: шляхи від файлу сервера, а не від cwd; секретів сервер не потребує; мітка джерела — в конфігурації клієнта, а не в оточенні шелу.

## Секрети

- Жодного значення ключа в закомічених конфігураціях: `.mcp.json` містить лише `MCP_CLIENT_LABEL` і `${OLLAMA_URL:-http://localhost:11434}`; транскрипт `claude-code-mcp.jsonl` перевірено пошуком рядків вигляду `sk-…` — 0 збігів.
- Де насправді лежать ключі: файл оточення поза git (у репозиторії — `.env.example` без значень); MCP-серверу ключі не потрібні взагалі, клієнту-застосунку — теж.
