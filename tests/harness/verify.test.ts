import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { harnessDiff } from '../../scripts/harness/verify-task';
import { agreement, confusion, type Label } from '../../src/verify/agreement';
import { judgeCriterion, type Ask } from '../../src/verify/judge';
import { openAiJudge } from '../../src/verify/openai';
import { isBlocked, isBlockedStrict, type VerifyReport } from '../../src/verify/schema';
import { assertOtherFamily, executorProvider, TASK_JUDGE_SYSTEM, taskContext, taskCriteria } from '../../src/verify/task';

const report = (...v: ('pass' | 'fail' | 'unknown')[]): VerifyReport => ({
  results: v.map((verdict, i) => ({ id: `c${i + 1}`, verdict, reason: 'r', evidence: verdict === 'unknown' ? '' : 'e' })),
});

describe('isBlockedStrict: блокує все, що не pass', () => {
  it('усі pass — зелено', () => expect(isBlockedStrict(report('pass', 'pass'))).toBe(false));
  it('fail блокує', () => expect(isBlockedStrict(report('pass', 'fail'))).toBe(true));
  it('unknown теж блокує — на відміну від isBlocked з Лаб. 2', () => {
    const r = report('pass', 'unknown');
    expect(isBlockedStrict(r)).toBe(true);
    expect(isBlocked(r)).toBe(false);
  });
});

describe('taskCriteria / taskContext', () => {
  it('задача без criteria — помилка, а не порожнє «зелено»', () => {
    expect(() => taskCriteria({ id: 't-99' })).toThrow(/немає criteria/);
    expect(() => taskCriteria({ id: 't-99', criteria: [] })).toThrow(/немає criteria/);
  });

  it('кожен критерій стає окремим записом судді', () => {
    const cs = taskCriteria({ id: 't-99', criteria: [{ id: 'c1', statement: 'a' }, { id: 'c2', statement: 'b' }] });
    expect(cs.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(cs[0]?.statement).toBe('a');
  });

  it('довідка: текст завдання і лише перші 25 рядків файлу; відсутній файл позначено', () => {
    const long = Array.from({ length: 40 }, (_, i) => `рядок ${i + 1}`).join('\n');
    const text = taskContext({ input: 'зроби X', context: ['a.ts', 'нема.ts'] }, (p) => (p === 'a.ts' ? long : null));
    expect(text).toContain('Завдання, яке виконував агент: зроби X');
    expect(text).toContain('рядок 25');
    expect(text).not.toContain('рядок 26');
    expect(text).toContain('[файлу немає в дереві]');
  });

  it('файл секретів у довідку не потрапляє', () => {
    const secret = ['.env', 'local'].join('.');
    expect(() => taskContext({ input: 'x', context: [secret] }, () => 'KEY=1')).toThrow(/файл секретів/);
    expect(() => taskContext({ input: 'x', context: ['.env.example'] }, () => 'A=')).not.toThrow();
  });
});

describe('родина верифікатора', () => {
  it('Claude Code → anthropic; невідомий шлях — помилка', () => {
    expect(executorProvider('claude-code@2.1 model=sonnet (-p, dontAsk)')).toBe('anthropic');
    expect(() => executorProvider('щось-інше')).toThrow();
  });

  it('та сама родина — відмова, інша — можна', () => {
    expect(() => assertOtherFamily('anthropic', 'anthropic')).toThrow(/тієї самої родини/);
    expect(() => assertOtherFamily('anthropic', 'openai')).not.toThrow();
  });
});

describe('openAiJudge: запит без мережі', () => {
  it('прибирає tools, просить JSON-обʼєкт, рахує токени', async () => {
    let sent: Record<string, unknown> = {};
    const fakeFetch = async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)) as Record<string, unknown>;
      const body = { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 3 } };
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const judge = openAiJudge('k', 'gpt-5.6-terra', fakeFetch);
    expect(await judge.ask('sys', 'user')).toBe('{"ok":true}');
    expect(sent.tools).toBeUndefined();
    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(judge.usage().inputTokens).toBe(10);
    expect(judge.costUsd()).toBeGreaterThan(0);
  });

  it('модель не з OpenAI — відмова', () => {
    expect(() => openAiJudge('k', 'claude-sonnet-5-5')).toThrow(/немає серед моделей OpenAI/);
  });
});

describe('judgeCriterion з системним промптом харнеса', () => {
  it('передає TASK_JUDGE_SYSTEM, перепитує один раз і падає на другій невалідній відповіді', async () => {
    const systems: string[] = [];
    const bad: Ask = async (system) => {
      systems.push(system);
      return 'не json';
    };
    await expect(judgeCriterion(bad, { id: 'c1', statement: 's', check: 'k' }, 'diff', '', TASK_JUDGE_SYSTEM)).rejects.toThrow(/двічі не пройшла схему/);
    expect(systems).toEqual([TASK_JUDGE_SYSTEM, TASK_JUDGE_SYSTEM]);
  });
});

describe('agreement: сира згода й каппа Коена — різні числа', () => {
  it('точний збіг: raw 1, каппа 1', () => {
    const l: Label[] = ['pass', 'fail', 'unknown', 'pass'];
    const a = agreement(l, l);
    expect(a.raw).toBe(1);
    expect(a.kappa).toBe(1);
  });

  it('майже всюди pass: сира згода висока, каппа значно нижча', () => {
    const mine: Label[] = [...Array<Label>(9).fill('pass'), 'fail'];
    const judge: Label[] = [...Array<Label>(8).fill('pass'), 'fail', 'pass'];
    const a = agreement(mine, judge);
    expect(a.raw).toBeCloseTo(0.8, 5);
    expect(a.kappa).toBeLessThan(0.2);
  });

  it('усі мітки однакові — каппа не визначена', () => {
    expect(agreement(['pass', 'pass'], ['pass', 'pass']).kappa).toBeNaN();
  });

  it('різна довжина — помилка', () => {
    expect(() => agreement(['pass'], ['pass', 'fail'])).toThrow();
  });

  it('матриця невідповідностей: рядок — мій вердикт, стовпчик — суддя', () => {
    const m = confusion(['pass', 'fail', 'fail'], ['pass', 'pass', 'fail']);
    expect(m.pass.pass).toBe(1);
    expect(m.fail.pass).toBe(1);
    expect(m.fail.fail).toBe(1);
  });
});

describe('harnessDiff: від батька комміту «harness: <id>» до head', () => {
  it('містить комміт прогону й виправлення після нього, але не базу', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hd-'));
    const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' }).trim();
    git('init', '-q');
    writeFileSync(join(dir, 'base.txt'), 'база\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    writeFileSync(join(dir, 'task.txt'), 'прогін\n');
    git('add', '.');
    git('commit', '-q', '-m', 'harness: t-99');
    writeFileSync(join(dir, 'fix.txt'), 'виправлення\n');
    git('add', '.');
    git('commit', '-q', '-m', 'fix: після червоного');
    const head = git('rev-parse', 'HEAD');

    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const { diff } = harnessDiff('t-99', head);
      expect(diff).toContain('task.txt');
      expect(diff).toContain('fix.txt');
      expect(diff).not.toContain('base.txt');
      expect(() => harnessDiff('t-98', head)).toThrow(/немає комміту/);
    } finally {
      process.chdir(cwd);
    }
  });
});
