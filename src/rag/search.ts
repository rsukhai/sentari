/**
 * Гібридний пошук (крок 05): топ-20 за косинусом + топ-20 за BM25 → RRF → топ-5.
 * Вектор запиту рахує той самий ембедер, що й індекс (embeddinggemma-2 префіксів не потребує).
 */
import { cosineSimilarity } from 'ai';

import { buildBm25, searchBm25, type Bm25Index } from './bm25';
import type { Embedder } from './embed';
import { rrf, RRF_K } from './rrf';
import type { IndexedChunk, IndexFile } from './store';

export const DEPTH = 20; // скільки беремо з кожної гілки ДО злиття

export interface Hit {
  readonly chunk: IndexedChunk;
  readonly rrf: number;
  readonly cosine: number;
  /** Ранги з 1; null — цієї гілки фрагмент не знайшла. Саме це йде в retrieval.md. */
  readonly rankVector: number | null;
  readonly rankWords: number | null;
}

/** Повний результат: гілки окремо (для --explain і порога відмови) і злиття. */
export interface SearchResult {
  readonly hits: Hit[];
  readonly vector: { readonly id: string; readonly score: number }[];
  readonly words: { readonly id: string; readonly score: number }[];
  readonly fused: { readonly id: string; readonly score: number }[];
}

export function bm25From(index: IndexFile): Bm25Index {
  // шукаємо по тому ж тексту, що й ембедимо: заголовок усередині фрагмента — навмисно
  return buildBm25(index.chunks.map((c) => ({ id: c.id, text: c.text })));
}

export async function hybridSearch(
  index: IndexFile,
  words: Bm25Index,
  embedder: Embedder,
  query: string,
  topK = 5,
): Promise<SearchResult> {
  const qv = await embedder.embedQuery(query);
  const cosines = new Map(index.chunks.map((c) => [c.id, cosineSimilarity(qv, c.vector)]));
  const vector = [...cosines.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, DEPTH)
    .map(([id, score]) => ({ id, score }));
  const wordHits = searchBm25(words, query, DEPTH);
  const vectorList = vector.map((r) => r.id);
  const wordList = wordHits.map((r) => r.id);
  const byId = new Map(index.chunks.map((c) => [c.id, c]));
  const rank = (list: readonly string[], id: string): number | null => {
    const i = list.indexOf(id);
    return i < 0 ? null : i + 1;
  };
  const fused = rrf([vectorList, wordList], RRF_K);
  const hits = fused.slice(0, topK).flatMap(({ id, score }) => {
    const chunk = byId.get(id);
    if (!chunk) return [];
    return [{ chunk, rrf: score, cosine: cosines.get(id) ?? 0, rankVector: rank(vectorList, id), rankWords: rank(wordList, id) }];
  });
  return { hits, vector, words: wordHits, fused };
}
