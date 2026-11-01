/**
 * Вимір паралельності (крок 07). ХОДИТЬ У МЕРЕЖУ (Ollama + OpenAI, платно — центи) — запускається вручну:
 *
 *   npx tsx --env-file=<файл секретів> scripts/parallel-eval.ts 1    «до»: послідовно
 *   npx tsx --env-file=<файл секретів> scripts/parallel-eval.ts 4    «після»: чотири гілки
 *
 * Та сама робота, що в scripts/eval-run.ts: пошук топ-5 + gpt-5.6-luna з BASELINE_SYSTEM і contextBlock.
 * Паралелиться ЧИТАННЯ (запити набору). Запис однопотоковий: гілки повертають результат у памʼять,
 * головний потік один раз після пулу дописує прогін у docs/lab2/parallel-run.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { chatCompletionsModel, type Fetch } from '../src/agent/adapters';
import { addUsage, priceUsd, ZERO_USAGE } from '../src/cost';
import { CATALOG } from '../src/models';
import { contextBlock, REFUSAL, refusedByRetrieval } from '../src/rag/answer';
import { ollamaEmbedder, type OllamaStats } from '../src/rag/embed';
import { BUDGET, runPool, type Budget } from '../src/rag/pool';
import { bm25From, hybridSearch } from '../src/rag/search';
import { loadIndex } from '../src/rag/store';
import type { Entry } from './validate-golden';

const K = 5;
const OUT = 'docs/lab2/parallel-run.json';
const SPEC = CATALOG['gpt-5.6-luna'];
/**
 * Дослівна копія BASELINE_SYSTEM зі scripts/baseline.ts: імпорт звідти запустив би сам прогін базової лінії
 * (baseline.ts виконує run() під час завантаження). Збіг перевіряє tests/lab2/pool.test.ts.
 */
export const BASELINE_SYSTEM =
  'You are an assistant for car drivers who ask about on-board diagnostics, engine sensors and emission systems. ' +
  'Answer the question briefly and factually. If you do not know the answer, say so plainly instead of guessing.';

interface BranchResult {
  readonly id: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly ms: number;
}

async function main() {
  const width = Number(process.argv[2] ?? 1);
  if (!Number.isInteger(width) || width < 1 || width > BUDGET.maxBranches) {
    throw new Error(`ширина ${process.argv[2]}: дозволено 1–${BUDGET.maxBranches} (BUDGET.maxBranches)`);
  }
  const budget: Budget = { ...BUDGET, maxBranches: width };
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: запускайте з --env-file');

  const ollama: OllamaStats[] = [];
  // лише лічильники: onStats отримує все тіло відповіді, разом із векторами
  const embedder = ollamaEmbedder(undefined, undefined, ({ total_duration, load_duration, prompt_eval_count }) => {
    ollama.push({ ...(total_duration !== undefined && { total_duration }), ...(load_duration !== undefined && { load_duration }), ...(prompt_eval_count !== undefined && { prompt_eval_count }) });
  });
  const index = loadIndex('data/index.json', embedder);
  const words = bm25From(index);
  // без інструментів OpenAI не приймає порожній tools; reasoning_effort: 'none' — як у baseline.ts
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

  const entries = readFileSync('docs/lab2/golden/queries.jsonl', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l) as Entry);

  let spent = 0;
  let usage = ZERO_USAGE;
  const tasks = entries.map((entry) => async (): Promise<BranchResult> => {
    const started = performance.now();
    const { hits } = await hybridSearch(index, words, embedder, entry.query, K);
    const turn = refusedByRetrieval(hits)
      ? { text: REFUSAL, calls: [], usage: ZERO_USAGE }
      : await model(BASELINE_SYSTEM, [{ role: 'user', text: contextBlock(hits) + entry.query }], []);
    spent += turn.usage.inputTokens + turn.usage.outputTokens;
    usage = addUsage(usage, turn.usage);
    return { id: entry.id, inputTokens: turn.usage.inputTokens, outputTokens: turn.usage.outputTokens, ms: Math.round(performance.now() - started) };
  });

  // ЧАС СТІНИ міряється саме тут — навколо пулу. Облік токенів часу не дає.
  const wallStart = performance.now();
  const { results, stoppedEarly } = await runPool(tasks, budget, () => spent);
  const wallMs = Math.round(performance.now() - wallStart);

  const ok = results.filter((r): r is BranchResult => r !== undefined && !(r instanceof Error));
  const failed = results.filter((r): r is Error => r instanceof Error);
  const ns = (k: keyof OllamaStats) => ollama.reduce((n, s) => n + (s[k] ?? 0), 0);
  const run = {
    runAt: new Date().toISOString(),
    width,
    budget,
    wallMs,
    sumBranchMs: ok.reduce((n, r) => n + r.ms, 0),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    usd: priceUsd(SPEC, usage),
    done: ok.length,
    failed: failed.map((e) => e.message),
    stoppedEarly,
    // лічильники Ollama (ембедінг запиту): наносекунди → мс
    ollama: {
      calls: ollama.length,
      totalDurationMs: Math.round(ns('total_duration') / 1e6),
      loadDurationMs: Math.round(ns('load_duration') / 1e6),
      promptEvalCount: ns('prompt_eval_count'),
      firstRaw: ollama[0] ?? null,
    },
    branches: ok,
  };

  // однопотоковий запис: прогін з тією самою шириною замінює попередній
  let file: { runs: (typeof run)[] } = { runs: [] };
  try {
    file = JSON.parse(readFileSync(OUT, 'utf8')) as typeof file;
  } catch {
    // файлу ще немає — перший прогін
  }
  file.runs = [...file.runs.filter((r) => r.width !== width), run].sort((a, b) => a.width - b.width);
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

  const { branches: _b, ollama: o, ...short } = run;
  console.log({ ...short, ollamaTotalMs: o.totalDurationMs, ollamaLoadMs: o.loadDurationMs, ollamaCalls: o.calls });
}

if (process.argv[1]?.endsWith('parallel-eval.ts')) main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
