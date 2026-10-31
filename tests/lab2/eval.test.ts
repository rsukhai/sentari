import { describe, expect, it } from 'vitest';

import { median, summarize, summaryTable, type Grade, type RunRecord } from '../../src/rag/eval';

const rec = (id: string, tags: string[], extra: Partial<RunRecord> = {}): RunRecord => ({
  id,
  tags,
  query: 'q',
  answer: 'a',
  cited: [],
  usage: { inputTokens: 10, cachedTokens: 0, outputTokens: 5 },
  usd: 0.001,
  latencyMs: 1000,
  ...extra,
});

describe('median', () => {
  it('непарна, парна і порожня вибірка', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('summarize', () => {
  const records = [
    rec('q-01', ['easy'], { latencyMs: 500, cited: ['obd'] }),
    rec('q-02', ['hard'], { latencyMs: 3000 }),
    rec('q-03', ['unanswerable'], { latencyMs: 2000 }),
    rec('q-04', ['injection', 'easy'], { latencyMs: 1000 }),
  ];
  const grades: Grade[] = [
    { id: 'q-01', verdict: 'correct' },
    { id: 'q-02', verdict: 'partial' },
    { id: 'q-03', verdict: 'refused' },
    { id: 'q-04', verdict: 'correct', followedInjection: true },
  ];

  it('рахує точність без unanswerable, відмови й injection окремо', () => {
    const s = summarize(records, grades);
    expect(s.accuracy).toEqual({ correct: 2, of: 3 });
    expect(s.refusals).toEqual({ refused: 1, of: 1 });
    expect(s.injectionResisted).toEqual({ resisted: 0, of: 1 });
    expect(s.cited).toEqual({ withCitation: 1, of: 3 });
    expect(s.usage).toEqual({ inputTokens: 40, cachedTokens: 0, outputTokens: 20 });
    expect(s.medianLatencyMs).toBe(1500);
    expect(s.ungraded).toEqual([]);
  });

  it('неоцінений запит не рахується як стійкий до injection і видно в ungraded', () => {
    const s = summarize(records, grades.slice(0, 3));
    expect(s.injectionResisted).toEqual({ resisted: 0, of: 1 });
    expect(s.ungraded).toEqual(['q-04']);
  });

  it('таблиця має всі рядки каркаса', () => {
    const table = summaryTable(summarize(records, grades), 'Базова лінія');
    for (const row of ['Точність', 'Правильні відмови', 'injection', 'цитатою', 'Токени', 'Вартість', 'Медіана']) {
      expect(table).toContain(row);
    }
    expect(table).toContain('67% (2 із 3)');
  });
});
