// PreToolUse-заборона для Claude Code і Codex: агент не читає й не змінює .env / .env.local.
// Виклик: node scripts/agent-env-guard.mjs <source>   (source: claude-code | codex)
//
// Перевіряє шлях (file_path, path, filePath), шаблон пошуку (pattern) і текст
// команди (command/cmd: Bash, exec_command, apply_patch). На збіг — пише в журнал
// .agent-log/<source>.jsonl рядок з "result":"denied" і повертає рішення deny.
// .env.example — шаблон без секретів, його дозволено.
//
// ВІДОМЕ ОБМЕЖЕННЯ: у Codex CLI задокументовано баг (openai/codex#27833) — "deny"
// не завжди блокує apply_patch. Це додатковий рубіж, а не гарантія.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = process.argv[2] ?? 'unknown';
const event = JSON.parse(readFileSync(0, 'utf8'));
const tool = event.tool_name ?? event.toolName ?? 'unknown';
let args = event.tool_input ?? event.toolArgs ?? {};
if (typeof args === 'string') {
  try {
    args = JSON.parse(args);
  } catch {
    args = { command: args };
  }
}

// Ім'я файлу .env або .env.<щось>, крім .env.example. Межі збігу — початок рядка,
// пробіл, лапки, слеш, редирект тощо, тож `process.env.X` у коді не спрацьовує.
const ENV_FILE = /(?:^|[\s'"`/\\=<>(:;|&])\.env(?!\.example\b)(?:\.[\w-]+)?(?=$|[\s'"`\\);|&>,])/;

const asText = (v) => (Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : '');
const fields = {
  path: asText(args.file_path ?? args.filePath ?? args.path),
  pattern: asText(args.pattern),
  command: asText(args.command ?? args.cmd),
};

const hit = Object.values(fields).some((v) => v !== '' && ENV_FILE.test(v));
if (!hit) process.exit(0);

// Журнал — у форматі курсу: лише шлях, шаблон чи команда, до 200 символів.
const input = {};
if (fields.path) input.file_path = fields.path.slice(0, 200);
if (fields.pattern) input.pattern = fields.pattern.slice(0, 200);
if (fields.command) input.command = fields.command.slice(0, 200);
const dir = join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.agent-log');
mkdirSync(dir, { recursive: true });
const row = {
  ts: new Date().toISOString(),
  tool,
  input,
  result: 'denied',
  session: event.session_id ?? event.sessionId ?? 'unknown',
  source,
};
appendFileSync(join(dir, `${source}.jsonl`), `${JSON.stringify(row)}\n`);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Політика курсу: .env і .env.local читає й редагує людина, не агент.',
    },
  }),
);
process.exit(0);
