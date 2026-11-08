import { describe, expect, it } from 'vitest';

import { renderCitation, renderContext, toCitation, validateAnswer } from '../../src/rag/cite';
import type { IndexedChunk } from '../../src/rag/store';

function makeChunk(overrides: Partial<IndexedChunk> = {}): IndexedChunk {
  return {
    id: 'egr#0000',
    docId: 'egr',
    heading: 'Problems',
    start: 10,
    end: 42,
    text: 'The EGR valve can become clogged with carbon deposits.',
    vector: [],
    ...overrides,
  };
}

describe('toCitation', () => {
  it('копіює chunkId, docId, heading, start, end і quote', () => {
    const chunk = makeChunk();
    const quote = 'clogged with carbon deposits';
    expect(toCitation(chunk, quote)).toEqual({
      chunkId: chunk.id,
      docId: chunk.docId,
      heading: chunk.heading,
      start: chunk.start,
      end: chunk.end,
      quote,
    });
  });
});

describe('renderCitation', () => {
  it('дає «[id] docId › heading · символи start–end»', () => {
    const chunk = makeChunk();
    const citation = toCitation(chunk, 'quote');
    expect(renderCitation(citation)).toBe('[egr#0000] egr › Problems · символи 10–42');
  });

  it('не додає « › », коли heading порожній', () => {
    const chunk = makeChunk({ heading: '' });
    const citation = toCitation(chunk, 'quote');
    expect(renderCitation(citation)).toBe('[egr#0000] egr · символи 10–42');
  });
});

describe('renderContext', () => {
  it('розділяє фрагменти рядком «---» і підписує кожен «[id] docId › heading»', () => {
    const chunks = [
      makeChunk({ id: 'egr#0000', docId: 'egr', heading: 'Problems', text: 'EGR text.' }),
      makeChunk({ id: 'maf#0000', docId: 'maf', heading: 'Cleaning', text: 'MAF text.' }),
    ];
    expect(renderContext(chunks)).toBe(
      '[egr#0000] egr › Problems\nEGR text.\n\n---\n\n[maf#0000] maf › Cleaning\nMAF text.',
    );
  });

  it('не додає « › », коли heading порожній', () => {
    const chunks = [makeChunk({ id: 'egr#0000', docId: 'egr', heading: '', text: 'EGR text.' })];
    expect(renderContext(chunks)).toBe('[egr#0000] egr\nEGR text.');
  });
});

describe('validateAnswer', () => {
  it('ловить дослівну цитату, якої немає у фрагменті', () => {
    const served = [makeChunk({ id: 'egr#0000', text: 'The EGR valve can become clogged with carbon deposits.' })];
    const answer = 'Клапан забивається нагаром «зовсім інший текст тут» [egr#0000].';
    const problems = validateAnswer(answer, served);
    expect(problems.some((p) => p.includes('[egr#0000]') && p.includes('уривка'))).toBe(true);
  });

  it('не скаржиться, коли цитата дослівно є у фрагменті', () => {
    const served = [makeChunk({ id: 'egr#0000', text: 'The EGR valve can become clogged with carbon deposits.' })];
    const answer = 'Клапан забивається нагаром «clogged with carbon deposits» [egr#0000].';
    expect(validateAnswer(answer, served)).toEqual([]);
  });
});
