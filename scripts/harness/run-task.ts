/**
 * Виконавець фабрики задач (Лаб. 3, крок 00).
 * Один виклик = одна задача = один артефакт (patch.diff, output.txt, agent.log, journal.jsonl) + один журнал run.json.
 * Виконавець не має власного інтелекту: він запускає агента в готовому робочому дереві, забирає артефакт
 * і ЗАВЖДИ пише журнал. Дерево, чергу й git готує run-queue.ts.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Task {
  readonly id: string;
  readonly input: string;
  /** Команди, які мають завершитися кодом 0 після роботи агента. Побажань тут бути не може. */
  readonly acceptance: readonly string[];
  readonly budget: { readonly max_turns: number; readonly max_usd: number; readonly timeout_s: number };
  readonly files?: readonly string[];
  /** Семантичні критерії приймання для верифікатора (крок 02): по одному запиту судді на критерій. Команди з acceptance їх не замінюють. */
  readonly criteria?: readonly { readonly id: string; readonly statement: string }[];
  /** Файли, початок яких верифікатор бачить як довідку (щоб звіряти твердження в diff з реальністю). */
  readonly context?: readonly string[];
}

export interface AgentResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** true, якщо процес убив таймаут, а не агент завершився сам */
  readonly timedOut?: boolean;
}

/** Запуск агента. У тестах підмінюється підставним — тому тести не ходять у мережу. */
export type AgentRunner = (task: Task, cwd: string) => AgentResult;

export type ExitStatus = 'ok' | 'agent_failed' | 'timeout' | 'budget_or_turns';

export interface AcceptanceResult {
  readonly cmd: string;
  readonly exit: number;
}

export interface RunRecord {
  readonly task_id: string;
  readonly agent_path: string;
  readonly artifact_dir: string;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_s: number;
  readonly exit_status: ExitStatus;
  readonly exit_code: number;
  readonly acceptance: readonly AcceptanceResult[];
  readonly acceptance_passed: boolean;
  readonly session_id: string | null;
  /** usage.input_tokens з agent.json — без кешу; кеш — у двох полях нижче */
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cache_creation_input_tokens: number | null;
  readonly cache_read_input_tokens: number | null;
  /** total_cost_usd з agent.json — КЛІЄНТСЬКА ОЦІНКА, не рахунок */
  readonly cost_usd_estimate: number | null;
  readonly num_turns: number | null;
  /** subtype з agent.json: success | error_max_budget_usd | … */
  readonly agent_subtype: string | null;
  /** terminal_reason з agent.json: completed | budget_exhausted | … */
  readonly terminal_reason: string | null;
  readonly trace_id: string | null; // крок 06
  readonly gates: Record<string, 'pass' | 'fail' | 'skipped'>; // крок 01
}

// ---- Виклик агента -----------------------------------------------------------------------

/** Спільна обвʼязка процесу: таймаут задачі тримає сам процес. */
function spawnAgent(bin: string, args: readonly string[], cwd: string, timeoutS: number): AgentResult {
  const r = spawnSync(bin, [...args], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutS * 1000,
    // SIGINT дає агентові завершити хід (SIGTERM лишає Claude Code з кодом 143 без результату)
    killSignal: 'SIGINT',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return {
    exitCode: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    timedOut: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT',
  };
}

/**
 * Інструменти, які дозволено автономному прогону поіменно. Режим dontAsk відхиляє все, чого тут немає;
 * обходу дозволів (bypassPermissions / --dangerously-skip-permissions) у харнесі немає.
 */
export const ALLOWED_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'Edit',
  'Write',
  'Bash(npm test *)',
  'Bash(npm run typecheck *)',
  'Bash(npm run lint *)',
  'Bash(npx vitest *)',
  'Bash(npx tsx *)',
  'Bash(git diff *)',
  'Bash(git status *)',
] as const;

/** Прапорці Claude Code -p — рівно ті, що перевірено на `claude` 2.1.269 (див. docs/lab3/factory.md). */
export function claudeArgs(task: Task, model: string): string[] {
  return [
    '-p', task.input,
    '--output-format', 'json',
    '--model', model,
    '--allowedTools', ALLOWED_TOOLS.join(','),
    '--permission-mode', 'dontAsk',
    '--max-turns', String(task.budget.max_turns),
    '--max-budget-usd', String(task.budget.max_usd),
    // жодних MCP-серверів: сервер колекції потребує Ollama, а context7 — мережі; харнесу вони не потрібні
    '--strict-mcp-config',
  ];
}

export const HARNESS_MODEL = process.env.HARNESS_MODEL ?? 'sonnet';

/** Шлях агента: Claude Code у режимі -p. */
export const claudeRunner: AgentRunner = (task, cwd) =>
  spawnAgent('claude', claudeArgs(task, HARNESS_MODEL), cwd, task.budget.timeout_s);

// ---- Розбір виводу -----------------------------------------------------------------------

export interface Meta {
  readonly session_id: string | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cache_creation_input_tokens: number | null;
  readonly cache_read_input_tokens: number | null;
  readonly cost_usd_estimate: number | null;
  readonly num_turns: number | null;
  readonly agent_subtype: string | null;
  readonly terminal_reason: string | null;
  readonly is_error: boolean | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const EMPTY_META: Meta = {
  session_id: null,
  input_tokens: null,
  output_tokens: null,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  cost_usd_estimate: null,
  num_turns: null,
  agent_subtype: null,
  terminal_reason: null,
  is_error: null,
};

/**
 * Поля зчитано з реального `claude -p --output-format json` (2.1.269): session_id, total_cost_usd,
 * num_turns, subtype, terminal_reason, is_error, usage.{input_tokens, output_tokens,
 * cache_creation_input_tokens, cache_read_input_tokens}. Не JSON — усе null, прогін від цього не падає.
 */
export function readMeta(stdout: string): Meta {
  try {
    const j = JSON.parse(stdout) as Record<string, unknown>;
    const usage = (typeof j.usage === 'object' && j.usage !== null ? j.usage : {}) as Record<string, unknown>;
    return {
      session_id: str(j.session_id),
      input_tokens: num(usage.input_tokens),
      output_tokens: num(usage.output_tokens),
      cache_creation_input_tokens: num(usage.cache_creation_input_tokens),
      cache_read_input_tokens: num(usage.cache_read_input_tokens),
      cost_usd_estimate: num(j.total_cost_usd),
      num_turns: num(j.num_turns),
      agent_subtype: str(j.subtype),
      terminal_reason: str(j.terminal_reason),
      is_error: typeof j.is_error === 'boolean' ? j.is_error : null,
    };
  } catch {
    return EMPTY_META;
  }
}

/**
 * Ненульовий код виходу ще не означає падіння: вичерпаний бюджет теж дає exit 1.
 * Спостережено: бюджет — subtype "error_max_budget_usd" + terminal_reason "budget_exhausted".
 * Ліміт ходів за SDK — subtype "error_max_turns": спостерігався на кроці 03 (docs/lab3/stop.md): код виходу 1, num_turns = max_turns + 1.
 */
export function classify(res: AgentResult, meta: Meta): ExitStatus {
  if (res.timedOut === true) return 'timeout';
  if (meta.agent_subtype?.startsWith('error_max') === true || meta.terminal_reason === 'budget_exhausted') {
    return 'budget_or_turns';
  }
  if (res.exitCode === 0 && meta.is_error !== true) return 'ok';
  return 'agent_failed';
}

// ---- Приймання і артефакт ----------------------------------------------------------------

/** Критерії приймання — це КОМАНДИ. Виконуємо їх у дереві прогону. */
export function checkAcceptance(task: Task, cwd: string): AcceptanceResult[] {
  return task.acceptance.map((cmd) => {
    const r = spawnSync(cmd, { cwd, encoding: 'utf8', shell: true, timeout: task.budget.timeout_s * 1000 });
    return { cmd, exit: r.status ?? 1 };
  });
}

/** Те, що не належить до роботи агента: його журнал дій і symlink на node_modules. */
export const NOT_PART_OF_PATCH = [':(exclude).agent-log', ':(exclude)node_modules'] as const;

function collectPatch(worktree: string): string {
  try {
    // спершу add -A: `git diff` без індексу НЕ показує нових файлів, а «дописати тест» саме новий файл і створює
    execFileSync('git', ['add', '-A', '--', '.', ...NOT_PART_OF_PATCH], { cwd: worktree, stdio: 'ignore' });
    return execFileSync('git', ['diff', '--cached', '--', '.', ...NOT_PART_OF_PATCH], { cwd: worktree, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

/** Рядки журналу дій, які агент дописав у робочому дереві (hook PostToolUse пише туди). */
function collectJournal(worktree: string): string {
  try {
    const diff = execFileSync('git', ['diff', '-U0', '--', '.agent-log'], { cwd: worktree, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return diff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
      .join('\n');
  } catch {
    return '';
  }
}

export interface RunOptions {
  readonly runner: AgentRunner;
  readonly agentPath: string;
  readonly worktree: string;
  readonly outDir: string;
  readonly check?: typeof checkAcceptance;
  /** Для тестів: підміна годинника. */
  readonly now?: () => Date;
}

export function runTask(task: Task, opts: RunOptions): RunRecord {
  const now = opts.now ?? (() => new Date());
  const started = now();
  const dir = join(opts.outDir, `${task.id}-${started.getTime()}`);
  mkdirSync(dir, { recursive: true });

  // runner не має права «вбити» журнал: будь-який виняток всередині — теж результат прогону
  let res: AgentResult;
  try {
    res = opts.runner(task, opts.worktree);
  } catch (error) {
    res = { exitCode: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }

  writeFileSync(join(dir, 'patch.diff'), collectPatch(opts.worktree), 'utf8');
  writeFileSync(join(dir, 'output.txt'), res.stdout, 'utf8');
  writeFileSync(join(dir, 'agent.log'), res.stderr, 'utf8');
  writeFileSync(join(dir, 'journal.jsonl'), collectJournal(opts.worktree), 'utf8');

  let acceptance: AcceptanceResult[];
  try {
    acceptance = [...(opts.check ?? checkAcceptance)(task, opts.worktree)];
  } catch {
    acceptance = task.acceptance.map((cmd) => ({ cmd, exit: 1 }));
  }

  const ended = now();
  const meta = readMeta(res.stdout);
  const { is_error: _isError, ...metaFields } = meta;
  const record: RunRecord = {
    task_id: task.id,
    agent_path: opts.agentPath,
    artifact_dir: dir, // звʼязок журналу з артефактом
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_s: Math.round((ended.getTime() - started.getTime()) / 100) / 10,
    exit_status: classify(res, meta),
    exit_code: res.exitCode,
    acceptance,
    acceptance_passed: acceptance.length > 0 && acceptance.every((a) => a.exit === 0),
    ...metaFields,
    trace_id: null, // крок 06
    gates: {}, // крок 01
  };
  writeFileSync(join(dir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}
