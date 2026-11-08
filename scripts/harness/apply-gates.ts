/**
 * Вердикти брам → поле gates у run.json прогону фабрики (Лаб. 3, крок 01). БЕЗ мережі.
 *
 *   gh run download <id> -n gate-record -D /tmp/gate        (або будь-який gate-record.json)
 *   npx tsx scripts/harness/apply-gates.ts /tmp/gate/gate-record.json
 *
 * Звʼязок CI → прогін точний: шукаємо run.json, у якого branch_commit збігається з SHA, на якому працював CI
 * (а не «найсвіжіший за mtime»: у клоні всі теки мають однаковий час).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GateRecord {
  readonly task_id: string | null;
  readonly branch: string | null;
  readonly sha: string | null;
  readonly gates: Record<string, 'pass' | 'fail' | 'skipped'>;
  readonly ci_run_url: string | null;
}

/** Чистий злиття: gates і посилання на прогін CI додаються до run.json, решта лишається. */
export function applyGates(run: Record<string, unknown>, record: GateRecord): Record<string, unknown> {
  return { ...run, gates: record.gates, ci_run_url: record.ci_run_url };
}

/** run.json, чий коміт гілки прогону — той самий, що збирав CI. */
export function findRun(root: string, record: GateRecord): string | null {
  if (record.sha === null) return null;
  for (const dir of readdirSync(root)) {
    const file = join(root, dir, 'run.json');
    try {
      if (!statSync(join(root, dir)).isDirectory()) continue;
      const run = JSON.parse(readFileSync(file, 'utf8')) as { branch_commit?: string; task_id?: string };
      if (run.branch_commit === record.sha && (record.task_id === null || run.task_id === record.task_id)) return file;
    } catch {
      // тека без run.json — не прогін
    }
  }
  return null;
}

function main(): void {
  const path = process.argv[2];
  if (!path) throw new Error('вкажіть gate-record.json: npx tsx scripts/harness/apply-gates.ts <файл>');
  const record = JSON.parse(readFileSync(path, 'utf8')) as GateRecord;
  const file = findRun('docs/lab3/runs', record);
  if (!file) throw new Error(`у docs/lab3/runs немає прогону з branch_commit ${record.sha ?? '(немає sha)'} (гілка ${record.branch ?? '?'})`);
  const run = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify(applyGates(run, record), null, 2)}\n`, 'utf8');
  console.log(`вердикти записано: ${file}\n${JSON.stringify(record.gates)}`);
}

if (process.argv[1]?.endsWith('apply-gates.ts')) main();
