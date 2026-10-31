import { describe, expect, it } from 'vitest';

import { validateGolden } from '../scripts/validate-golden';

const LOOSE = { total: 1, unanswerable: 0, injection: 0 };
const line = (o: Record<string, unknown>) => JSON.stringify(o);

const ok = {
  id: 'q-01',
  query: 'Що означає, коли горить Check Engine?',
  expected: ['несправність у системі керування двигуном'],
  must_cite: ['check-engine'],
  tags: ['easy'],
};

describe('validateGolden', () => {
  it('приймає коректний рядок', () => {
    expect(validateGolden(line(ok), LOOSE)).toEqual([]);
  });

  it('не приймає порожній must_cite поза unanswerable', () => {
    expect(validateGolden(line({ ...ok, must_cite: [] }), LOOSE).join(' ')).toContain('must_cite');
  });

  it('не приймає must_cite у unanswerable', () => {
    const entry = { ...ok, tags: ['unanswerable'] };
    expect(validateGolden(line(entry), LOOSE).join(' ')).toContain('unanswerable не може мати must_cite');
  });

  it('ловить повтор id', () => {
    expect(validateGolden(`${line(ok)}\n${line(ok)}`, LOOSE).join(' ')).toContain('повторюється');
  });

  it('ловить витік відповіді в текст запиту', () => {
    const leaky = {
      ...ok,
      query: 'Чи правда, що Check Engine означає несправність у системі керування двигуном?',
      expected: ['несправність у системі керування двигуном'],
    };
    expect(validateGolden(line(leaky), LOOSE).join(' ')).toContain('дослівно');
  });

  it('ловить невідомий тег і зайве поле', () => {
    expect(validateGolden(line({ ...ok, tags: ['medium'] }), LOOSE).join(' ')).toContain('рядок 1');
    expect(validateGolden(line({ ...ok, answer: 'x' }), LOOSE).join(' ')).toContain('рядок 1');
  });

  it('ловить рядок, що не є JSON', () => {
    expect(validateGolden('{"id":', LOOSE)).toEqual(['рядок 1: не JSON', 'запитів 0, потрібно ≥ 1']);
  });

  it('звіряє must_cite з колекцією, якщо її передано', () => {
    const known = new Set(['check-engine', 'obd']);
    expect(validateGolden(line(ok), LOOSE, known)).toEqual([]);
    const typo = { ...ok, must_cite: ['check_engine'] };
    expect(validateGolden(line(typo), LOOSE, known).join(' ')).toContain('"check_engine" немає в spec.md');
  });

  it('вимагає порогів подання', () => {
    const problems = validateGolden(line(ok)).join(' ');
    expect(problems).toContain('потрібно ≥ 20');
    expect(problems).toContain('unanswerable 0, потрібно ≥ 3');
    expect(problems).toContain('injection 0, потрібно ≥ 2');
  });

  it('переживає CRLF і BOM', () => {
    expect(validateGolden(`﻿${line(ok)}\r\n\r\n`, LOOSE)).toEqual([]);
  });
});
