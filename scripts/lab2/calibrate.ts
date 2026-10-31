/**
 * Калібрування верифікатора (Лаб. 2, крок 03). ХОДИТЬ У МЕРЕЖУ — по 5 запитів на випадок:
 *
 *   npx tsx --env-file=<файл секретів> scripts/lab2/calibrate.ts
 *
 * Для кожного випадку з docs/lab2/calibration/cases.jsonl: git diff діапазону → scripts/verify.ts
 * → звіт у docs/lab2/calibration/verifier/<id>.json. Потім порівнює з ручною розміткою
 * docs/lab2/calibration/human.jsonl (її пишуть ДО прогону) і друкує таблицю збігу.
 * Лише порівняння, без мережі:  npx tsx scripts/lab2/calibrate.ts compare
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { VerifyReport } from '../../src/verify/schema';

const DIR = 'docs/lab2/calibration';
type Verdict = 'pass' | 'fail' | 'unknown';
interface Case { id: string; range: string; title: string }
interface Human { id: string; verdicts: Record<string, Verdict> }

const jsonl = <T>(file: string): T[] =>
  readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as T);

function run(cases: Case[]) {
  mkdirSync(join(DIR, 'verifier'), { recursive: true });
  for (const c of cases) {
    // той самий генератор diff, що й у CI
    const diff = execFileSync('bash', ['scripts/lab2/make-diff.sh', c.range], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const diffFile = join(tmpdir(), `verify-${c.id}.diff`);
    writeFileSync(diffFile, diff, 'utf8');
    const out = join(DIR, 'verifier', `${c.id}.json`);
    const res = spawnSync('npx', ['tsx', 'scripts/verify.ts', diffFile, '--json', out], { encoding: 'utf8' });
    // код 1 — брама червона (це теж результат); 2 — збій скрипта
    if (res.status === 2 || res.status === null) throw new Error(`${c.id}: ${res.stderr}`);
    console.log(`${c.id}  ${res.status === 1 ? 'fail' : 'зелено'}  ${res.stdout.match(/Токени .*$/m)?.[0] ?? ''}`);
  }
}

function compare(cases: Case[]) {
  const human = new Map(jsonl<Human>(join(DIR, 'human.jsonl')).map((h) => [h.id, h.verdicts]));
  let total = 0;
  let agree = 0;
  let unknown = 0;
  const rows: string[] = [];
  for (const c of cases) {
    const mine = human.get(c.id);
    if (!mine) throw new Error(`${c.id}: немає ручної розмітки в human.jsonl`);
    const report = JSON.parse(readFileSync(join(DIR, 'verifier', `${c.id}.json`), 'utf8')) as VerifyReport;
    for (const r of report.results) {
      const h = mine[r.id];
      if (!h) throw new Error(`${c.id}/${r.id}: немає ручного вердикту`);
      total++;
      if (r.verdict === 'unknown') unknown++;
      const same = h === r.verdict;
      if (same) agree++;
      rows.push(`| ${c.id}/${r.id} | ${c.title} | ${h} | ${r.verdict} | ${same ? '✅' : '❌'} | ${same ? '' : r.reason.replace(/\s+/g, ' ').replace(/\|/g, '\\|')} |`);
    }
  }
  console.log('| № | Зміна | Мій ручний вердикт | Вердикт верифікатора | Збіг | Коментар |\n|---|---|---|---|---|---|');
  console.log(rows.join('\n'));
  console.log(`\nВипадків (зміна × критерій): ${total}; збіг: ${agree} (${Math.round((agree / total) * 100)}%); unknown у верифікатора: ${unknown}`);
}

const cases = jsonl<Case>(join(DIR, 'cases.jsonl'));
if (process.argv[2] !== 'compare') run(cases);
compare(cases);
