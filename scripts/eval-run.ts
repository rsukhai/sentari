/**
 * Прогін з пошуком (крок 06) — КОПІЯ scripts/baseline.ts: та сама модель, системний промпт і формат;
 * змінено одне — перед питанням у повідомлення додано знайдений контекст (топ-5 гібридного пошуку).
 *
 *   npx tsx --env-file=.env.local scripts/eval-run.ts docs/lab2/golden/queries.jsonl
 *       ХОДИТЬ У МЕРЕЖУ (Ollama + OpenAI, платно — центи): відповіді, hits і usage → docs/lab2/eval-run.jsonl
 *   npx tsx scripts/eval-run.ts summary
 *       без мережі: eval-run.jsonl + оцінки docs/lab2/eval-grades.jsonl → таблиці для eval-report.md
 *
 * Обвʼязка — та сама, що в Лаб. 1: chatCompletionsModel з src/agent/adapters.ts і priceUsd з src/cost.ts.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { chatCompletionsModel, type Fetch } from '../src/agent/adapters';
import { priceUsd } from '../src/cost';
import { CATALOG } from '../src/models';
import { mean, recallAtK, reciprocalRank, transitions, type Hit } from '../src/metrics';
import { contextBlock, REFUSAL, refusedByRetrieval } from '../src/rag/answer';
import { citedIds } from '../src/rag/cite';
import { ollamaEmbedder } from '../src/rag/embed';
import { summarize, summaryTable, VERDICTS, type Grade, type RunRecord } from '../src/rag/eval';
import { bm25From, hybridSearch } from '../src/rag/search';
import { loadIndex } from '../src/rag/store';
import type { Entry } from './validate-golden';

const RUN_FILE = 'docs/lab2/eval-run.jsonl';
const GRADES_FILE = 'docs/lab2/eval-grades.jsonl';
const BASELINE_GRADES = 'docs/lab2/baseline-grades.jsonl';
/** Те саме k, що в застосунку (hybridSearch, топ-5). */
const K = 5;
// Модель зі специфікації (розділ 7); як і крок 11 Лаб. 1 — рядок каталогу, бо жодна роль на неї не вказує.
const SPEC = CATALOG['gpt-5.6-luna'];

/** Дослівно цей промпт стоїть у baseline.md; на кроці 06 до нього додаються лише документи. */
export const BASELINE_SYSTEM =
  'You are an assistant for car drivers who ask about on-board diagnostics, engine sensors and emission systems. ' +
  'Answer the question briefly and factually. If you do not know the answer, say so plainly instead of guessing.';

const readJsonl = async <T>(file: string): Promise<T[]> =>
  (await readFile(file, 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);

async function run(file: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: заповніть .env.local');
  // без інструментів OpenAI не приймає порожній tools; reasoning_effort: 'none' — як у Лаб. 1
  const plain: Fetch = (url, init) => {
    const { tools: _tools, ...body } = JSON.parse(String(init.body)) as Record<string, unknown>;
    return fetch(url, { ...init, body: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
  };
  const model = chatCompletionsModel({
    url: 'https://api.openai.com/v1/chat/completions',
    model: SPEC.id,
    headers: { authorization: `Bearer ${key}` },
    fetch: plain,
  });

  const embedder = ollamaEmbedder();
  const index = loadIndex('data/index.json', embedder);
  const words = bm25From(index);

  const records: RunRecord[] = [];
  for (const entry of await readJsonl<Entry>(file)) {
    const started = Date.now();
    // ЄДИНА змістова відмінність від baseline.ts: знайдений контекст перед питанням
    const { hits } = await hybridSearch(index, words, embedder, entry.query, K);
    const turn = refusedByRetrieval(hits)
      ? { text: REFUSAL, calls: [], usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 } }
      : await model(BASELINE_SYSTEM, [{ role: 'user', text: contextBlock(hits) + entry.query }], []);
    const latencyMs = Date.now() - started;
    records.push({
      id: entry.id,
      tags: entry.tags,
      query: entry.query,
      answer: turn.text,
      cited: [...new Set(citedIds(turn.text).map((id) => id.split('#')[0] ?? ''))],
      hits: hits.map((h) => h.chunk.id),
      usage: turn.usage,
      usd: priceUsd(SPEC, turn.usage),
      latencyMs,
    });
    console.log(`${entry.id}  ${String(latencyMs).padStart(6)} мс  ${turn.usage.inputTokens}/${turn.usage.outputTokens} ток.`);
  }
  await writeFile(RUN_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  console.log(`\n${records.length} відповідей → ${RUN_FILE} · модель ${SPEC.id} · ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Далі: оцінки у ${GRADES_FILE}, потім npx tsx scripts/eval-run.ts summary`);
}

async function summary() {
  const records = await readJsonl<RunRecord>(RUN_FILE);
  const grades = await readJsonl<Grade>(GRADES_FILE).catch(() => [] as Grade[]);
  for (const g of grades) {
    if (!VERDICTS.includes(g.verdict)) throw new Error(`${g.id}: невідомий вердикт «${g.verdict}»`);
  }
  const byId = new Map(grades.map((g) => [g.id, g]));
  const cell = (s: string, n: number) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, n);

  console.log('| id | tags | вердикт | що відповіла модель (коротко) | коментар |');
  console.log('|---|---|---|---|---|');
  for (const r of records) {
    const g = byId.get(r.id);
    console.log(`| ${r.id} | ${r.tags.join(', ')} | ${g?.verdict ?? '?'} | ${cell(r.answer, 160)} | ${cell(g?.note ?? '', 200)} |`);
  }
  const s = summarize(records, grades);
  console.log(`\n${summaryTable(s, 'З пошуком')}`);
  if (s.ungraded.length > 0) console.error(`\nбез оцінки: ${s.ungraded.join(', ')}`);

  // метрики пошуку — лише для запитів із непорожнім must_cite; у базовій лінії їх немає за побудовою
  const golden = new Map((await readJsonl<Entry>('docs/lab2/golden/queries.jsonl')).map((e) => [e.id, e]));
  const answerable = records.filter((r) => (golden.get(r.id)?.must_cite.length ?? 0) > 0);
  const hitsOf = (r: RunRecord): Hit[] => (r.hits ?? []).map((chunkId) => ({ chunkId, docId: chunkId.split('#')[0] ?? '' }));
  const must = (r: RunRecord) => golden.get(r.id)?.must_cite ?? [];
  const citedRight = answerable.filter((r) => byId.get(r.id)?.citationCorrect === true).length;
  console.log(`| Частка відповідей із правильною цитатою | ${Math.round((100 * citedRight) / answerable.length)}% (${citedRight} із ${answerable.length}) |`);
  console.log(`| recall@${K} (n = ${answerable.length}) | ${mean(answerable.map((r) => recallAtK(hitsOf(r), must(r), K))).toFixed(2)} |`);
  console.log(`| MRR@${K} (n = ${answerable.length}) | ${mean(answerable.map((r) => reciprocalRank(hitsOf(r), must(r), K))).toFixed(2)} |`);

  const base = await readJsonl<Grade>(BASELINE_GRADES);
  const before = Object.fromEntries(base.map((g) => [g.id, g.verdict]));
  const after = Object.fromEntries(grades.map((g) => [g.id, g.verdict]));
  console.log('\n| було | стало | скільки | запити |\n|---|---|---|---|');
  for (const t of transitions(before, after)) console.log(`| ${t.from} | ${t.to} | ${t.ids.length} | ${t.ids.join(', ')} |`);
}

const arg = process.argv[2] ?? 'docs/lab2/golden/queries.jsonl';
(arg === 'summary' ? summary() : run(arg)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
