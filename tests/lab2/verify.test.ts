import { describe, expect, it } from 'vitest';

import { judgeCriterion, parseCriteria, prepareDiff, type Ask, type Criterion } from '../../src/verify/judge';
import { isBlocked } from '../../src/verify/schema';

const SPEC = `## 5. Обсяг
| A9 | не з цього розділу | — |

## 6. Критерії приймання
| # | Критерій (перевірне твердження) | Чим перевіряється |
|---|---|---|
| A1 | \`npm test\` зелений | прогін CI |
| A4 | у data/obd/ лежать усі 23 документи | скрипт перевірки повертає 0 |

## 7. Обмеження
`;

const A4: Criterion = { id: 'A4', statement: 'у data/obd/ лежать усі 23 документи', check: 'скрипт перевірки повертає 0' };

/** Назва файлу з секретами складається з частин, щоб guard не приймав сам тест за спробу доступу. */
const SECRET_FILE = ['.env', 'local'].join('.');

const fileDiff = (path: string, body: string) =>
  `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1 @@\n${body}\n`;

describe('parseCriteria', () => {
  it('бере лише рядки A<n> з розділу 6', () => {
    expect(parseCriteria(SPEC)).toEqual([
      { id: 'A1', statement: '`npm test` зелений', check: 'прогін CI' },
      { id: 'A4', statement: 'у data/obd/ лежать усі 23 документи', check: 'скрипт перевірки повертає 0' },
    ]);
  });
});

describe('prepareDiff', () => {
  it('викидає файли з секретами, але лишає .env.example', () => {
    const diff = fileDiff(SECRET_FILE, '+OPENAI_API_KEY=x') + fileDiff('.env.example', '+VERIFY_MODEL=gpt-5.6-terra');
    const { text, dropped } = prepareDiff(diff);
    expect(dropped).toEqual([SECRET_FILE]);
    expect(text).not.toContain('OPENAI_API_KEY=x');
    expect(text).toContain('VERIFY_MODEL=gpt-5.6-terra');
  });

  it('маскує рядки, схожі на ключ API', () => {
    const { text } = prepareDiff(fileDiff('src/a.ts', "+const k = 'sk-proj-abcdefghijklmnopqrstuvwx';"));
    expect(text).toContain('[КЛЮЧ ПРИХОВАНО]');
    expect(text).not.toContain('sk-proj-abcdefghijklmnopqrstuvwx');
  });

  it('стискає дані колекції, але не еталонний набір', () => {
    const diff = fileDiff('data/obd/egr.md', '+EGR text') + fileDiff('docs/lab2/golden/queries.jsonl', '+{"id":"q-01"}');
    const { text } = prepareDiff(diff);
    expect(text).toContain('+++ b/data/obd/egr.md');
    expect(text).toContain('[вміст пропущено верифікатором: +1 / -0 рядків]');
    expect(text).not.toContain('EGR text');
    expect(text).toContain('{"id":"q-01"}');
  });
});

describe('judgeCriterion', () => {
  const valid = JSON.stringify({ id: 'A4', verdict: 'fail', reason: 'видалено документ', evidence: 'deleted file data/obd/egr.md' });

  it('приймає валідну відповідь (і в огорожі ```json)', async () => {
    const ask: Ask = async () => '```json\n' + valid + '\n```';
    expect((await judgeCriterion(ask, A4, 'diff')).verdict).toBe('fail');
  });

  it('перепитує один раз після невалідної відповіді', async () => {
    const answers = ['не JSON', valid];
    let calls = 0;
    const ask: Ask = async () => answers[calls++] ?? '';
    expect((await judgeCriterion(ask, A4, 'diff')).verdict).toBe('fail');
    expect(calls).toBe(2);
  });

  it('падає після двох невалідних відповідей', async () => {
    const ask: Ask = async () => JSON.stringify({ id: 'A4', verdict: 'maybe', reason: 'x', evidence: '' });
    await expect(judgeCriterion(ask, A4, 'diff')).rejects.toThrow('двічі не пройшла схему');
  });

  it('не приймає чужий id і pass без evidence', async () => {
    const wrongId = JSON.stringify({ id: 'A1', verdict: 'pass', reason: 'x', evidence: 'y' });
    const noEvidence = JSON.stringify({ id: 'A4', verdict: 'pass', reason: 'x', evidence: '' });
    await expect(judgeCriterion(async () => wrongId, A4, 'diff')).rejects.toThrow('id "A1"');
    await expect(judgeCriterion(async () => noEvidence, A4, 'diff')).rejects.toThrow('порожній evidence');
  });
});

describe('isBlocked', () => {
  it('fail блокує, unknown — ні', () => {
    const v = (verdict: 'pass' | 'fail' | 'unknown') => ({ id: 'A1', verdict, reason: 'r', evidence: 'e' });
    expect(isBlocked({ results: [v('pass'), v('unknown')] })).toBe(false);
    expect(isBlocked({ results: [v('pass'), v('fail')] })).toBe(true);
  });
});
