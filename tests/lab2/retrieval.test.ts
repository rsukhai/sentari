import { describe, expect, it } from 'vitest';

import { isRefusal, REFUSAL, REFUSAL_COSINE, refusedByRetrieval } from '../../src/rag/answer';
import { buildBm25, searchBm25, tokenize } from '../../src/rag/bm25';
import { citedIds, validateAnswer } from '../../src/rag/cite';
import { fakeEmbedder } from '../../src/rag/embed';
import { rrf } from '../../src/rag/rrf';
import { bm25From, hybridSearch } from '../../src/rag/search';
import type { IndexedChunk, IndexFile } from '../../src/rag/store';

describe('bm25', () => {
  it('бачить кирилицю', () => {
    expect(tokenize('Помилка E-418')).toEqual(['помилка', '418']);
  });

  const docs = [
    { id: 'c-1', text: 'Code P0420 means catalyst efficiency below threshold.' },
    { id: 'c-2', text: 'A clogged EGR valve can sometimes be cleaned.' },
    { id: 'c-3', text: 'The oxygen sensor reports a lean mixture to the ECU.' },
  ];
  const index = buildBm25(docs);

  it('знаходить рідкісний точний рядок', () => {
    expect(searchBm25(index, 'P0420')[0]?.id).toBe('c-1');
  });

  it('нічого не повертає, коли спільних слів немає', () => {
    // стемінгу немає: «stuck» не збігається з «clogged», «gas» — ні з чим
    expect(searchBm25(index, 'stuck gas')).toEqual([]);
  });
});

describe('rrf', () => {
  it('той самий розбір, що в методичці', () => {
    const fused = rrf([['A', 'B', 'C'], ['C', 'A', 'D']]);
    expect(fused.map((r) => r.id)).toEqual(['A', 'C', 'B', 'D']);
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 62, 10);
    expect(fused[1]?.score).toBeCloseTo(1 / 63 + 1 / 61, 10);
    // згода двох гілок перебиває перше місце в одній
    expect(fused[0]?.score).toBeGreaterThan(fused[1]?.score ?? 1);
  });

  it('ранги рахуються з одиниці', () => {
    expect(rrf([['A']])[0]?.score).toBeCloseTo(1 / 61, 10);
  });

  it('відсутній у списку документ не додає нічого', () => {
    expect(rrf([['A', 'B'], ['A']]).find((r) => r.id === 'B')?.score).toBeCloseTo(1 / 62, 10);
  });
});

describe('hybridSearch на мінікорпусі з підробленим ембедером', () => {
  const embedder = fakeEmbedder(64);
  const texts = [
    ['egr#0000', 'egr', '## Problems\n\nThe EGR valve can become clogged with carbon deposits.'],
    ['maf#0000', 'maf', '## Cleaning\n\nUse a dedicated MAF sensor cleaner, not brake cleaner.'],
    ['dpf#0000', 'dpf', '## Regeneration\n\nDrive at 80-100 km/h for 30-45 minutes to regenerate the filter.'],
  ] as const;

  it('повертає ранги обох гілок і косинус', async () => {
    const vectors = await embedder.embedDocuments(texts.map(([, , t]) => t));
    const chunks: IndexedChunk[] = texts.map(([id, docId, text], i) => ({
      id, docId, heading: '', start: 0, end: text.length, text, vector: vectors[i] ?? [],
    }));
    const index = { chunks } as unknown as IndexFile;
    const r = await hybridSearch(index, bm25From(index), embedder, 'MAF sensor cleaner');
    expect(r.hits[0]?.chunk.id).toBe('maf#0000');
    expect(r.hits[0]?.rankVector).toBe(1);
    expect(r.hits[0]?.rankWords).toBe(1);
    expect(r.hits[0]?.cosine).toBeGreaterThan(0);
  });
});

describe('validateAnswer', () => {
  const served = [{ id: 'egr#0003', text: 'Clogged EGR valves can sometimes be cleaned, but replacement is necessary.' }];

  it('ловить відповідь без цитати', () => {
    expect(validateAnswer('Clean it.', served).join(' ')).toContain('немає жодної цитати');
  });

  it('ловить цитату на невидане', () => {
    expect(validateAnswer('Clean it [egr#0099].', served).join(' ')).toContain('не давали');
  });

  it('приймає цитату на видане', () => {
    expect(validateAnswer('It can be cleaned [egr#0003].', served)).toEqual([]);
  });

  it('строго: уривок у лапках має дослівно бути у фрагменті', () => {
    expect(validateAnswer('"can sometimes be cleaned" [egr#0003].', served)).toEqual([]);
    expect(validateAnswer('"must always be replaced" [egr#0003].', served).join(' ')).toContain('у фрагменті немає');
  });

  it('citedIds — без повторів, у порядку появи', () => {
    expect(citedIds('A [egr#0003]. B [maf#0001]. C [egr#0003].')).toEqual(['egr#0003', 'maf#0001']);
  });
});

describe('правило відмови', () => {
  it('пошук відмовляє лише нижче порога косинуса', () => {
    expect(refusedByRetrieval([{ cosine: REFUSAL_COSINE - 0.01 }])).toBe(true);
    expect(refusedByRetrieval([{ cosine: 0.6996 }])).toBe(false); // найнижчий топ-1 у наборі (q-02)
    expect(refusedByRetrieval([])).toBe(true);
  });

  it('фраза відмови розпізнається дослівно', () => {
    expect(isRefusal(`Sorry. ${REFUSAL}`)).toBe(true);
    expect(isRefusal('The timing belt lasts 100,000 km.')).toBe(false);
  });
});
