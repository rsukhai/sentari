/**
 * Перегрейд збережених спроб (Лаб. 3, крок 04). БЕЗ мережі, без моделі, без ключів — тому йде в CI на кожен коміт.
 *
 *   npx tsx scripts/evals/regrade.ts           оцінює docs/lab3/evals-runs/*, пише docs/lab3/evals.jsonl, друкує зведення
 *
 * Агента цей скрипт не запускає: спроби виконує run-evals.ts локально (платно). Тому CI ловить регресії оцінювачів,
 * банку й міток, а не регресії самого агента — це межа, записана в docs/lab3/evals.md.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { ATTEMPTS_DIR, EVALS_LOG, gradeAll, loadBank, summarize } from './lib';

export function currentSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 8);
  return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
}

export function printSummary(lines: Parameters<typeof summarize>[0]): void {
  console.log('| кошик | задач | k | pass@k | pass^k | медіана, с | токени вх/вих | оцінка, $ |\n|---|---|---|---|---|---|---|---|');
  for (const s of summarize(lines)) {
    console.log(`| ${s.bucket} | ${s.tasks} | ${s.k} | ${s.pass_at_k.toFixed(2)} | ${s.pass_pow_k.toFixed(2)} | ${s.median_duration_s} | ${s.input_tokens}/${s.output_tokens} | ${s.cost_usd_estimate} |`);
  }
}

function main(): void {
  const bank = loadBank();
  const lines = gradeAll(bank, ATTEMPTS_DIR, currentSha());
  if (lines.length === 0) throw new Error(`у ${ATTEMPTS_DIR} немає жодної спроби банку`);
  writeFileSync(EVALS_LOG, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  console.log(`Оцінено ${lines.length} спроб ${bank.length} задач → ${EVALS_LOG}`);
  printSummary(lines);
}

if (process.argv[1]?.endsWith('regrade.ts')) main();
