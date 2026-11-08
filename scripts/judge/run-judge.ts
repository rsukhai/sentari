/**
 * Прогін судді на розмічених випадках (Лаб. 3, крок 05). ХОДИТЬ У МЕРЕЖУ (OpenAI, платно — центи).
 *
 *   npx tsx --env-file=<файл секретів> scripts/judge/run-judge.ts --rubric docs/lab3/rubric/before.md --out docs/lab3/verdicts/judge-before.jsonl
 *
 * Один вимір — один суддя: на кожен випадок окремий запит, у системному промпті — спільна преамбула рубрики й РІВНО ОДИН розділ
 * (`## <вимір>`). Суддя не бачить ні моєї розмітки, ні інших випадків. Порівнянь двох варіантів тут немає, тому позиційного
 * зміщення міряти нема чого: поле `order` лишається порожнім (див. docs/lab3/judge.md, «Чесні межі»).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { judgeCriterion, prepareDiff } from '../../src/verify/judge';
import { openAiJudge } from '../../src/verify/openai';
import { assertOtherFamily, executorProvider, taskContext } from '../../src/verify/task';
import { loadTasks } from '../harness/verify-task';

export interface JudgeCase {
  readonly case_id: string;
  readonly artifact: string;
  readonly task: string;
  readonly criterion: string;
  readonly dimension: string;
  readonly mine: 'pass' | 'fail' | 'unknown';
  readonly reason: string;
  readonly holdout: boolean;
  readonly hesitant?: boolean;
}

/** Рубрика: преамбула до першого `## ` і розділи за виміром. */
export function parseRubric(text: string): { preamble: string; sections: Map<string, string> } {
  const parts = text.split(/^## /m);
  const sections = new Map<string, string>();
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n');
    sections.set(p.slice(0, nl).trim(), `## ${p}`.trim());
  }
  return { preamble: (parts[0] ?? '').trim(), sections };
}

export const EMPTY_DIFF = '(diff порожній: агент не змінив жодного файлу)';

const flag = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
};

async function main(): Promise<void> {
  const rubricFile = flag('--rubric') ?? 'docs/lab3/rubric/before.md';
  const out = flag('--out') ?? 'docs/lab3/verdicts/judge.jsonl';
  const casesFile = flag('--cases') ?? 'docs/lab3/judge-cases.jsonl';
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: ключ передає людина (--env-file)');
  const judge = openAiJudge(key, process.env.VERIFY_MODEL ?? 'gpt-5.6-terra');
  assertOtherFamily(executorProvider('claude-code'), judge.provider);

  const rubric = parseRubric(readFileSync(rubricFile, 'utf8'));
  const cases = readFileSync(casesFile, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as JudgeCase);
  const tasks = new Map(loadTasks('docs/lab3/tasks.jsonl').map((t) => [t.id, t]));
  const readHead = (p: string): string | null => (existsSync(p) ? readFileSync(p, 'utf8') : null);

  const rows: string[] = [];
  for (const c of cases) {
    const task = tasks.get(c.task);
    const crit = task?.criteria?.find((x) => x.id === c.criterion);
    const section = rubric.sections.get(c.dimension);
    if (!task || !crit) throw new Error(`${c.case_id}: немає критерію ${c.task}/${c.criterion} у tasks.jsonl`);
    if (!section) throw new Error(`${c.case_id}: у рубриці немає виміру ${c.dimension}`);
    const raw = readFileSync(join(c.artifact, 'patch.diff'), 'utf8');
    const diff = raw.trim() === '' ? EMPTY_DIFF : prepareDiff(raw).text;
    console.error(`${c.case_id} ${c.dimension} …`);
    const v = await judgeCriterion(judge.ask, { id: crit.id, statement: crit.statement, check: 'за diff зміни, текстом завдання і довідкою' }, diff, taskContext(task, readHead), `${rubric.preamble}\n\n${section}`);
    rows.push(JSON.stringify({ case_id: c.case_id, dimension: c.dimension, verdict: v.verdict, reason: v.reason, evidence: v.evidence, model: judge.modelId, rubric: rubricFile, order: '' }));
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${rows.join('\n')}\n`, 'utf8');
  const u = judge.usage();
  console.log(`Суддя: ${rows.length} вердиктів → ${out} · рубрика ${rubricFile} · токени ${u.inputTokens}/${u.outputTokens} · $${judge.costUsd().toFixed(4)}`);
}

if (process.argv[1]?.endsWith('run-judge.ts')) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  });
}
