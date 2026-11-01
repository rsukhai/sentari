/**
 * ІНСТРУМЕНТИ MCP (крок 08). Тут немає ні транспорту, ні процесу:
 * лише схеми входу і чисті обробники над пошуком кроку 05 —
 * тому їх можна тестувати без мережі й без запущеного сервера.
 * Межі й правила — docs/lab2/mcp-spec.md; змінюється поведінка — спершу специфікація.
 */
import { z } from 'zod';

import type { Bm25Index } from '../rag/bm25';
import { renderCitation, toCitation } from '../rag/cite';
import type { Embedder } from '../rag/embed';
import { hybridSearch } from '../rag/search';
import type { IndexFile } from '../rag/store';

/** Межі зі mcp-spec.md: запит, topK, текст фрагмента (1200 + перекриття 120 — максимум індексу), таймаут. */
export const LIMITS = { queryChars: 500, topKMax: 10, chunkChars: 1320, timeoutMs: 10_000 } as const;

/** Шаблон id фрагмента: <docId>#<0000>; docId — імʼя файлу data/obd/ без .md. Перша з двох перевірок. */
export const CHUNK_ID = /^[a-z0-9][a-z0-9-]{0,63}#\d{4}$/;

export const searchInput = z
  .object({
    query: z.string().min(1).max(LIMITS.queryChars),
    topK: z.number().int().min(1).max(LIMITS.topKMax).default(5),
  })
  .strict();

export const fetchInput = z
  .object({
    id: z.string().regex(CHUNK_ID),
  })
  .strict();

export interface Deps {
  readonly index: IndexFile;
  readonly words: Bm25Index;
  readonly embedder: Embedder;
}

/** Відмова — НЕ виняток «щось пішло не так», а задокументована відповідь з isError. */
export class Refusal extends Error {}

export async function withTimeout<T>(p: Promise<T>, ms: number = LIMITS.timeoutMs): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Refusal(`перевищено таймаут ${ms} мс`)), ms);
  });
  try {
    return await Promise.race([p, guard]);
  } finally {
    clearTimeout(timer);
  }
}

const clip = (s: string): string => (s.length <= LIMITS.chunkChars ? s : `${s.slice(0, LIMITS.chunkChars)}…`);

export async function searchCorpus(deps: Deps, raw: unknown, timeoutMs: number = LIMITS.timeoutMs): Promise<string[]> {
  const { query, topK } = searchInput.parse(raw);
  const { hits } = await withTimeout(hybridSearch(deps.index, deps.words, deps.embedder, query, topK), timeoutMs);
  if (hits.length === 0) return ['нічого не знайдено за цим запитом'];
  return hits.map((h) => {
    const c = toCitation(h.chunk, clip(h.chunk.text));
    return `${renderCitation(c)}\ncosine=${h.cosine.toFixed(4)} rrf=${h.rrf.toFixed(5)}\n${clip(h.chunk.text)}`;
  });
}

export function fetchChunk(deps: Deps, raw: unknown): string {
  const { id } = fetchInput.parse(raw);
  // МЕЖА: allowlist — це сам індекс. Шляхів інструмент не бачить узагалі,
  // тому ../../.env не «блокується фільтром», а просто не існує як id.
  const chunk = deps.index.chunks.find((c) => c.id === id);
  if (!chunk) throw new Refusal(`фрагмента ${id} немає в індексі`);
  const c = toCitation(chunk, clip(chunk.text));
  return `${renderCitation(c)}\n${clip(chunk.text)}`;
}
