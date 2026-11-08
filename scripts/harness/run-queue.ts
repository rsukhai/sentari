/**
 * Черга фабрики (Лаб. 3, крок 00): одна задача або всі. Готує git worktree на окремій гілці, викликає виконавця,
 * відбирає артефакт у docs/lab3/runs/ і прибирає дерево. НІЧОГО НЕ ПУШИТЬ: за AGENTS.md пуш — лише з дозволу власника,
 * тому наприкінці друкується одна команда push для створених гілок harness/*.
 *
 *   npx tsx scripts/harness/run-queue.ts                              усі задачі docs/lab3/tasks.jsonl
 *   npx tsx scripts/harness/run-queue.ts docs/lab3/tasks.jsonl --id t-01   одна задача за id (перезапуск)
 *   npx tsx scripts/harness/run-queue.ts --base main                  від якої гілки створювати дерево (типово main)
 *
 * ХОДИТЬ У МЕРЕЖУ й ВИТРАЧАЄ ГРОШІ (Claude Code -p): стеля кожної задачі — budget.max_usd у черзі.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { claudeRunner, HARNESS_MODEL, NOT_PART_OF_PATCH, runTask, type RunRecord, type Task } from './run-task';

const args = process.argv.slice(2);
const flag = (name: string): string | null => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null);
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]?.startsWith('--'))) ?? 'docs/lab3/tasks.jsonl';
const onlyId = flag('--id');
const base = flag('--base') ?? 'origin/main';

export function readTasks(path: string, only: string | null = null): Task[] {
  const tasks = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Task);
  return tasks.filter((t) => only === null || t.id === only);
}

const git = (a: string[], cwd = '.') => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

/** Стан основного checkout без того, що змінюється штатно (журнал агента, відібрані артефакти). */
function mainStatus(): string {
  return git(['status', '--porcelain', '--', '.', ':(exclude).agent-log', ':(exclude)docs/lab3/runs']);
}

/** Гілка harness/<id>; якщо вже існує — harness/<id>-r2, -r3 …: існуючу гілку не видаляємо і не перезаписуємо. */
function freeBranch(id: string): string {
  let n = 1;
  for (;;) {
    const name = n === 1 ? `harness/${id}` : `harness/${id}-r${n}`;
    const exists = git(['branch', '--list', name]) !== '';
    if (!exists) return name;
    n += 1;
  }
}

/** Локальний `main` легко залишити позаду origin/main (так сталося в прогоні 1 задачі t-08) — таку базу не приймаємо. */
export function assertFreshBase(ref: string, rev: (r: string) => string | null): void {
  const origin = rev('origin/main');
  const local = rev('main');
  if (ref === 'main' && origin !== null && local !== null && origin !== local) {
    throw new Error(`локальний main (${local.slice(0, 8)}) відрізняється від origin/main (${origin.slice(0, 8)}): використайте --base origin/main`);
  }
}

function main(): void {
  assertFreshBase(base, (r) => {
    try {
      return git(['rev-parse', '--verify', '-q', r]);
    } catch {
      return null;
    }
  });
  const tasks = readTasks(file, onlyId);
  if (tasks.length === 0) throw new Error(`у ${file} немає задач${onlyId ? ` з id ${onlyId}` : ''}`);
  const version = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim().split(' ')[0] ?? 'unknown';
  const agentPath = `claude-code@${version} model=${HARNESS_MODEL} (-p, dontAsk)`;
  const branches: string[] = [];

  for (const task of tasks) {
    const branch = freeBranch(task.id);
    const tree = resolve('..', 'harness-runs', `${task.id}-${Date.now()}`);
    const before = mainStatus();
    git(['worktree', 'add', '-b', branch, tree, base]);
    try {
      // node_modules спільний із основним checkout (npm ci у кожному дереві задорого); у патч він не потрапляє
      symlinkSync(resolve('node_modules'), join(tree, 'node_modules'), 'dir');
      const baseCommit = git(['rev-parse', 'HEAD'], tree);
      const rec = runTask(task, { runner: claudeRunner, agentPath, worktree: tree, outDir: 'runs' });

      // ізоляція: основний checkout після прогону має бути таким, як був до нього
      const isolated = mainStatus() === before;

      // гілка прогону: комітимо те, що зробив агент (без журналу агента й node_modules)
      git(['add', '-A', '--', '.', ...NOT_PART_OF_PATCH], tree);
      const staged = git(['diff', '--cached', '--stat'], tree) !== '';
      if (staged) git(['commit', '-m', `harness: ${task.id}`], tree);
      const commit = git(['rev-parse', 'HEAD'], tree);

      // доповнюємо run.json полями, відомими лише черзі
      const runJson = join(rec.artifact_dir, 'run.json');
      const full = {
        ...(JSON.parse(readFileSync(runJson, 'utf8')) as RunRecord),
        branch,
        base_ref: base,
        base_commit: baseCommit,
        branch_commit: commit,
        committed_changes: staged,
        main_checkout_unchanged: isolated,
      };
      writeFileSync(runJson, `${JSON.stringify(full, null, 2)}\n`, 'utf8');

      // відібраний артефакт — у репозиторій; сира runs/ лишається в .gitignore
      const keep = join('docs', 'lab3', 'runs', basename(rec.artifact_dir));
      mkdirSync(keep, { recursive: true });
      cpSync(rec.artifact_dir, keep, { recursive: true });

      branches.push(branch);
      console.log(
        `${task.id}: ${rec.exit_status}, acceptance ${rec.acceptance_passed ? 'pass' : 'fail'}, ` +
          `${rec.duration_s} с, $${rec.cost_usd_estimate ?? '?'} (оцінка), основний checkout ${isolated ? 'не змінено' : 'ЗМІНЕНО'} → ${keep}`,
      );
    } finally {
      if (existsSync(tree)) git(['worktree', 'remove', tree, '--force']);
    }
  }

  console.log(`\nГілки прогонів створено локально; відправка — за вашим дозволом:\n  git push -u origin ${branches.join(' ')}`);
}

if (process.argv[1]?.endsWith('run-queue.ts')) main();
