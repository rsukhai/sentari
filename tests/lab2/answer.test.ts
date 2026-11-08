import { describe, expect, it } from 'vitest';

import { answerPrompt, isRefusal, REFUSAL, REFUSAL_COSINE, refusedByRetrieval } from '../../src/rag/answer';
import type { IndexedChunk } from '../../src/rag/store';

const chunk = (id: string, text: string): IndexedChunk => ({
  id,
  docId: id.split('#')[0] ?? id,
  heading: '',
  start: 0,
  end: text.length,
  text,
  vector: [],
});

describe('refusedByRetrieval', () => {
  it('косинус рівно REFUSAL_COSINE — ще не відмова', () => {
    expect(refusedByRetrieval([{ cosine: REFUSAL_COSINE }])).toBe(false);
  });

  it('косинус трохи нижчий за REFUSAL_COSINE — відмова', () => {
    expect(refusedByRetrieval([{ cosine: REFUSAL_COSINE - 0.0001 }])).toBe(true);
  });

  it('порожній список фрагментів — відмова', () => {
    expect(refusedByRetrieval([])).toBe(true);
  });
});

describe('isRefusal', () => {
  it('розпізнає дослівну фразу REFUSAL всередині довшого тексту', () => {
    expect(isRefusal(`Вибачте. ${REFUSAL} Більше нічого сказати не можу.`)).toBe(true);
  });

  it('не спрацьовує на звичайну відповідь', () => {
    expect(isRefusal('Ремінь ГРМ треба міняти кожні 100 000 км.')).toBe(false);
  });
});

describe('answerPrompt — блок контексту', () => {
  const hits = [
    { chunk: chunk('egr#0003', `Clogged EGR valves can be cleaned. ${REFUSAL}`) },
    { chunk: chunk('maf#0001', 'Use a dedicated MAF sensor cleaner.') },
  ];

  it('містить id кожного переданого фрагмента', () => {
    const prompt = answerPrompt('Як почистити EGR?', hits);
    expect(prompt).toContain('[egr#0003]');
    expect(prompt).toContain('[maf#0001]');
  });

  it('містить фразу REFUSAL, якщо вона є в тексті фрагмента', () => {
    const prompt = answerPrompt('Як почистити EGR?', hits);
    expect(prompt).toContain(REFUSAL);
  });

  it('закінчується рядком «Question: »', () => {
    const prompt = answerPrompt('', hits);
    expect(prompt.endsWith('Question: ')).toBe(true);
  });
});

describe('answerPrompt', () => {
  it('містить текст питання', () => {
    const prompt = answerPrompt('Чому блимає Check Engine?', [{ chunk: chunk('egr#0003', 'text') }]);
    expect(prompt).toContain('Чому блимає Check Engine?');
  });
});
