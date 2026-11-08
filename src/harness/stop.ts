/**
 * Зупинення харнеса: журнал спрацювань і ліміт кроків у власному циклі (Лаб. 3, крок 03).
 * Журнал — docs/lab3/stop-log.jsonl, лише дописування: рядок з'являється тоді, коли ліміт справді спрацював.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isStepCount } from 'ai';

import type { RunRecord, Task } from '../../scripts/harness/run-task';

export const STOP_LOG = 'docs/lab3/stop-log.jsonl';

export type StopLayer = 'task' | 'loop' | 'queue' | 'breaker';

/** Один рядок журналу зупинень: який ліміт, на чому, що харнес зробив далі. */
export interface StopRow {
  readonly at: string;
  readonly layer: StopLayer;
  readonly task_id: string;
  /** max_turns | max_budget_usd | timeout_s | isStepCount | queue_spend_cap | breaker_open | breaker_half_open | breaker_closed … */
  readonly limit: string;
  readonly configured: number | string | null;
  readonly observed: number | string | null;
  /** Що харнес зробив далі — словами, для читача журналу. */
  readonly action: string;
  readonly run_dir?: string;
}

export function appendStopLog(row: StopRow, path: string = STOP_LOG): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(row)}\n`, 'utf8');
}

/**
 * Обгортка робить те саме, що isStepCount(n), але лишає рядок у журналі, коли ліміт спрацював.
 * Тип беремо з самого помічника (typeof inner) — власного підпису не вигадуємо.
 */
export function stepLimit(n: number, taskId: string, logPath: string = STOP_LOG) {
  const inner = isStepCount(n);
  const wrapped: typeof inner = (...args) => {
    const r = inner(...args);
    Promise.resolve(r).then((hit) => {
      if (!hit) return;
      appendStopLog(
        {
          at: new Date().toISOString(),
          layer: 'loop',
          task_id: taskId,
          limit: 'isStepCount',
          configured: n,
          observed: args[0].steps.length,
          action: 'цикл зупинено stopWhen; результат кроків, що встигли виконатися, повернуто викликачу',
        },
        logPath,
      );
    });
    return r;
  };
  return wrapped;
}

/** Який саме ліміт задачі спрацював за підсумком прогону; null — жоден (задача завершилась сама або впала інакше). */
export function taskStopRow(rec: RunRecord, task: Task, action: string, at: Date = new Date()): StopRow | null {
  const base = { at: at.toISOString(), layer: 'task' as const, task_id: task.id, action, run_dir: rec.artifact_dir };
  if (rec.exit_status === 'timeout') {
    return { ...base, limit: 'timeout_s', configured: task.budget.timeout_s, observed: rec.duration_s };
  }
  if (rec.exit_status === 'budget_or_turns') {
    if (rec.agent_subtype === 'error_max_turns') {
      return { ...base, limit: 'max_turns', configured: task.budget.max_turns, observed: rec.num_turns };
    }
    return { ...base, limit: 'max_budget_usd', configured: task.budget.max_usd, observed: rec.cost_usd_estimate };
  }
  return null;
}

/**
 * Відмова провайдера за квотою — не «невдача задачі», а умова спрацювання брейкера.
 * Шукаємо ознаки лише у виводі прогону, що НЕ завершився успішно.
 */
export function looksLikeQuota(text: string): boolean {
  return /\b429\b|rate[ _-]?limit|usage limit|quota|overloaded_error|credit balance/i.test(text);
}
