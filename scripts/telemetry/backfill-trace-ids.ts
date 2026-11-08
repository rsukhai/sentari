/**
 * Доповнення trace_id у run.json прогонів, зроблених ДО кроку 06 (Лаб. 3). БЕЗ мережі.
 *
 *   npx tsx scripts/telemetry/backfill-trace-ids.ts
 *
 * trace_id = session_id Claude Code без дефісів. Нічого іншого в run.json не змінюється; доповнене помічено
 * `trace_id_source: "session_id (backfill 2026-11-08)"`, щоб було видно, що значення додано постфактум, а не записано виконавцем.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { traceIdFromSession } from '../../src/telemetry/spans';

export const BACKFILL_NOTE = 'session_id (backfill 2026-11-08)';

/** Нове значення run.json або null, якщо доповнювати нічого (trace_id уже є або сесії немає). */
export function withTraceId(run: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof run.trace_id === 'string' && run.trace_id !== '') return null;
  const id = traceIdFromSession(typeof run.session_id === 'string' ? run.session_id : null);
  if (id === null) return null;
  return { ...run, trace_id: id, trace_id_source: BACKFILL_NOTE };
}

function main(): void {
  let changed = 0;
  let skipped = 0;
  for (const root of ['docs/lab3/runs', 'docs/lab3/evals-runs']) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      const file = join(root, dir, 'run.json');
      if (!existsSync(file)) continue;
      const next = withTraceId(JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>);
      if (next === null) {
        skipped += 1;
        continue;
      }
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      changed += 1;
    }
  }
  console.log(`trace_id доповнено: ${changed}, без змін: ${skipped}`);
}

if (process.argv[1]?.endsWith('backfill-trace-ids.ts')) main();
