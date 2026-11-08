/**
 * Класифікація невдалих прогонів на п'ять причин (Лаб. 3, крок 06). Правила детерміновані й працюють зі спанами та артефактами,
 * тому кожен висновок має рядок-доказ. Клас «задача» визначається лише ручною анотацією (docs/lab3/traces/manual-classes.json):
 * зламану умову чи acceptance за журналом дій не видно.
 */
import type { RunLike, Span } from './spans';

export type FailureClass = 'task' | 'prompt' | 'tool' | 'model' | 'harness';

/** Українські назви класів із методички — для звіту; у назвах файлів ASCII-слаги. */
export const CLASS_NAME: Readonly<Record<FailureClass, string>> = { task: 'задача', prompt: 'промпт', tool: 'інструмент', model: 'модель', harness: 'харнес' };

export interface Evidence {
  readonly run: RunLike & { readonly acceptance: readonly { readonly cmd: string; readonly exit: number }[] };
  readonly spans: readonly Span[];
  readonly patchEmpty: boolean;
  readonly manual?: { readonly cls: FailureClass; readonly why: string };
}

export interface Classified {
  readonly cls: FailureClass;
  /** Рядок-доказ: який спан, атрибут чи поле журналу довели клас. */
  readonly why: string;
}

const isEdit = (s: Span) => s.name === 'execute_tool Edit' || s.name === 'execute_tool Write';

/** null — прогін не невдалий (завершився сам і приймання пройшло). */
export function classifyFailure(ev: Evidence): Classified | null {
  const { run, spans } = ev;
  // ручна анотація діє і на прогін, що «пройшов» приймання: зламане приймання якраз і дає зелене там, де має бути червоне
  if (ev.manual) return { cls: ev.manual.cls, why: `ручна анотація: ${ev.manual.why}` };
  if (run.exit_status === 'ok' && run.acceptance_passed) return null;

  const tools = spans.filter((s) => s.name.startsWith('execute_tool'));
  const toolErrors = tools.filter((s) => s.status === 'ERROR');
  const edits = tools.filter((s) => isEdit(s) && s.status === 'OK');

  if (run.exit_status === 'timeout' || run.exit_status === 'budget_or_turns') {
    return { cls: 'harness', why: `exit_status=${run.exit_status}, subtype=${run.agent_subtype ?? '?'}, terminal_reason=${run.terminal_reason ?? '?'}: зупинив ліміт харнеса (stop.md), приймання червоне` };
  }
  if (toolErrors.length > 0 && edits.length === 0) {
    return { cls: 'tool', why: `${toolErrors.length} спан(ів) execute_tool з error.type=tool_error і жодного успішного Edit/Write` };
  }
  if (edits.length === 0 && ev.patchEmpty) {
    return { cls: 'prompt', why: `жодного успішного execute_tool Edit/Write (спанів інструментів: ${tools.length}), patch.diff порожній: агент не діяв` };
  }
  const bad = run.acceptance.filter((a) => a.exit !== 0).map((a) => `${a.cmd} → ${a.exit}`);
  return { cls: 'model', why: `інструменти викликано (execute_tool: ${tools.length}, успішних Edit/Write: ${edits.length}), але acceptance червоний: ${bad.join('; ') || 'не пройшов'}` };
}
