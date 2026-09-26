# Вартість контексту — MCP Context7

Сервер: `context7`, віддалений HTTP (`https://mcp.context7.com/mcp`), без ключа.
Підключення: Claude Code — `.mcp.json` у корені + `"enabledMcpjsonServers": ["context7"]`
у `.claude/settings.json`; Codex — `.codex/config.toml` (`[mcp_servers.context7]`).
`claude mcp list` → `context7: https://mcp.context7.com/mcp (HTTP) - ✔ Connected`.

## Метод

Той самий запит («Відповідай одним словом: ок») у нових сесіях `claude -p --output-format json`,
по два прогони на кожен варіант:
- без MCP: `--strict-mcp-config --mcp-config` з порожнім списком серверів;
- лише Context7: `--strict-mcp-config --mcp-config .mcp.json`.

Вхідні токени = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` з поля `usage`.

| Інструмент | Модель | Токенів до | Токенів після | Дельта | Примітка |
|---|---|---|---|---|---|
| Claude Code 2.1.269 | claude-sonnet-5 | 50 655 | 50 984 | +329 | прогін 1 |
| Claude Code 2.1.269 | claude-sonnet-5 | 50 663 | 50 979 | +316 | прогін 2 |
| Codex CLI 0.157.1 | gpt-6-sol | 12 962 | 13 742 | +780 | прогін 1 |
| Codex CLI 0.157.1 | gpt-6-sol | 12 962 | 13 742 | +780 | прогін 2 |

Для Codex: той самий запит у `codex exec --sandbox read-only … < /dev/null`, без MCP — з
`-c 'mcp_servers.context7.enabled=false'`; число — рядок `tokens used` у виводі.
`codex mcp list` → `context7 … enabled`.

Висновок: Context7 додає **~+322 токени** на запит у Claude Code і **+780** у Codex. Відносно
базового контексту це ~0,6% у Claude Code (~50,6 тис.) і ~6% у Codex (~13 тис.): у Codex базовий
контекст менший, тож той самий сервер відчутніший. Базові значення міряно по-різному
(`usage` у Claude Code і `tokens used` у Codex), тож порівнювати варто дельти, а не абсолютні числа.
Детальніше про Claude Code: ~**+322 токени** на кожен запит (~0,6% від базових
~50,6 тис.). Імовірна причина невеликої дельти — Claude Code вантажить у контекст не повні схеми
інструментів MCP, а лише їх короткі описи (не перевіряв окремо). Навіть так це ціна **кожного**
запиту, незалежно від того, чи потрібна документація: сервер варто тримати увімкненим лише там,
де ним реально користуються.
