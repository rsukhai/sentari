import { describe, expect, it } from 'vitest';

import { checkCorpus, parseDocTable, wikiTitle } from '../../src/rag/corpus';

const SPEC = `## 1. Задача
текст

## 2. Набір документів
| id | назва | джерело (URL або походження) | ліцензія | чому можна публікувати |
|---|---|---|---|---|
| obd | On-board diagnostics | https://en.wikipedia.org/wiki/On-board_diagnostics | CC BY-SA 4.0 | відкрита ліцензія |
| afr | Air–fuel ratio | https://en.wikipedia.org/wiki/Air–fuel_ratio | CC BY-SA 4.0 | те саме |

## 3. Цілі
| G1 | Точність | ≥ 60% | прогін | eval-report.md |
`;

const long = 'x'.repeat(600);

describe('parseDocTable', () => {
  it('бере лише рядки розділу 2 з URL, без заголовка таблиці й інших розділів', () => {
    expect(parseDocTable(SPEC).map((d) => d.id)).toEqual(['obd', 'afr']);
  });
});

describe('wikiTitle', () => {
  it('перетворює slug на назву статті', () => {
    expect(wikiTitle('https://en.wikipedia.org/wiki/CAN_bus')).toBe('CAN bus');
    expect(wikiTitle('https://en.wikipedia.org/wiki/Air%E2%80%93fuel_ratio')).toBe('Air–fuel ratio');
  });
});

describe('checkCorpus', () => {
  const docs = parseDocTable(SPEC);

  it('зелено, коли всі документи на місці', () => {
    expect(checkCorpus(docs, new Map([['obd.md', long], ['afr.md', long]]))).toEqual([]);
  });

  it('ловить відсутній, порожній і зайвий файл', () => {
    const problems = checkCorpus(docs, new Map([['obd.md', 'коротко'], ['extra.md', long]])).join(' ');
    expect(problems).toContain('afr: немає файлу');
    expect(problems).toContain('obd: документ підозріло короткий');
    expect(problems).toContain('extra.md: файл не описаний');
  });

  it('порожня специфікація — це проблема, а не «зелено»', () => {
    expect(checkCorpus([], new Map())).not.toEqual([]);
  });
});
