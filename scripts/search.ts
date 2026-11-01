/**
 * Гібридний пошук з командного рядка (крок 05). Потрібна локальна Ollama (ембедер запиту).
 *
 *   npx tsx scripts/search.ts "<запит>"              топ-5 з цитатами
 *   npx tsx scripts/search.ts "<запит>" --explain    три списки: вектор, слова, RRF
 *   npx tsx scripts/search.ts --golden               усі запити набору: ранги правильного документа
 *                                                    в кожній гілці, косинус найкращого, збіги слів
 */
import { readFileSync } from 'node:fs';

import { renderCitation, toCitation } from '../src/rag/cite';
import { ollamaEmbedder } from '../src/rag/embed';
import { bm25From, hybridSearch, type SearchResult } from '../src/rag/search';
import { loadIndex } from '../src/rag/store';
import type { Entry } from './validate-golden';

const embedder = ollamaEmbedder();
const index = loadIndex('data/index.json', embedder);
const words = bm25From(index);
const docOf = (chunkId: string) => chunkId.split('#')[0] ?? '';

/** Ранг (з 1) найкращого фрагмента з будь-якого з документів must_cite; null — немає в списку. */
function rankOf(list: readonly { id: string }[], docs: readonly string[]): number | null {
  const i = list.findIndex((r) => docs.includes(docOf(r.id)));
  return i < 0 ? null : i + 1;
}

function explain(r: SearchResult) {
  const col = (list: readonly { id: string; score: number }[], i: number, digits: number) => {
    const row = list[i];
    return row ? `${String(i + 1).padStart(2)}  ${row.id.padEnd(20)} ${row.score.toFixed(digits)}` : '';
  };
  console.log(`${'вектор (cosine)'.padEnd(34)}${'слова (BM25)'.padEnd(34)}RRF (k=60)`);
  for (let i = 0; i < 10; i++) {
    console.log(`${col(r.vector, i, 4).padEnd(34)}${col(r.words, i, 2).padEnd(34)}${col(r.fused, i, 5)}`);
  }
  if (r.words.length === 0) console.log('(слова: порожньо — жодного слова запиту немає в жодному фрагменті)');
}

async function golden() {
  const entries = readFileSync('docs/lab2/golden/queries.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Entry);
  console.log('| id | tags | must_cite | ранг: вектор | слова | RRF | косинус топ-1 | збігів слів |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const e of entries) {
    const r = await hybridSearch(index, words, embedder, e.query);
    const show = (n: number | null) => (n === null ? '—' : String(n));
    const ranks = e.must_cite.length === 0
      ? '— | — | —'
      : `${show(rankOf(r.vector, e.must_cite))} | ${show(rankOf(r.words, e.must_cite))} | ${show(rankOf(r.fused, e.must_cite))}`;
    console.log(`| ${e.id} | ${e.tags.join(', ')} | ${e.must_cite.join(', ') || '—'} | ${ranks} | ${(r.vector[0]?.score ?? 0).toFixed(4)} | ${r.words.length} |`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--golden') return golden();
  const query = args.find((a) => !a.startsWith('--'));
  if (!query) throw new Error('вкажіть запит: npx tsx scripts/search.ts "<запит>" [--explain]');
  const r = await hybridSearch(index, words, embedder, query);
  if (args.includes('--explain')) {
    explain(r);
    console.log('');
  }
  for (const h of r.hits) {
    const v = h.rankVector ?? '—';
    const w = h.rankWords ?? '—';
    console.log(`${renderCitation(toCitation(h.chunk, ''))}  (rrf ${h.rrf.toFixed(5)}, cos ${h.cosine.toFixed(4)}, вектор ${v}, слова ${w})`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
