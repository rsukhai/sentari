/**
 * ЦИТУВАННЯ (крок 05). Цитата має дати читачеві знайти місце в документі:
 * файл data/obd/<docId>.md, шлях заголовків і 0-based зсуви в нормалізованому тексті.
 */
import type { IndexedChunk } from './store';

export interface Citation {
  readonly chunkId: string;
  readonly docId: string;
  readonly heading: string;
  /** 0-based зсуви в нормалізованому тексті документа — як у кроці 04. */
  readonly start: number;
  readonly end: number;
  /** Дослівний уривок з фрагмента: те, на чому тримається твердження. */
  readonly quote: string;
}

export function toCitation(chunk: IndexedChunk, quote: string): Citation {
  return {
    chunkId: chunk.id,
    docId: chunk.docId,
    heading: chunk.heading,
    start: chunk.start,
    end: chunk.end,
    quote,
  };
}

/** Рядок, який бачить користувач. */
export function renderCitation(c: Citation): string {
  const where = c.heading === '' ? '' : ` › ${c.heading}`;
  return `[${c.chunkId}] ${c.docId}${where} · символи ${c.start}–${c.end}`;
}

/** Фрагменти в промпт — з id, бо цитувати модель має саме їх. */
export function renderContext(chunks: readonly Pick<IndexedChunk, 'id' | 'docId' | 'heading' | 'text'>[]): string {
  return chunks
    .map((c) => `[${c.id}] ${c.docId}${c.heading === '' ? '' : ` › ${c.heading}`}\n${c.text}`)
    .join('\n\n---\n\n');
}

const CITED = /\[([a-z0-9][a-z0-9-]*#\d{4})]/gi;
/** «уривок» [id] — дослівна цитата перед посиланням (строга перевірка). */
const QUOTED = /[«"“]([^»"”]{8,})[»"”]\s*\[([a-z0-9][a-z0-9-]*#\d{4})]/gi;

/** id фрагментів, на які послалась відповідь, у порядку появи без повторів. */
export function citedIds(answer: string): string[] {
  return [...new Set([...answer.matchAll(CITED)].map((m) => m[1] ?? ''))];
}

/**
 * Відповідь без цитати і відповідь із цитатою на невидане — помилки.
 * Строга частина: уривок у лапках перед [id] має дослівно бути в тексті цього фрагмента.
 * Повертає перелік проблем; порожній означає «зелено».
 */
export function validateAnswer(answer: string, served: readonly Pick<IndexedChunk, 'id' | 'text'>[]): string[] {
  const problems: string[] = [];
  const byId = new Map(served.map((c) => [c.id, c]));
  const used = citedIds(answer);
  if (used.length === 0) problems.push('у відповіді немає жодної цитати');
  for (const id of used) {
    if (!byId.has(id)) problems.push(`цитата [${id}]: такого фрагмента асистентові не давали`);
  }
  for (const m of answer.matchAll(QUOTED)) {
    const [, quote = '', id = ''] = m;
    const chunk = byId.get(id);
    if (chunk && !chunk.text.includes(quote)) problems.push(`цитата [${id}]: уривка «${quote.slice(0, 40)}…» у фрагменті немає`);
  }
  return problems;
}
