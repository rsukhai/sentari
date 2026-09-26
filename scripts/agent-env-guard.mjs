// PreToolUse-заборона для Codex: блокує запис у .env / .env.local.
// Перевіряє file_path/path напряму (звичайні write-подібні виклики),
// текст патча apply_patch і команду exec_command на згадку .env-шляху.
//
// ВІДОМЕ ОБМЕЖЕННЯ: у Codex CLI є задокументований баг (openai/codex#27833) —
// "deny" з PreToolUse не завжди реально блокує apply_patch: hook спрацьовує,
// але запис усе одно проходить. Це не гарантія, а додатковий рубіж захисту.
import { readFileSync } from 'node:fs';

const event = JSON.parse(readFileSync(0, 'utf8'));
const args = event.tool_input ?? {};

const isEnvPath = (p) => typeof p === 'string' && /(^|\/)\.env(\.local)?$/.test(p);

let hit = isEnvPath(args.file_path) || isEnvPath(args.path);

if (!hit && event.tool_name === 'apply_patch') {
  const patch = Array.isArray(args.command) ? args.command.join('\n') : String(args.command ?? '');
  hit = /\.env(\.local)?\b/.test(patch);
}

if (!hit && (event.tool_name === 'exec_command' || event.tool_name === 'Bash')) {
  const cmd = Array.isArray(args.cmd) ? args.cmd.join(' ') : String(args.cmd ?? args.command ?? '');
  hit = /\.env(\.local)?\b/.test(cmd);
}

if (hit) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Політика курсу: .env і .env.local редагує людина, не агент.',
    },
  }));
  process.exit(2);
}
process.exit(0);
