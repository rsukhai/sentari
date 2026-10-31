/**
 * Верифікатор на іншій моделі (Лаб. 2, крок 03). ХОДИТЬ У МЕРЕЖУ (OpenAI, платно — центи):
 *
 *   bash scripts/lab2/make-diff.sh main...HEAD > docs/lab2/verify-input.diff
 *   npm run verify                                  (= tsx scripts/verify.ts docs/lab2/verify-input.diff)
 *   npx tsx scripts/verify.ts <diff> --json <звіт.json>   те саме + звіт для калібрування
 *
 * Ключ — OPENAI_API_KEY (локально з файлу секретів через --env-file, у CI — секрет репозиторію).
 * Модель — VERIFY_MODEL (типово gpt-5.6-terra): інший провайдер, ніж Claude, що пише код.
 * Код виходу 1, якщо хоч один критерій fail.
 */
import { readFile, writeFile } from 'node:fs/promises';

import { chatCompletionsModel, type Fetch } from '../src/agent/adapters';
import { addUsage, priceUsd, ZERO_USAGE } from '../src/cost';
import { CATALOG } from '../src/models';
import { parseDocTable } from '../src/rag/corpus';
import { judgeCriterion, parseCriteria, prepareDiff, type Ask } from '../src/verify/judge';
import { isBlocked, verifyReport, type VerifyReport } from '../src/verify/schema';

const SPEC = 'docs/lab2/spec.md';
const DEFAULT_MODEL = 'gpt-5.6-terra';

async function main() {
  const [diffFile = 'docs/lab2/verify-input.diff', flag, jsonOut] = process.argv.slice(2);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: локально — через --env-file, у CI — секрет репозиторію');

  const modelId = process.env.VERIFY_MODEL ?? DEFAULT_MODEL;
  const spec = Object.values(CATALOG).find((s) => s.id === modelId);
  if (!spec || spec.provider !== 'openai') throw new Error(`VERIFY_MODEL «${modelId}» немає серед моделей OpenAI у src/models.ts`);

  const specMd = await readFile(SPEC, 'utf8');
  const criteria = parseCriteria(specMd);
  if (criteria.length === 0) throw new Error(`у ${SPEC} не знайдено критеріїв приймання (розділ 6)`);
  const docIds = parseDocTable(specMd).map((d) => d.id);
  const context = `таблиця розділу 2 spec.md — ${docIds.length} документів колекції, файл кожного — data/obd/<id>.md: ${docIds.join(', ')}`;
  const { text: diff, dropped } = prepareDiff(await readFile(diffFile, 'utf8'));
  if (diff.trim() === '') throw new Error(`${diffFile}: порожній diff — нема що перевіряти`);

  // без інструментів OpenAI не приймає порожній tools; відповідь — JSON-обʼєкт
  const jsonOnly: Fetch = (url, init) => {
    const { tools: _tools, ...body } = JSON.parse(String(init.body)) as Record<string, unknown>;
    return fetch(url, { ...init, body: JSON.stringify({ ...body, response_format: { type: 'json_object' } }) });
  };
  const model = chatCompletionsModel({
    url: 'https://api.openai.com/v1/chat/completions',
    model: spec.id,
    headers: { authorization: `Bearer ${key}` },
    fetch: jsonOnly,
  });
  let usage = ZERO_USAGE;
  const ask: Ask = async (system, user) => {
    const turn = await model(system, [{ role: 'user', text: user }], []);
    usage = addUsage(usage, turn.usage);
    return turn.text;
  };

  // один вимір — один суддя: окремий запит на кожен критерій
  const results = [];
  for (const c of criteria) results.push(await judgeCriterion(ask, c, diff, context));
  const report: VerifyReport = verifyReport.parse({ results });

  const cell = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|');
  console.log(`Верифікатор: ${spec.id} · критеріїв ${criteria.length} · diff ${diffFile}`);
  if (dropped.length > 0) console.log(`Не надіслано (секрети): ${dropped.join(', ')}`);
  console.log('\n| id | verdict | reason | evidence |\n|---|---|---|---|');
  for (const r of report.results) console.log(`| ${r.id} | ${r.verdict} | ${cell(r.reason)} | ${cell(r.evidence)} |`);
  console.log(`\nТокени ${usage.inputTokens} / ${usage.outputTokens} · $${priceUsd(spec, usage).toFixed(4)}`);

  if (flag === '--json' && jsonOut) {
    await writeFile(jsonOut, `${JSON.stringify({ model: spec.id, diff: diffFile, ...report }, null, 2)}\n`, 'utf8');
  }
  if (isBlocked(report)) {
    console.error(`\nБРАМА ЧЕРВОНА: fail — ${report.results.filter((r) => r.verdict === 'fail').map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
  console.log('\nБрама зелена: fail немає');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
