/**
 * Калібрування верифікатора (Лаб. 3, крок 02). БЕЗ мережі: порівнює мою ручну розмітку з вердиктами судді.
 *
 *   npx tsx scripts/kappa.ts docs/lab3/verifier/labels.jsonl docs/lab3/verifier/judge-run.jsonl
 *
 * Друкує таблицю випадків, сиру згоду й каппу Коена ОКРЕМО, матрицю невідповідностей і перелік розбіжностей.
 */
import { readFileSync } from 'node:fs';

import { agreement, confusion, LABELS, type Label } from '../src/verify/agreement';

interface LabelRow {
  readonly case: string;
  readonly task: string;
  readonly criterion: string;
  readonly mine: Label;
  readonly why: string;
}
interface JudgeRow {
  readonly case: string;
  readonly verdict: Label;
  readonly reason: string;
  readonly evidence: string;
}

const rows = <T>(path: string): T[] =>
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);

function main(): void {
  const [labelsFile, judgeFile] = process.argv.slice(2);
  if (!labelsFile || !judgeFile) throw new Error('npx tsx scripts/kappa.ts <labels.jsonl> <judge-run.jsonl>');
  const labels = rows<LabelRow>(labelsFile);
  const judged = new Map(rows<JudgeRow>(judgeFile).map((r) => [r.case, r]));
  const pairs = labels.map((l) => {
    const j = judged.get(l.case);
    if (!j) throw new Error(`немає вердикту судді для ${l.case}`);
    return { l, j };
  });
  const mine = pairs.map((p) => p.l.mine);
  const judge = pairs.map((p) => p.j.verdict);
  const a = agreement(mine, judge);
  const m = confusion(mine, judge);

  console.log('| № | Задача | Критерій | Мій вердикт | Вердикт судді | Збіг |\n|---|---|---|---|---|---|');
  for (const { l, j } of pairs) console.log(`| ${l.case} | ${l.task} | ${l.criterion} | ${l.mine} | ${j.verdict} | ${l.mine === j.verdict ? '✓' : '✗'} |`);
  console.log(`\nВипадків: ${a.n}`);
  console.log(`Сира згода (частка збігів): ${a.raw.toFixed(3)}`);
  console.log(`Очікувана випадкова згода: ${a.expected.toFixed(3)}`);
  console.log(`Каппа Коена: ${Number.isNaN(a.kappa) ? 'не визначена (усі мітки однакові)' : a.kappa.toFixed(3)}`);
  console.log('\nМатриця невідповідностей (рядок — мій вердикт, стовпчик — суддя):');
  console.log(`| мій \\ суддя | ${LABELS.join(' | ')} |\n|---|${LABELS.map(() => '---').join('|')}|`);
  for (const r of LABELS) console.log(`| ${r} | ${LABELS.map((c) => m[r][c]).join(' | ')} |`);
  const diff = pairs.filter((p) => p.l.mine !== p.j.verdict);
  console.log(`\nРозбіжності (${diff.length}):`);
  for (const { l, j } of diff) {
    console.log(`- ${l.case} ${l.task}/${l.criterion}: я ${l.mine} (${l.why}) ↔ суддя ${j.verdict} (${j.reason})`);
  }
}

main();
