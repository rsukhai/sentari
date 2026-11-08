/**
 * Прогін банку задач: k спроб на задачу, кожна — у новому git worktree (Лаб. 3, крок 04). ХОДИТЬ У МЕРЕЖУ й ВИТРАЧАЄ ГРОШІ.
 *
 *   HARNESS_MODEL=haiku npx tsx scripts/evals/run-evals.ts [--max-total-usd 5] [--only-bucket regression] [--id t-01]
 *
 * k: EVAL_K (типово 3) для regression і new, EVAL_K_EDGE (типово 1) для edge — узгоджено з власником через ліміт витрат.
 * Кожна спроба лишає теку docs/lab3/evals-runs/<id>-a<n>/ (patch.diff, output.txt, journal.jsonl, run.json). Уже наявна тека
 * пропускається: так перервений прогін продовжується без повторної оплати. Журнал evals.jsonl не пишеться тут:
 * його відтворює regrade.ts з теки спроб (той самий код оцінює і локально, і в CI).
 *
 * Чисте середовище на КОЖНУ спробу: git worktree --detach (без гілки, тож нічого видаляти після не треба).
 * Усе, що зупиняє прогін (брейкер, стеля витрат, ліміти задачі), — ті самі шари, що в run-queue.ts (крок 03).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { BREAKER_FILE, DEFAULT_BREAKER, decide, loadBreaker, record, saveBreaker } from '../../src/harness/breaker';
import { appendStopLog, looksLikeQuota, taskStopRow } from '../../src/harness/stop';
import { assertFreshBase } from '../harness/run-queue';
import { claudeRunner, HARNESS_MODEL, NOT_PART_OF_PATCH, runTask } from '../harness/run-task';
import { ATTEMPTS_DIR, attemptDir, loadBank } from './lib';

const args = process.argv.slice(2);
const flag = (n: string): string | null => (args.includes(n) ? (args[args.indexOf(n) + 1] ?? null) : null);
const K = Number(process.env.EVAL_K ?? 3);
const K_EDGE = Number(process.env.EVAL_K_EDGE ?? 1);
const cap = Number(flag('--max-total-usd') ?? process.env.EVAL_MAX_USD ?? 5);
const base = flag('--base') ?? 'origin/main';
const onlyBucket = flag('--only-bucket');
const onlyId = flag('--id');

const git = (a: string[], cwd = '.') => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const outputs = (dir: string) => ['output.txt', 'agent.log'].map((f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : '')).join('\n');

function main(): void {
  assertFreshBase(base, (r) => {
    try {
      return git(['rev-parse', '--verify', '-q', r]);
    } catch {
      return null;
    }
  });
  if (!Number.isFinite(cap) || cap <= 0) throw new Error(`--max-total-usd має бути додатним числом, отримано ${cap}`);
  const tasks = loadBank().filter((t) => (onlyBucket === null || t.bucket === onlyBucket) && (onlyId === null || t.id === onlyId));
  if (tasks.length === 0) throw new Error('у банку немає задач за цим фільтром');
  const version = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim().split(' ')[0] ?? 'unknown';
  const agentPath = `claude-code@${version} model=${HARNESS_MODEL} (-p, dontAsk)`;
  mkdirSync(ATTEMPTS_DIR, { recursive: true });
  let spent = 0;
  let done = 0;

  outer: for (const task of tasks) {
    const k = task.bucket === 'edge' ? K_EDGE : K;
    for (let attempt = 1; attempt <= k; attempt += 1) {
      const keep = attemptDir(task.id, attempt);
      if (existsSync(join(keep, 'run.json'))) continue; // уже оплачена

      const state = loadBreaker(BREAKER_FILE, DEFAULT_BREAKER);
      const d = decide(state, new Date(), DEFAULT_BREAKER);
      if (!d.allow) {
        appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_open', configured: state.trip, observed: null, action: 'прогін evals зупинено брейкером' });
        console.log(`\nБРЕЙКЕР: ${d.why}. Прогін evals зупинено на ${task.id} спробі ${attempt}; решта спроб — після перепочинку.`);
        break outer;
      }
      if (d.transition === 'half-open') saveBreaker(d.next, BREAKER_FILE);
      if (spent + task.budget.max_usd > cap) {
        appendStopLog({ at: new Date().toISOString(), layer: 'queue', task_id: task.id, limit: 'queue_spend_cap', configured: cap, observed: Math.round(spent * 1e4) / 1e4, action: 'прогін evals зупинено стелею витрат' });
        console.log(`\nСТЕЛЯ ВИТРАТ $${cap}: витрачено $${spent.toFixed(4)}, наступна спроба ${task.id}#${attempt} має стелю $${task.budget.max_usd}. Продовжити можна лише з вашої згоди.`);
        break outer;
      }

      // ЧИСТЕ середовище на КОЖНУ спробу: друга спроба не бачить файлів першої
      const tree = resolve('..', 'eval-runs', `${task.id}-a${attempt}-${Date.now()}`);
      git(['worktree', 'add', '--detach', tree, base]);
      try {
        symlinkSync(resolve('node_modules'), join(tree, 'node_modules'), 'dir');
        const rec = runTask(task, { runner: claudeRunner, agentPath, worktree: tree, outDir: 'runs' });
        spent += rec.cost_usd_estimate ?? 0;
        mkdirSync(keep, { recursive: true });
        for (const f of ['patch.diff', 'output.txt', 'journal.jsonl', 'run.json']) {
          if (existsSync(join(rec.artifact_dir, f))) cpSync(join(rec.artifact_dir, f), join(keep, f));
        }
        done += 1;

        const quota = rec.exit_status !== 'ok' && looksLikeQuota(outputs(rec.artifact_dir));
        const accepted = rec.exit_status === 'ok' && rec.acceptance_passed;
        const key = quota ? 'quota' : rec.exit_status !== 'ok' ? rec.exit_status : 'acceptance_failed';
        const rec2 = record(loadBreaker(BREAKER_FILE, DEFAULT_BREAKER), { ok: accepted, key, quota }, new Date(), DEFAULT_BREAKER);
        saveBreaker(rec2.next, BREAKER_FILE);
        const stop = taskStopRow(rec, task, 'спробу evals позначено; прогін іде далі, якщо брейкер закритий');
        if (stop) appendStopLog({ ...stop, run_dir: keep });
        if (rec2.transition === 'open') {
          appendStopLog({ at: new Date().toISOString(), layer: 'breaker', task_id: task.id, limit: 'breaker_open', configured: rec2.trip, observed: rec2.next.opens, action: 'брейкер відкрито під час evals' });
          console.log(`БРЕЙКЕР ВІДКРИТО: ${rec2.trip}`);
        }
        console.log(`${task.id}#${attempt}: ${rec.exit_status}, acceptance ${rec.acceptance_passed ? 'pass' : 'fail'}, ${rec.duration_s} с, $${(rec.cost_usd_estimate ?? 0).toFixed(4)}; разом $${spent.toFixed(4)}`);
      } finally {
        if (existsSync(tree)) git(['worktree', 'remove', tree, '--force']);
      }
    }
  }
  console.log(`\nНових спроб: ${done}, витрачено $${spent.toFixed(4)} (оцінка). Далі: npx tsx scripts/evals/regrade.ts`);
}

if (process.argv[1]?.endsWith('run-evals.ts')) main();
