import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import type { RunRecord, Task } from '../../scripts/harness/run-task';
import { createAgent } from '../../src/agent/agent-aisdk';
import { closedBreaker, DEFAULT_BREAKER, decide, loadBreaker, record, saveBreaker, type Breaker, type Outcome } from '../../src/harness/breaker';
import { looksLikeQuota, stepLimit, taskStopRow } from '../../src/harness/stop';

const T0 = new Date('2026-11-08T12:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60000);
const fail = (key: string, quota = false): Outcome => ({ ok: false, key, quota });

/** Прогнати послідовність результатів через брейкер у closed-стані. */
function run(...outcomes: Outcome[]): Breaker {
  return outcomes.reduce((b, o, i) => record(b, o, at(i)).next, closedBreaker());
}

describe('circuit breaker: closed → open', () => {
  it('N однакових відмов підряд відкривають брейкер, дві — ні', () => {
    expect(run(fail('budget_or_turns'), fail('budget_or_turns')).state).toBe('closed');
    const b = run(fail('budget_or_turns'), fail('budget_or_turns'), fail('budget_or_turns'));
    expect(b.state).toBe('open');
    expect(b.trip).toContain('budget_or_turns ×3');
  });

  it('різні відмови не складаються в «однакові», зелена задача скидає лічильники', () => {
    expect(run(fail('timeout'), fail('agent_failed'), fail('timeout')).state).toBe('closed');
    const b = run(fail('timeout'), fail('timeout'), { ok: true, key: '' }, fail('timeout'), fail('timeout'));
    expect(b.state).toBe('closed');
  });

  it('нема прогресу: M різних відмов підряд відкривають брейкер', () => {
    const b = run(fail('timeout'), fail('agent_failed'), fail('acceptance_failed'), fail('timeout'));
    expect(b.state).toBe('open');
    expect(b.trip).toContain('нема прогресу');
  });

  it('квота (429) відкриває брейкер негайно, з власною причиною', () => {
    const b = run(fail('agent_failed', true));
    expect(b.state).toBe('open');
    expect(b.trip).toContain('quota');
  });
});

describe('circuit breaker: open → half-open → closed | open', () => {
  const opened = run(fail('timeout'), fail('timeout'), fail('timeout')); // opened_at = at(2)

  it('до кінця перепочинку нічого не пускаємо', () => {
    const d = decide(opened, at(2 + 29));
    expect(d.allow).toBe(false);
    expect(d.why).toContain('open');
  });

  it('після перепочинку — рівно одна пробна задача, друга чекає', () => {
    const first = decide(opened, at(2 + 30));
    expect(first).toMatchObject({ allow: true, probe: true, transition: 'half-open' });
    expect(first.next.state).toBe('half-open');
    const second = decide(first.next, at(2 + 31));
    expect(second.allow).toBe(false);
    expect(second.why).toContain('вже в роботі');
  });

  it('зелена пробна задача закриває брейкер і скидає перепочинок', () => {
    const probe = decide(opened, at(40)).next;
    const r = record(probe, { ok: true, key: '' }, at(45));
    expect(r.next).toEqual(closedBreaker());
    expect(r.transition).toBe('closed');
  });

  it('червона пробна задача одразу повертає open із подвоєним перепочинком', () => {
    const probe = decide(opened, at(40)).next;
    const r = record(probe, fail('timeout'), at(45));
    expect(r.next.state).toBe('open');
    expect(r.next.cooldown_min).toBe(60);
    expect(r.next.opens).toBe(2);
    expect(decide(r.next, at(45 + 59)).allow).toBe(false);
    expect(decide(r.next, at(45 + 60)).allow).toBe(true);
  });

  it('перепочинок не росте вище стелі', () => {
    let b = opened;
    for (let i = 0; i < 6; i += 1) {
      const probe = decide(b, at(10_000 * (i + 1))).next;
      b = record(probe, fail('timeout'), at(10_000 * (i + 1) + 1)).next;
    }
    expect(b.cooldown_min).toBe(DEFAULT_BREAKER.maxCooldownMin);
  });

  it('пробна задача, що не повернула результату, не блокує half-open довіку', () => {
    const probe = decide(opened, at(40)).next;
    expect(decide(probe, at(40 + 59)).allow).toBe(false);
    expect(decide(probe, at(40 + 61)).allow).toBe(true);
  });

  it('у open результат задачі нічого не змінює (задачі не запускаються)', () => {
    expect(record(opened, { ok: true, key: '' }, at(3)).next).toBe(opened);
  });
});

describe('стан брейкера живе у файлі', () => {
  it('зберігається між «прогонами», відсутній файл — closed', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'brk-')), 'nested', 'breaker.json');
    expect(loadBreaker(file)).toEqual(closedBreaker());
    const opened = run(fail('timeout'), fail('timeout'), fail('timeout'));
    saveBreaker(opened, file);
    expect(loadBreaker(file)).toEqual(opened);
    expect(decide(loadBreaker(file), at(3)).allow).toBe(false);
  });

  it('зіпсований файл — помилка, а не тихе closed', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'brk-')), 'breaker.json');
    writeFileSync(file, '{"state":"щось"}');
    expect(() => loadBreaker(file)).toThrow();
    writeFileSync(file, 'не json');
    expect(() => loadBreaker(file)).toThrow();
  });
});

describe('taskStopRow: який ліміт задачі спрацював', () => {
  const task: Task = { id: 't-99', input: 'x', acceptance: [], budget: { max_turns: 12, max_usd: 0.5, timeout_s: 300 } };
  const rec = (patch: Partial<RunRecord>): RunRecord => ({ artifact_dir: 'runs/x', duration_s: 7.5, num_turns: 3, cost_usd_estimate: 0.31, agent_subtype: null, exit_status: 'ok', ...patch }) as RunRecord;

  it('error_max_turns → max_turns із числами', () => {
    const row = taskStopRow(rec({ exit_status: 'budget_or_turns', agent_subtype: 'error_max_turns' }), task, 'a');
    expect(row).toMatchObject({ layer: 'task', limit: 'max_turns', configured: 12, observed: 3 });
  });

  it('вичерпаний бюджет → max_budget_usd', () => {
    const row = taskStopRow(rec({ exit_status: 'budget_or_turns', agent_subtype: 'error_max_budget_usd' }), task, 'a');
    expect(row).toMatchObject({ limit: 'max_budget_usd', configured: 0.5, observed: 0.31 });
  });

  it('таймаут → timeout_s; успіх і звичайна відмова — null', () => {
    expect(taskStopRow(rec({ exit_status: 'timeout' }), task, 'a')).toMatchObject({ limit: 'timeout_s', configured: 300, observed: 7.5 });
    expect(taskStopRow(rec({ exit_status: 'ok' }), task, 'a')).toBeNull();
    expect(taskStopRow(rec({ exit_status: 'agent_failed' }), task, 'a')).toBeNull();
  });
});

describe('looksLikeQuota', () => {
  it('впізнає ознаки квоти, не плутає з бюджетом задачі', () => {
    expect(looksLikeQuota('API Error: 429 rate_limit_error')).toBe(true);
    expect(looksLikeQuota('You have hit your usage limit')).toBe(true);
    expect(looksLikeQuota('error_max_budget_usd: бюджет задачі вичерпано')).toBe(false);
    expect(looksLikeQuota('')).toBe(false);
  });
});

describe('stepLimit: stopWhen у власному циклі на AI SDK', () => {
  it('зупиняє нескінченний цикл на N кроці й лишає рядок у журналі', async () => {
    const log = join(mkdtempSync(join(tmpdir(), 'stop-')), 'stop-log.jsonl');
    let n = 0;
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 5, text: 5, reasoning: undefined },
    };
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'tool-call' as const, toolCallId: `c${n++}`, toolName: 'list_files', input: '{"dir":"."}' }],
        finishReason: { unified: 'tool-calls' as const, raw: undefined },
        usage,
        warnings: [],
      }),
    });
    const fs = { list: async () => ['a'], read: async () => '', write: async () => {} };
    const result = await createAgent(model, fs, 99, stepLimit(4, 't-99', log)).generate({ prompt: 'крутись вічно' });
    await new Promise((r) => setTimeout(r, 10)); // запис у журнал іде після вердикту умови

    expect(result.steps).toHaveLength(4);
    const rows = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ layer: 'loop', task_id: 't-99', limit: 'isStepCount', configured: 4, observed: 4 });
  });
});
