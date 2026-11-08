/**
 * Локальні спани прогону (Лаб. 3, крок 06, варіант «без зовнішнього бекенду»).
 *
 * ЧЕСНО ПРО МЕЖІ: це НЕ OpenTelemetry SDK і не живе трасування. Виконавець фабрики — зовнішній процес Claude Code (`claude -p`),
 * його внутрішні виклики моделі (спани `chat`) із середини не видно. Спани тут ПОБУДОВАНО ПІСЛЯ прогону з його артефактів:
 * run.json (корінь `invoke_agent`), agent JSON з output.txt (токени, причина завершення) і journal.jsonl (по спану
 * `execute_tool` на кожен виклик інструмента). Імена атрибутів — за конвенціями GenAI у статусі Development, як їх подано в
 * методичній сторінці кроку 06 станом на 2026-11-08; з первинним репозиторієм semconv я їх не звіряв.
 *
 * Вміст промптів, відповідей і аргументів інструментів у спани НЕ потрапляє (recordInputs / recordOutputs вимкнені за побудовою):
 * лише метадані. Тека артефактів іде в публічний репозиторій.
 */

/** trace_id = ідентифікатор сесії Claude Code без дефісів (UUID → 32 hex): справжній ідентифікатор прогону, доступний і постфактум. */
export function traceIdFromSession(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  const hex = sessionId.replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : null;
}

export interface Span {
  readonly trace_id: string;
  readonly span_id: string;
  readonly parent_span_id: string | null;
  /** за правилами назв GenAI: `invoke_agent {agent}`, `execute_tool {tool}` */
  readonly name: string;
  readonly kind: 'INTERNAL';
  readonly start: string;
  /** кінець у журналі інструментів невідомий (ts з точністю до секунди): для інструмента це початок наступного виклику або кінець кореня */
  readonly end: string;
  readonly status: 'OK' | 'ERROR';
  readonly attributes: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export interface RunLike {
  readonly task_id: string;
  readonly agent_path: string;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_s: number;
  readonly exit_status: string;
  readonly acceptance_passed: boolean;
  readonly num_turns: number | null;
  readonly agent_subtype: string | null;
  readonly terminal_reason: string | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cache_creation_input_tokens: number | null;
  readonly cache_read_input_tokens: number | null;
  readonly cost_usd_estimate: number | null;
  readonly session_id: string | null;
}

export interface JournalLine {
  readonly ts: string;
  readonly tool: string;
  readonly result: string;
}

/** Детермінований span_id: 16 hex із простого хеша трійки (trace, індекс, імʼя): той самий вхід → ті самі спани. */
export function spanId(traceId: string, index: number, name: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of `${traceId}|${index}|${name}`) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + ch.charCodeAt(0), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** `model=haiku` з рядка agent_path, інакше `unknown`. */
export function modelOf(agentPath: string): string {
  return /model=(\S+)/.exec(agentPath)?.[1] ?? 'unknown';
}

/** Журнал прогону (JSONL) → рядки; зіпсований рядок пропускається, а не валить побудову. */
export function parseJournal(text: string): JournalLine[] {
  const out: JournalLine[] = [];
  for (const l of text.split(/\r?\n/)) {
    if (l.trim() === '') continue;
    try {
      const j = JSON.parse(l) as Partial<JournalLine>;
      if (typeof j.ts === 'string' && typeof j.tool === 'string') out.push({ ts: j.ts, tool: j.tool, result: typeof j.result === 'string' ? j.result : 'unknown' });
    } catch {
      // не рядок журналу
    }
  }
  return out;
}

const AGENT_NAME = 'harness-run-task';

/** Корінь `invoke_agent` + по спану `execute_tool` на кожен виклик інструмента з журналу. Без trace_id (сесії немає) спанів немає. */
export function buildSpans(run: RunLike, journal: readonly JournalLine[]): Span[] {
  const traceId = traceIdFromSession(run.session_id);
  if (traceId === null) return [];
  const rootName = `invoke_agent ${AGENT_NAME}`;
  const rootId = spanId(traceId, 0, rootName);
  const failed = run.exit_status !== 'ok' || !run.acceptance_passed;
  const root: Span = {
    trace_id: traceId,
    span_id: rootId,
    parent_span_id: null,
    name: rootName,
    kind: 'INTERNAL',
    start: run.started_at,
    end: run.ended_at,
    status: run.exit_status === 'ok' ? 'OK' : 'ERROR',
    attributes: {
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.provider.name': 'anthropic',
      'gen_ai.request.model': modelOf(run.agent_path),
      'gen_ai.agent.name': AGENT_NAME,
      'gen_ai.response.finish_reasons': [run.terminal_reason ?? 'unknown'],
      'gen_ai.usage.input_tokens': run.input_tokens ?? 0,
      'gen_ai.usage.output_tokens': run.output_tokens ?? 0,
      // AI SDK називає це cache_creation, OTel — cache_write: тут імена AI SDK, бо так їх віддає Claude Code
      'gen_ai.usage.cache_creation.input_tokens': run.cache_creation_input_tokens ?? 0,
      'gen_ai.usage.cache_read.input_tokens': run.cache_read_input_tokens ?? 0,
      ...(run.exit_status !== 'ok' ? { 'error.type': run.exit_status } : {}),
      'harness.task_id': run.task_id,
      'harness.exit_status': run.exit_status,
      'harness.agent_subtype': run.agent_subtype ?? 'unknown',
      'harness.turns': run.num_turns ?? 0,
      'harness.acceptance_passed': run.acceptance_passed,
      'harness.failed': failed,
      'harness.cost_usd_estimate': run.cost_usd_estimate ?? 0,
      'harness.duration_s': run.duration_s,
    },
  };
  const spans: Span[] = [root];
  journal.forEach((j, i) => {
    const name = `execute_tool ${j.tool}`;
    const next = journal[i + 1]?.ts ?? run.ended_at;
    spans.push({
      trace_id: traceId,
      span_id: spanId(traceId, i + 1, name),
      parent_span_id: rootId,
      name,
      kind: 'INTERNAL',
      start: j.ts,
      end: next,
      status: j.result === 'error' ? 'ERROR' : 'OK',
      attributes: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': j.tool, ...(j.result === 'error' ? { 'error.type': 'tool_error' } : {}) },
    });
  });
  return spans;
}
