import { describe, expect, it } from 'vitest';

import { runPool } from '../../src/rag/pool';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runPool', () => {
  it('не перевищує ширину і зберігає порядок результатів', async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      active++;
      peak = Math.max(peak, active);
      await wait(5);
      active--;
      return i;
    });
    const { results, stoppedEarly } = await runPool(tasks, { maxBranches: 2, maxTokens: 1e9, maxWallMs: 1e9 }, () => 0);
    expect(peak).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stoppedEarly).toBe(false);
  });

  it('помилка однієї гілки не губить решту', async () => {
    const tasks = [async () => 1, async () => { throw new Error('429'); }, async () => 3];
    const { results } = await runPool(tasks, { maxBranches: 3, maxTokens: 1e9, maxWallMs: 1e9 }, () => 0);
    expect(results[0]).toBe(1);
    expect((results[1] as Error).message).toBe('429');
    expect(results[2]).toBe(3);
  });

  it('правило зупинки: нову гілку не починати, коли стелю токенів перетнуто', async () => {
    let spent = 0;
    const tasks = Array.from({ length: 5 }, () => async () => {
      spent += 40;
      return spent;
    });
    const { results, stoppedEarly } = await runPool(tasks, { maxBranches: 1, maxTokens: 100, maxWallMs: 1e9 }, () => spent);
    expect(results.filter((r) => r !== undefined)).toHaveLength(3); // 0 → 40 → 80 → 120: четверта не стартує
    expect(stoppedEarly).toBe(true);
  });
});

describe('parallel-eval.ts', () => {
  it('системний промпт — дослівно той самий, що в baseline.ts (та сама робота, що в кроці 06)', async () => {
    const { readFileSync } = await import('node:fs');
    const { BASELINE_SYSTEM } = await import('../../scripts/parallel-eval');
    const baseline = readFileSync('scripts/baseline.ts', 'utf8');
    const [first = '', second = ''] = BASELINE_SYSTEM.split('. Answer');
    expect(baseline).toContain(`'${first}. ' +`);
    expect(baseline).toContain(`'Answer${second}'`);
  });
});
