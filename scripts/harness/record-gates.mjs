// Свідок ланцюга брам (Лаб. 3, крок 01): бере вердикти чотирьох брам і складає gate-record.json.
// Запускається в задачі `record` workflow gates.yml; без залежностей (лише node).
//
// Два джерела вердикту, і обидва потрібні:
//   --<брама>      needs.<job>.result — success | failure | cancelled | skipped: ФАКТ, є завжди, зокрема на впалій брамі;
//   --<брама>-out  needs.<job>.outputs.verdict — "pass" лише якщо брама дійшла до кінця свідомо; на впалій порожній.
// Вердикт беремо з result; outputs лише підтверджує зелений (confirmed). Червоний ніколи не читається з outputs.
//
// До run.json кроку 00 вердикти потрапляють окремо: локально `npx tsx scripts/harness/apply-gates.ts gate-record.json`
// (у CI-сховищі прогонів фабрики немає — вони живуть у docs/lab3/runs гілки lab3/*).
import { writeFileSync } from 'node:fs';

/**
 * GitHub дає success | failure | cancelled | skipped — зводимо до pass | fail | skipped.
 * @param {string | undefined} result
 * @returns {'pass' | 'fail' | 'skipped'}
 */
export function verdict(result) {
  if (result === 'success') return 'pass';
  if (result === 'skipped' || result === 'cancelled') return 'skipped';
  return 'fail';
}

/**
 * harness/t-07 → t-07; harness/t-07-r2 → t-07; будь-що інше (harness/red-…, lab3/…) → null.
 * @param {string | null | undefined} branch
 * @returns {string | null}
 */
export function taskIdFromBranch(branch) {
  const m = /^harness\/(t-\d{2})(?:-r\d+)?$/.exec(branch ?? '');
  return m ? m[1] : null;
}

const NAMES = ['types', 'lint', 'tests', 'build'];

/**
 * results/outputs: { types, lint, tests, build } → запис свідка.
 * @param {{ results: Record<string, string | undefined>, outputs?: Record<string, string | undefined>, branch?: string | null, sha?: string | null, runUrl?: string | null }} input
 */
export function buildRecord({ results, outputs = {}, branch = null, sha = null, runUrl = null }) {
  /** @type {Record<string, 'pass' | 'fail' | 'skipped'>} */
  const gates = {};
  /** @type {Record<string, boolean>} */
  const confirmed = {};
  for (const n of NAMES) {
    gates[n] = verdict(results[n] ?? 'skipped');
    confirmed[n] = gates[n] === 'pass' && outputs[n] === 'pass';
  }
  return {
    task_id: taskIdFromBranch(branch),
    branch,
    sha,
    gates,
    confirmed_by_output: confirmed,
    ci_run_url: runUrl,
  };
}

function main() {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const results = Object.fromEntries(NAMES.map((n) => [n, arg(n) ?? 'skipped']));
  const outputs = Object.fromEntries(NAMES.map((n) => [n, arg(`${n}-out`) ?? '']));
  const record = buildRecord({
    results,
    outputs,
    branch: arg('branch') ?? null,
    sha: arg('sha') ?? null,
    runUrl: arg('run-url') ?? null,
  });
  writeFileSync('gate-record.json', `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(record));
}

if (process.argv[1]?.endsWith('record-gates.mjs')) main();
