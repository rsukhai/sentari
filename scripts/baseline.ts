/**
 * Базова лінія без пошуку (крок 01). Модель отримує ЛИШЕ текст питання — жодного документа.
 *
 *   npx tsx --env-file=.env.local scripts/baseline.ts docs/lab2/golden/queries.jsonl
 *       ХОДИТЬ У МЕРЕЖУ (OpenAI, платно — центи): відповіді й usage → docs/lab2/baseline-run.jsonl
 *   npx tsx scripts/baseline.ts summary
 *       без мережі: baseline-run.jsonl + оцінки docs/lab2/baseline-grades.jsonl → таблиці для baseline.md
 *
 * Обвʼязка — та сама, що в Лаб. 1: chatCompletionsModel з src/agent/adapters.ts і priceUsd з src/cost.ts.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { chatCompletionsModel, type Fetch } from '../src/agent/adapters';
import { priceUsd } from '../src/cost';
import { CATALOG } from '../src/models';
import { summarize, summaryTable, VERDICTS, type Grade, type RunRecord } from '../src/rag/eval';
import type { Entry } from './validate-golden';

const RUN_FILE = 'docs/lab2/baseline-run.jsonl';
const GRADES_FILE = 'docs/lab2/baseline-grades.jsonl';
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

  const records: RunRecord[] = [];
  for (const entry of await readJsonl<Entry>(file)) {
    const started = Date.now();
    const turn = await model(BASELINE_SYSTEM, [{ role: 'user', text: entry.query }], []);
    const latencyMs = Date.now() - started;
    records.push({
      id: entry.id,
      tags: entry.tags,
      query: entry.query,
      answer: turn.text,
      cited: [],
      usage: turn.usage,
      usd: priceUsd(SPEC, turn.usage),
      latencyMs,
    });
    console.log(`${entry.id}  ${String(latencyMs).padStart(6)} мс  ${turn.usage.inputTokens}/${turn.usage.outputTokens} ток.`);
  }
  await writeFile(RUN_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  console.log(`\n${records.length} відповідей → ${RUN_FILE} · модель ${SPEC.id} · ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Далі: оцінки у ${GRADES_FILE}, потім npx tsx scripts/baseline.ts summary`);
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
  console.log(`\n${summaryTable(s, 'Базова лінія')}`);
  if (s.ungraded.length > 0) console.error(`\nбез оцінки: ${s.ungraded.join(', ')}`);
}

const arg = process.argv[2] ?? 'docs/lab2/golden/queries.jsonl';
(arg === 'summary' ? summary() : run(arg)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
