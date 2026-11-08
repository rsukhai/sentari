import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALLOWED_TOOLS, claudeArgs, classify, readMeta, runTask, type AgentRunner, type Task } from '../../scripts/harness/run-task';
import { readTasks } from '../../scripts/harness/run-queue';

const task: Task = {
  id: 't-01',
  input: 'нічого не робити',
  acceptance: ['npm run typecheck'],
  budget: { max_turns: 2, max_usd: 0.1, timeout_s: 30 },
};

const fake =
  (exitCode: number, stdout = '', stderr = '', timedOut = false): AgentRunner =>
  () => ({ exitCode, stdout, stderr, timedOut });
const tmp = () => mkdtempSync(join(tmpdir(), 'harness-'));
const pass = () => [{ cmd: 'npm run typecheck', exit: 0 }];
const opts = (runner: AgentRunner) => ({ runner, agentPath: 'fake', worktree: tmp(), outDir: tmp(), check: pass });

/** Дослівна форма успішного agent.json (claude 2.1.269), скорочена до потрібних полів. */
const SUCCESS = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  terminal_reason: 'completed',
  num_turns: 3,
  session_id: 'abc',
  total_cost_usd: 0.0207218,
  usage: { input_tokens: 10, output_tokens: 103, cache_creation_input_tokens: 8208, cache_read_input_tokens: 28388 },
});
/** Дослівна форма вичерпаного бюджету (спостережено: exit 1). */
const BUDGET = JSON.stringify({
  type: 'result',
  subtype: 'error_max_budget_usd',
  is_error: true,
  terminal_reason: 'budget_exhausted',
  num_turns: 1,
  session_id: 'def',
  total_cost_usd: 0.055,
  usage: { input_tokens: 0, output_tokens: 0 },
});

describe('runTask: журнал пишеться завжди', () => {
  it('успішний прогін: чотири файли артефакту й run.json, привʼязаний до своєї теки', () => {
    const rec = runTask(task, opts(fake(0, SUCCESS)));
    expect(rec.exit_status).toBe('ok');
    expect(rec.session_id).toBe('abc');
    expect(rec.cost_usd_estimate).toBe(0.0207218);
    expect(rec.input_tokens).toBe(10);
    expect(rec.cache_read_input_tokens).toBe(28388);
    expect(rec.acceptance_passed).toBe(true);
    expect(readdirSync(rec.artifact_dir).sort()).toEqual(['agent.log', 'journal.jsonl', 'output.txt', 'patch.diff', 'run.json']);
    const onDisk = JSON.parse(readFileSync(join(rec.artifact_dir, 'run.json'), 'utf8')) as { task_id: string; artifact_dir: string };
    expect(onDisk.task_id).toBe('t-01');
    expect(onDisk.artifact_dir).toBe(rec.artifact_dir); // журнал вказує на свою ж теку
  });

  it('агент упав: журнал і stderr збережено', () => {
    const rec = runTask(task, opts(fake(1, '', 'boom')));
    expect(rec.exit_status).toBe('agent_failed');
    expect(rec.exit_code).toBe(1);
    expect(readFileSync(join(rec.artifact_dir, 'agent.log'), 'utf8')).toContain('boom');
    expect(readFileSync(join(rec.artifact_dir, 'run.json'), 'utf8')).toContain('"task_id": "t-01"');
  });

  it('агент кинув виняток: журнал усе одно написано', () => {
    const rec = runTask(task, opts(() => { throw new Error('claude: command not found'); }));
    expect(rec.exit_status).toBe('agent_failed');
    expect(readFileSync(join(rec.artifact_dir, 'agent.log'), 'utf8')).toContain('command not found');
  });

  it('нуль ходів, порожній вивід: журнал є, поля метаданих — null (не вигадані)', () => {
    const rec = runTask(task, opts(fake(0, '')));
    expect(rec.exit_status).toBe('ok');
    expect(rec.session_id).toBeNull();
    expect(rec.cost_usd_estimate).toBeNull();
    expect(rec.num_turns).toBeNull();
    expect(readFileSync(join(rec.artifact_dir, 'patch.diff'), 'utf8')).toBe('');
  });

  it('вичерпаний бюджет відрізняється від падіння (за subtype/terminal_reason із JSON)', () => {
    const rec = runTask(task, opts(fake(1, BUDGET)));
    expect(rec.exit_status).toBe('budget_or_turns');
    expect(rec.agent_subtype).toBe('error_max_budget_usd');
    expect(rec.terminal_reason).toBe('budget_exhausted');
    expect(rec.cost_usd_estimate).toBe(0.055);
  });

  it('таймаут: окремий статус, журнал є', () => {
    const rec = runTask(task, opts(fake(1, '', '', true)));
    expect(rec.exit_status).toBe('timeout');
    expect(readFileSync(join(rec.artifact_dir, 'run.json'), 'utf8')).toContain('"timeout"');
  });

  it('acceptance падає — прогін не вважається прийнятим, навіть якщо агент вийшов з 0', () => {
    const rec = runTask(task, { ...opts(fake(0, SUCCESS)), check: () => [{ cmd: 'npm run typecheck', exit: 2 }] });
    expect(rec.exit_status).toBe('ok');
    expect(rec.acceptance_passed).toBe(false);
  });

  it('порожній acceptance не може пройти (немає команди — немає задачі)', () => {
    const rec = runTask({ ...task, acceptance: [] }, { ...opts(fake(0, SUCCESS)), check: () => [] });
    expect(rec.acceptance_passed).toBe(false);
  });

  it('повторний прогін пише нову теку, а не перезаписує стару', () => {
    const out = tmp();
    let t = 1000;
    const o = { ...opts(fake(0, SUCCESS)), outDir: out, now: () => new Date((t += 1000)) };
    const a = runTask(task, o);
    const b = runTask(task, o);
    expect(a.artifact_dir).not.toBe(b.artifact_dir);
    expect(readdirSync(out)).toHaveLength(2);
  });
});

describe('claudeArgs: дозволи звужують, а не обходять', () => {
  const args = claudeArgs(task, 'sonnet');

  it('режим dontAsk, явний перелік інструментів, бюджетні прапорці з черги', () => {
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
    expect(args[args.indexOf('--allowedTools') + 1]).toBe(ALLOWED_TOOLS.join(','));
    expect(args[args.indexOf('--max-turns') + 1]).toBe('2');
    expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('0.1');
    expect(args).toContain('--strict-mcp-config');
  });

  it('жодного обходу дозволів', () => {
    const joined = args.join(' ');
    expect(joined).not.toContain('bypassPermissions');
    expect(joined).not.toContain('dangerously');
    const tools: readonly string[] = ALLOWED_TOOLS;
    expect(tools.some((t) => t === 'Bash' || t.startsWith('Bash(git push') || t.startsWith('Bash(rm'))).toBe(false);
  });
});

describe('readMeta і classify', () => {
  it('не падає на непарсибельному виводі', () => {
    expect(readMeta('не JSON').cost_usd_estimate).toBeNull();
  });

  it('виход 0 з is_error=true (помилка автентифікації друкується як результат) — не ok', () => {
    const meta = readMeta(JSON.stringify({ subtype: 'success', is_error: true, result: 'Not logged in' }));
    expect(classify({ exitCode: 0, stdout: '', stderr: '' }, meta)).toBe('agent_failed');
  });
});

describe('черга', () => {
  it('docs/lab3/tasks.jsonl: ≥ 6 задач однакової форми, acceptance і budget непорожні, id унікальні', () => {
    const tasks = readTasks('docs/lab3/tasks.jsonl');
    expect(tasks.length).toBeGreaterThanOrEqual(6);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    for (const t of tasks) {
      expect(t.id).toMatch(/^[te]-\d{2}$/); // t-NN — задачі кроку 00; e-NN — крайні випадки банку evals (крок 04)
      expect(t.input.length).toBeGreaterThan(t.id.startsWith('e-') ? 5 : 20); // двозначний вхід («Виправ баг.») коротким і має бути
      expect(t.acceptance.length, `${t.id}: acceptance`).toBeGreaterThan(0);
      expect(t.acceptance.every((c) => c.trim() !== '')).toBe(true);
      expect(t.budget.max_turns).toBeGreaterThan(0);
      expect(t.budget.max_usd).toBeGreaterThanOrEqual(0.1); // порожній виклик коштує $0.02–0.055: стеля нижча безглузда
      expect(t.budget.timeout_s).toBeGreaterThan(0);
    }
  });
});

describe('база прогону', () => {
  it('локальний main, що відрізняється від origin/main, не приймається', async () => {
    const { assertFreshBase } = await import('../../scripts/harness/run-queue');
    const revs: Record<string, string> = { 'origin/main': '071ac814aaaa', main: '3456d6feaaaa' };
    expect(() => assertFreshBase('main', (r) => revs[r] ?? null)).toThrow('--base origin/main');
    expect(() => assertFreshBase('origin/main', (r) => revs[r] ?? null)).not.toThrow();
    expect(() => assertFreshBase('main', (r) => ({ 'origin/main': 'x', main: 'x' })[r] ?? null)).not.toThrow();
  });

  it('приймання порівнює з HEAD дерева прогону, а не з гілкою main', () => {
    const tasks = readTasks('docs/lab3/tasks.jsonl');
    const cmds = tasks.flatMap((t) => t.acceptance);
    expect(cmds.filter((c) => c.startsWith('git diff --quiet main')).length).toBe(0);
    expect(cmds.some((c) => c.startsWith('git diff --quiet HEAD'))).toBe(true);
  });
});
