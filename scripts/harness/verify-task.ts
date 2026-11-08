/**
 * Верифікатор задачі фабрики — остання брама (Лаб. 3, крок 02). ХОДИТЬ У МЕРЕЖУ (OpenAI, платно — центи).
 *
 *   # CI і ручний запуск на гілці прогону: diff = комміт «harness: <id>» і все, що після нього
 *   npx tsx scripts/harness/verify-task.ts --task t-08 --head <sha>
 *   # готовий diff
 *   npx tsx scripts/harness/verify-task.ts --task t-08 --diff docs/lab3/runs/<прогін>/patch.diff
 *   # калібрування: усі розмічені випадки з файлу розмітки
 *   npx tsx scripts/harness/verify-task.ts --calibrate docs/lab3/verifier/labels.jsonl --out docs/lab3/verifier/judge-run.jsonl
 *
 * Ключ — OPENAI_API_KEY (локально його передає людина, у CI — секрет репозиторію). Модель — VERIFY_MODEL (типово gpt-5.6-terra).
 * Виконавець — Claude Code (Anthropic), верифікатор — інша родина; та сама родина → відмова.
 * Код виходу: 0 — усі критерії pass; 1 — хоч один критерій не pass (unknown теж); 2 — помилка запуску або схеми.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { judgeCriterion, prepareDiff } from '../../src/verify/judge';
import { openAiJudge, type OpenAiJudge } from '../../src/verify/openai';
import { isBlockedStrict, verifyReport, type VerifyReport } from '../../src/verify/schema';
import { assertOtherFamily, executorProvider, TASK_JUDGE_SYSTEM, taskContext, taskCriteria } from '../../src/verify/task';
import type { Task } from './run-task';

const DEFAULT_MODEL = 'gpt-5.6-terra';

const flag = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
};

const git = (a: string[]): string => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Черга задач: JSONL, по задачі на рядок (той самий формат, що читає run-queue). */
export function loadTasks(path: string): Task[] {
  return readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Task);
}

/** Diff прогону: від батька комміту «harness: <id>» до head — сам прогін і виправлення після нього, без бази. */
export function harnessDiff(taskId: string, head: string): { diff: string; harnessCommit: string } {
  const harnessCommit = git(['log', `--grep=^harness: ${taskId}$`, '-1', '--format=%H', head]).trim();
  if (!harnessCommit) throw new Error(`в історії ${head} немає комміту «harness: ${taskId}»`);
  return { diff: git(['diff', `${harnessCommit}^`, head]), harnessCommit };
}

const readHead = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf8') : null);

function setup(): OpenAiJudge {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: локально його передає людина, у CI — секрет репозиторію');
  const judge = openAiJudge(key, process.env.VERIFY_MODEL ?? DEFAULT_MODEL);
  assertOtherFamily(executorProvider(flag('--executor') ?? 'claude-code'), judge.provider);
  return judge;
}

const cell = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|');

async function verifyOne(task: Task, diffText: string, judge: OpenAiJudge): Promise<VerifyReport> {
  const { text: diff, dropped } = prepareDiff(diffText);
  if (dropped.length > 0) console.log(`Не надіслано (секрети): ${dropped.join(', ')}`);
  if (diff.trim() === '') throw new Error(`${task.id}: порожній diff — нема що перевіряти`);
  const context = taskContext(task, readHead);
  const results = [];
  // один вимір — один суддя: окремий запит на кожен критерій
  for (const c of taskCriteria(task)) results.push(await judgeCriterion(judge.ask, c, diff, context, TASK_JUDGE_SYSTEM));
  return verifyReport.parse({ results });
}

interface Label {
  readonly case: string;
  readonly task: string;
  readonly run_dir: string;
  readonly criterion: string;
}

async function calibrate(labelsFile: string, tasksFile: string): Promise<void> {
  const judge = setup();
  const out = flag('--out') ?? 'docs/lab3/verifier/judge-run.jsonl';
  const labels = readFileSync(labelsFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Label);
  const tasks = new Map(loadTasks(tasksFile).map((t) => [t.id, t]));
  const byRun = new Map<string, VerifyReport>();
  for (const l of labels) {
    const key = `${l.task}|${l.run_dir}`;
    if (byRun.has(key)) continue;
    const task = tasks.get(l.task);
    if (!task) throw new Error(`${l.case}: задачі ${l.task} немає в ${tasksFile}`);
    console.error(`${l.task} · ${l.run_dir} …`);
    byRun.set(key, await verifyOne(task, readFileSync(join('docs/lab3/runs', l.run_dir, 'patch.diff'), 'utf8'), judge));
  }
  const rows = labels.map((l) => {
    const r = byRun.get(`${l.task}|${l.run_dir}`)?.results.find((x) => x.id === l.criterion);
    if (!r) throw new Error(`${l.case}: суддя не повернув вердикт для ${l.criterion}`);
    return JSON.stringify({ case: l.case, task: l.task, run_dir: l.run_dir, criterion: l.criterion, verdict: r.verdict, reason: r.reason, evidence: r.evidence, model: judge.modelId });
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${rows.join('\n')}\n`, 'utf8');
  const u = judge.usage();
  console.log(`Калібрування: ${rows.length} вердиктів → ${out} · токени ${u.inputTokens} / ${u.outputTokens} · $${judge.costUsd().toFixed(4)}`);
}

async function main(): Promise<void> {
  const tasksFile = flag('--tasks') ?? 'docs/lab3/tasks.jsonl';
  const labelsFile = flag('--calibrate');
  if (labelsFile) return calibrate(labelsFile, tasksFile);

  const taskId = flag('--task');
  if (!taskId) throw new Error('вкажіть --task <id> (і --head <sha> або --diff <файл>), або --calibrate <labels.jsonl>');
  const task = loadTasks(tasksFile).find((t) => t.id === taskId);
  if (!task) throw new Error(`у ${tasksFile} немає задачі ${taskId}`);
  const diffFile = flag('--diff');
  const head = flag('--head');
  let source: string;
  let diffText: string;
  if (diffFile) {
    diffText = readFileSync(diffFile, 'utf8');
    source = diffFile;
  } else if (head) {
    const h = harnessDiff(taskId, head);
    diffText = h.diff;
    source = `${head.slice(0, 8)} (harness-комміт ${h.harnessCommit.slice(0, 8)})`;
  } else {
    throw new Error('вкажіть --head <sha> або --diff <файл>');
  }

  const judge = setup();
  const report = await verifyOne(task, diffText, judge);
  const u = judge.usage();
  console.log(`Верифікатор: ${judge.modelId} · задача ${taskId} · критеріїв ${report.results.length} · ${source}`);
  console.log('\n| id | verdict | reason | evidence |\n|---|---|---|---|');
  for (const r of report.results) console.log(`| ${r.id} | ${r.verdict} | ${cell(r.reason)} | ${cell(r.evidence)} |`);
  console.log(`\nТокени ${u.inputTokens} / ${u.outputTokens} · $${judge.costUsd().toFixed(4)}`);

  const dir = flag('--out') ?? 'docs/lab3/verdicts';
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${taskId}-${(head ?? 'diff').slice(0, 8)}.json`);
  const blocked = isBlockedStrict(report);
  writeFileSync(file, `${JSON.stringify({ model: judge.modelId, task: taskId, source, blocked, cost_usd: judge.costUsd(), ...report }, null, 2)}\n`, 'utf8');
  console.log(`Вердикти: ${file}`);

  if (blocked) {
    console.error(`\nБРАМА ЧЕРВОНА (не pass): ${report.results.filter((r) => r.verdict !== 'pass').map((r) => `${r.id}=${r.verdict}`).join(', ')}`);
    process.exit(1);
  }
  console.log('\nБрама зелена: усі критерії pass');
}

if (process.argv[1]?.endsWith('verify-task.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  });
}
