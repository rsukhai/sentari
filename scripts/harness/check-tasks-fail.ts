/**
 * Перевірка черги без агента (Лаб. 3, крок 00): на ЧИСТІЙ базі приймання кожної задачі має падати —
 * інакше задачу «виконано» ще до роботи агента, і acceptance нічого не доводить.
 *
 *   npx tsx scripts/harness/check-tasks-fail.ts [docs/lab3/tasks.jsonl] [--base origin/main]
 *
 * Мережі й грошей не потребує. Дерево тимчасове (--detach), знімається наприкінці.
 */
import { execFileSync } from 'node:child_process';
import { symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readTasks } from './run-queue';
import { checkAcceptance } from './run-task';

const args = process.argv.slice(2);
const base = args.includes('--base') ? (args[args.indexOf('--base') + 1] ?? 'origin/main') : 'origin/main';
const file = args.find((a) => a.endsWith('.jsonl')) ?? 'docs/lab3/tasks.jsonl';

const git = (a: string[], cwd = '.') => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

const tree = resolve('..', 'harness-runs', `check-${Date.now()}`);
git(['worktree', 'add', '--detach', tree, base]);
let bad = 0;
try {
  symlinkSync(resolve('node_modules'), join(tree, 'node_modules'), 'dir');
  console.log(`база ${base} @ ${git(['rev-parse', '--short', 'HEAD'], tree)}`);
  for (const task of readTasks(file)) {
    const results = checkAcceptance(task, tree);
    const failed = results.filter((r) => r.exit !== 0);
    const ok = failed.length > 0;
    if (!ok) bad += 1;
    console.log(`${task.id}: ${ok ? 'падає (правильно)' : 'ПРОХОДИТЬ ДО РОБОТИ АГЕНТА'} — ${failed.length} з ${results.length} команд`);
  }
} finally {
  git(['worktree', 'remove', tree, '--force']);
}
if (bad > 0) {
  console.error(`${bad} задач(і) не мають приймання, яке падає на чистій базі`);
  process.exit(1);
}
