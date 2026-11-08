/**
 * Регресійна брама evals (Лаб. 3, крок 04). Ненульовий код виходу — єдиний спосіб, яким GitHub Actions дізнається про регресію.
 *
 *   npx tsx scripts/evals/gate.ts                    порівняти docs/lab3/evals.jsonl з docs/lab3/evals-baseline.json
 *   npx tsx scripts/evals/gate.ts --write-baseline   записати базовий рівень (РІВНО ОДИН раз, навмисним окремим комітом)
 *
 * Брама валить збірку, якщо задача з кошика regression, що в базовому рівні мала pass^k = 1, зараз має менше.
 * Це не «середнє впало», а «конкретна задача зламалась»; edge і new у браму не входять.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { BASELINE, compareToBaseline, EVALS_LOG, makeBaseline, readJsonl, type Baseline, type EvalLine } from './lib';

function main(): void {
  if (!existsSync(EVALS_LOG)) throw new Error(`немає ${EVALS_LOG}: спершу scripts/evals/regrade.ts або run-evals.ts`);
  const lines = readJsonl<EvalLine>(EVALS_LOG);

  if (process.argv.includes('--write-baseline')) {
    if (existsSync(BASELINE) && !process.argv.includes('--force')) {
      throw new Error(`${BASELINE} уже існує: базовий рівень пишеться один раз; зміна — навмисний новий frozen_at (--force)`);
    }
    const base = makeBaseline(lines);
    writeFileSync(BASELINE, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
    console.log(`базовий рівень записано на ${Object.keys(base).length} задач — закомітьте його НАВМИСНО`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  const v = compareToBaseline(lines, baseline);
  if (v.frozenError !== null) {
    console.error(v.frozenError);
    process.exit(1);
  }
  if (v.broke.length > 0) {
    console.error(`РЕГРЕСІЯ на ${v.broke.length} задачах:\n${v.broke.join('\n')}`);
    process.exit(1);
  }
  const gated = Object.values(baseline).filter((b) => b.bucket === 'regression' && b.pow_k === 1).length;
  console.log(`регресії немає: у брамі ${gated} задач із pass^k=1, усього в прогоні ${new Set(lines.map((l) => l.task_id)).size}`);
}

if (process.argv[1]?.endsWith('gate.ts')) main();
