/**
 * Калібрування судді (Лаб. 3, крок 05): сира згода + каппа Коена + матриця невідповідностей — окремо на кожен вимір.
 * БЕЗ мережі, без залежностей. agreement() — той самий, що на кроці 02 (src/verify/agreement.ts).
 *
 *   npx tsx scripts/judge/calibrate.ts docs/lab3/verdicts/judge-before.jsonl            робочі випадки (відкладені приховано)
 *   npx tsx scripts/judge/calibrate.ts docs/lab3/verdicts/judge-after.jsonl --final     + відкладені й усі 23 — лише в кінці
 *
 * Відкладені випадки (holdout) не друкуються без --final: їх не дивляться до кінця, щоб рубрику не підганяли під них.
 */
import { readFileSync } from 'node:fs';

import { agreement, confusion, LABELS, type Label } from '../../src/verify/agreement';
import type { JudgeCase } from './run-judge';

interface Verdict {
  readonly case_id: string;
  readonly dimension: string;
  readonly verdict: Label;
  readonly reason: string;
}

const jsonl = <T>(p: string): T[] =>
  readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as T);

/** Числа по підмножині випадків; null, якщо вердиктів немає. */
export function report(label: string, subset: readonly JudgeCase[], byCase: ReadonlyMap<string, Verdict>): string {
  const paired = subset.filter((c) => byCase.has(c.case_id));
  if (paired.length === 0) return `${label}: немає жодного вердикту судді`;
  const mine = paired.map((c) => c.mine);
  const judge = paired.map((c) => byCase.get(c.case_id)?.verdict ?? 'unknown');
  const a = agreement(mine, judge);
  const m = confusion(mine, judge);
  const kappa = Number.isNaN(a.kappa) ? 'не визначена (усі мітки однакові)' : a.kappa.toFixed(3);
  const rows = LABELS.map((r) => `  ${r.padEnd(8)} ${LABELS.map((c) => String(m[r][c]).padStart(4)).join('')}`).join('\n');
  return [
    `== ${label} · випадків ${a.n}`,
    `сира згода ${a.raw.toFixed(3)} · очікувана випадкова ${a.expected.toFixed(3)} · каппа Коена ${kappa}`,
    `матриця (рядок = мій вердикт, стовпець = суддя; ${LABELS.join(' ')}):`,
    rows,
    `  пропускає погане (мій fail → суддя pass): ${m.fail.pass}`,
    `  марна робота    (мій pass → суддя fail): ${m.pass.fail}`,
  ].join('\n');
}

function main(): void {
  const file = process.argv[2];
  if (!file) throw new Error('npx tsx scripts/judge/calibrate.ts <вердикти.jsonl> [--final]');
  const final = process.argv.includes('--final');
  const cases = jsonl<JudgeCase>('docs/lab3/judge-cases.jsonl');
  const byCase = new Map(jsonl<Verdict>(file).map((v) => [v.case_id, v]));
  const working = cases.filter((c) => !c.holdout);
  const dims = [...new Set(cases.map((c) => c.dimension))];

  console.log(report('усі виміри · РОБОЧІ', working, byCase));
  for (const d of dims) console.log(`\n${report(`вимір ${d} · робочі`, working.filter((c) => c.dimension === d), byCase)}`);

  if (!final) {
    console.log('\n(відкладені випадки приховано; --final — лише після остаточної правки рубрики)');
    console.log('\nРозбіжності на робочих:');
    for (const c of working.filter((x) => byCase.has(x.case_id) && byCase.get(x.case_id)?.verdict !== x.mine)) {
      const v = byCase.get(c.case_id);
      console.log(`- ${c.case_id} ${c.task}/${c.criterion} (${c.dimension}): я ${c.mine} (${c.reason}) ↔ суддя ${v?.verdict} (${v?.reason})`);
    }
    return;
  }
  const hold = cases.filter((c) => c.holdout);
  console.log(`\n${report('усі виміри · ВІДКЛАДЕНІ', hold, byCase)}`);
  console.log(`\n${report('усі виміри · УСІ 23', cases, byCase)}`);
  for (const d of dims) console.log(`\n${report(`вимір ${d} · усі`, cases.filter((c) => c.dimension === d), byCase)}`);
  console.log('\nРозбіжності на відкладених:');
  for (const c of hold.filter((x) => byCase.get(x.case_id)?.verdict !== x.mine)) {
    const v = byCase.get(c.case_id);
    console.log(`- ${c.case_id} ${c.task}/${c.criterion} (${c.dimension}): я ${c.mine} (${c.reason}) ↔ суддя ${v?.verdict} (${v?.reason})`);
  }
}

if (process.argv[1]?.endsWith('calibrate.ts')) main();
