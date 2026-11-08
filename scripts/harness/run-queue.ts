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
 *
 * Зупинення (крок 03): ліміти задачі (ходи, гроші, таймаут) тримає виконавець; цикл харнеса додає
 *   --max-total-usd N     стеля витрат на весь запуск черги (типово HARNESS_MAX_TOTAL_USD або 1): наступну задачу, чия стеля
 *                         не вміщається в залишок, не беремо;
 *   --breaker-file F      стан circuit breaker між запусками (типово .harness/breaker.json);
 *   --cooldown-min N      перепочинок після open (типово 30; менше значення — лише для демонстрації).
 * Кожне спрацювання лишає рядок у docs/lab3/stop-log.jsonl.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { BREAKER_FILE, DEFAULT_BREAKER, decide, loadBreaker, record, saveBreaker, type BreakerConfig } from '../../src/harness/breaker';
import { appendStopLog, looksLikeQuota, taskStopRow } from '../../src/harness/stop';
import { claudeRunner, HARNESS_MODEL, NOT_PART_OF_PATCH, runTask, type RunRecord, type Task } from './run-task';

const args = process.argv.slice(2);
const flag = (name: string): string | null => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null);
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]?.startsWith('--'))) ?? 'docs/lab3/tasks.jsonl';
const onlyId = flag('--id');
const base = flag('--base') ?? 'origin/main';
const breakerFile = flag('--breaker-file') ?? BREAKER_FILE;
const capUsd = Number(flag('--max-total-usd') ?? process.env.HARNESS_MAX_TOTAL_USD ?? 1);
const cfg: BreakerConfig = { ...DEFAULT_BREAKER, cooldownMin: Number(flag('--cooldown-min') ?? DEFAULT_BREAKER.cooldownMin) };

/** Усе, що прогін надрукував: вивід агента і його журнал (для пошуку ознак квоти). */
function readOutputs(dir: string): string {
  return ['output.txt', 'agent.log'].map((f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '')).join('\n');
}

export function readTasks(path: string, only: string | null = null): Task[] {
  const tasks = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Task);
  return tasks.filter((t) => only === null || t.id === only);
}

const git = (a: string[], cwd = '.') => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

/** Стан основного checkout без того, що змінюється штатно (журнал агента, документи й артефакти Лаб. 3, які пишу я сам). */
function mainStatus(): string {
  return git(['status', '--porcelain', '--', '.', ':(exclude).agent-log', ':(exclude)docs/lab3']);
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
  let spent = 0;
  if (!Number.isFinite(capUsd) || capUsd <= 0) throw new Error(`--max-total-usd має бути додатним числом, отримано ${capUsd}`);

  for (const [i, task] of tasks.entries()) {
    const rest = tasks
      .slice(i)
      .map((t) => t.id)
      .join(', ');

    // шар харнеса 1: circuit breaker (стан у файлі, не в змінній процесу)
    const state = loadBreaker(breakerFile, cfg);
    const d = decide(state, new Date(), cfg);
    if (!d.allow) {
      appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_open', configured: state.trip, observed: null, action: `черга зупинена, не запущено: ${rest}` });
      console.log(`\nБРЕЙКЕР: ${d.why}. Не запущено: ${rest}`);
      break;
    }
    if (d.transition === 'half-open') {
      saveBreaker(d.next, breakerFile);
      appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_half_open', configured: state.cooldown_min, observed: null, action: 'перепочинок минув; рівно одна пробна задача' });
      console.log(`${task.id}: ${d.why}`);
    }

    // шар харнеса 2: стеля витрат на запуск черги
    if (spent + task.budget.max_usd > capUsd) {
      appendStopLog({ at: new Date().toISOString(), layer: 'queue', task_id: task.id, limit: 'queue_spend_cap', configured: capUsd, observed: Math.round(spent * 1e4) / 1e4, action: `задача не взята: її стеля $${task.budget.max_usd} не вміщається в залишок; не запущено: ${rest}` });
      console.log(`\nСТЕЛЯ ВИТРАТ $${capUsd}: витрачено $${spent.toFixed(4)}, наступна задача ${task.id} має стелю $${task.budget.max_usd}. Не запущено: ${rest}. Продовжити можна лише з вашої згоди (--max-total-usd).`);
      break;
    }

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
      spent += rec.cost_usd_estimate ?? 0;

      // шар задачі: який ліміт спрацював, і що харнес зробив далі
      const quota = rec.exit_status !== 'ok' && looksLikeQuota(readOutputs(rec.artifact_dir));
      const accepted = rec.exit_status === 'ok' && rec.acceptance_passed;
      const key = quota ? 'quota' : rec.exit_status !== 'ok' ? rec.exit_status : 'acceptance_failed';
      const recorded = record(loadBreaker(breakerFile, cfg), { ok: accepted, key, quota }, new Date(), cfg);
      saveBreaker(recorded.next, breakerFile);

      const stop = taskStopRow(rec, task, 'задачу позначено в run.json, рядок дописано в журнал; черга йде далі, якщо брейкер лишився закритим');
      if (stop) appendStopLog({ ...stop, run_dir: keep });
      if (recorded.transition === 'open') {
        appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_open', configured: recorded.trip, observed: recorded.next.opens, action: `брейкер відкрито на ${recorded.next.cooldown_min} хв; наступні задачі не запускаються` });
        console.log(`БРЕЙКЕР ВІДКРИТО: ${recorded.trip}`);
      }
      if (recorded.transition === 'closed') {
        appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_closed', configured: null, observed: null, action: 'пробна задача зелена; брейкер закрито' });
        console.log('БРЕЙКЕР ЗАКРИТО: пробна задача зелена');
      }
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
