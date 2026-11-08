import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { withTraceId } from '../../scripts/telemetry/backfill-trace-ids';
import { extraction, type IndexRow } from '../../scripts/telemetry/export-traces';
import { classifyFailure, type Evidence } from '../../src/telemetry/classify';
import { buildSpans, modelOf, parseJournal, spanId, traceIdFromSession, type RunLike } from '../../src/telemetry/spans';

const SESSION = '799a88df-288e-44dc-8b0b-339f2b3dc10f';
const run = (over: Partial<RunLike & { acceptance: { cmd: string; exit: number }[] }> = {}): RunLike & { acceptance: { cmd: string; exit: number }[] } => ({
  task_id: 't-99', agent_path: 'claude-code@2.1.269 model=haiku (-p, dontAsk)', started_at: '2026-11-08T10:00:00.000Z', ended_at: '2026-11-08T10:01:00.000Z',
  duration_s: 60, exit_status: 'ok', acceptance_passed: true, num_turns: 5, agent_subtype: 'success', terminal_reason: 'completed',
  input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000, cost_usd_estimate: 0.12, session_id: SESSION,
  acceptance: [{ cmd: 'npm run typecheck', exit: 0 }], ...over,
});
const journal = (...rows: [string, string][]) => rows.map(([tool, result], i) => ({ ts: `2026-11-08T10:00:0${i}Z`, tool, result }));

describe('trace_id з сесії Claude Code', () => {
  it('UUID без дефісів — 32 hex; усе інше — null', () => {
    expect(traceIdFromSession(SESSION)).toBe('799a88df288e44dc8b0b339f2b3dc10f');
    expect(traceIdFromSession(null)).toBeNull();
    expect(traceIdFromSession('не-uuid')).toBeNull();
  });

  it('backfill додає trace_id і позначає джерело, нічого іншого не міняє; наявний не чіпає', () => {
    const r = withTraceId({ task_id: 't-01', session_id: SESSION, trace_id: null, cost: 1 });
    expect(r).toMatchObject({ task_id: 't-01', cost: 1, trace_id: '799a88df288e44dc8b0b339f2b3dc10f', trace_id_source: 'session_id (backfill 2026-11-08)' });
    expect(withTraceId({ session_id: SESSION, trace_id: 'вже є' })).toBeNull();
    expect(withTraceId({ session_id: null, trace_id: null })).toBeNull();
  });
});

describe('buildSpans: корінь invoke_agent і execute_tool', () => {
  it('одна операція — один корінь, інструменти — діти; вміст промптів і аргументів не записується', () => {
    const spans = buildSpans(run(), journal(['Read', 'ok'], ['Edit', 'ok'], ['Read', 'error']));
    expect(spans).toHaveLength(4);
    const [root, ...tools] = spans;
    expect(root?.name).toBe('invoke_agent harness-run-task');
    expect(root?.parent_span_id).toBeNull();
    expect(root?.attributes).toMatchObject({ 'gen_ai.operation.name': 'invoke_agent', 'gen_ai.request.model': 'haiku', 'gen_ai.agent.name': 'harness-run-task', 'harness.turns': 5 });
    expect(root?.attributes['gen_ai.response.finish_reasons']).toEqual(['completed']);
    expect(tools.map((s) => s.name)).toEqual(['execute_tool Read', 'execute_tool Edit', 'execute_tool Read']);
    expect(tools.every((s) => s.parent_span_id === root?.span_id)).toBe(true);
    expect(tools[2]).toMatchObject({ status: 'ERROR', attributes: { 'error.type': 'tool_error' } });
    expect(JSON.stringify(spans)).not.toMatch(/file_path|command|prompt/);
  });

  it('без сесії траси немає; помилка прогону дає error.type на корені', () => {
    expect(buildSpans(run({ session_id: null }), [])).toEqual([]);
    const [root] = buildSpans(run({ exit_status: 'budget_or_turns' }), []);
    expect(root?.status).toBe('ERROR');
    expect(root?.attributes['error.type']).toBe('budget_or_turns');
  });

  it('span_id детермінований, trace_id однаковий у всіх спанів', () => {
    const a = buildSpans(run(), journal(['Read', 'ok']));
    expect(buildSpans(run(), journal(['Read', 'ok']))).toEqual(a);
    expect(new Set(a.map((s) => s.trace_id)).size).toBe(1);
    expect(spanId('x', 1, 'a')).toMatch(/^[0-9a-f]{16}$/);
    expect(spanId('x', 1, 'a')).not.toBe(spanId('x', 2, 'a'));
  });

  it('parseJournal пропускає зіпсовані рядки; modelOf бере модель із agent_path', () => {
    expect(parseJournal('не json\n{"ts":"t","tool":"Read","result":"ok"}\n\n{"x":1}')).toHaveLength(1);
    expect(modelOf('claude-code model=sonnet (-p)')).toBe('sonnet');
    expect(modelOf('щось')).toBe('unknown');
  });
});

describe('classifyFailure: п’ять причин із доказом', () => {
  const ev = (over: Partial<Evidence> & { r?: ReturnType<typeof run>; j?: [string, string][] } = {}): Evidence => {
    const r = over.r ?? run();
    return { run: r, spans: buildSpans(r, journal(...(over.j ?? [['Read', 'ok']]))), patchEmpty: false, ...(over.manual ? { manual: over.manual } : {}), ...(over.patchEmpty !== undefined ? { patchEmpty: over.patchEmpty } : {}) };
  };

  it('успішний прогін — не невдалий', () => {
    expect(classifyFailure(ev())).toBeNull();
  });

  it('харнес: зупинка лімітом — навіть якщо приймання зелене', () => {
    const c = classifyFailure(ev({ r: run({ exit_status: 'budget_or_turns', agent_subtype: 'error_max_turns', terminal_reason: 'max_turns', acceptance_passed: true }) }));
    expect(c?.cls).toBe('harness');
    expect(c?.why).toContain('error_max_turns');
  });

  it('модель: інструменти й правки є, приймання червоне', () => {
    const c = classifyFailure(ev({ r: run({ acceptance_passed: false, acceptance: [{ cmd: 'npm run typecheck', exit: 2 }] }), j: [['Read', 'ok'], ['Write', 'ok']] }));
    expect(c?.cls).toBe('model');
    expect(c?.why).toContain('npm run typecheck → 2');
  });

  it('промпт: агент не діяв — жодної успішної правки й порожній патч', () => {
    expect(classifyFailure(ev({ r: run({ acceptance_passed: false }), j: [['Read', 'ok']], patchEmpty: true }))?.cls).toBe('prompt');
  });

  it('інструмент: помилки інструментів і жодної успішної правки', () => {
    expect(classifyFailure(ev({ r: run({ acceptance_passed: false }), j: [['Edit', 'error'], ['Edit', 'error']], patchEmpty: true }))?.cls).toBe('tool');
  });

  it('задача: лише з ручною анотацією, і вона діє навіть на «зелений» прогін', () => {
    const c = classifyFailure(ev({ manual: { cls: 'task', why: 'зламане приймання' } }));
    expect(c).toEqual({ cls: 'task', why: 'ручна анотація: зламане приймання' });
  });
});

describe('docs/lab3/traces: докази класифікації', () => {
  const index = JSON.parse(readFileSync('docs/lab3/traces/index.json', 'utf8')) as IndexRow[];

  it('щонайменше 10 невдалих прогонів, trace_id унікальні й 32 hex', () => {
    expect(index.length).toBeGreaterThanOrEqual(10);
    expect(new Set(index.map((r) => r.trace_id)).size).toBe(index.length);
    for (const r of index) expect(r.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('для кожного прогону є файл спанів і текстова витяжка з trace_id у назві', () => {
    for (const r of index) {
      const spans = JSON.parse(readFileSync(r.file, 'utf8')) as { trace_id: string }[];
      expect(spans[0]?.trace_id).toBe(r.trace_id);
      expect(readFileSync(r.file.replace(/\.json$/, '.txt'), 'utf8')).toContain(r.trace_id);
      expect(r.file).toMatch(/\/\d{4}-\d{2}-\d{2}-(task|prompt|tool|model|harness)-[0-9a-f]{32}\.json$/);
    }
  });

  it('у витяжці й спанах немає шляхів, аргументів команд і ключів', () => {
    for (const r of index) {
      const text = readFileSync(r.file, 'utf8') + readFileSync(r.file.replace(/\.json$/, '.txt'), 'utf8');
      expect(text).not.toMatch(/\/Users\/|file_path|"command"|sk-[A-Za-z0-9_-]{16,}/);
    }
  });

  it('витяжка містить клас, доказ і спани інструментів', () => {
    const row = index[0] as IndexRow;
    const text = extraction(row, JSON.parse(readFileSync(row.file, 'utf8')), '2026-11-08');
    expect(text).toContain('доказ класу:');
    expect(text).toContain('спани інструментів');
  });
});
