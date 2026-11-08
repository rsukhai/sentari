/**
 * Експорт спанів невдалих прогонів у docs/lab3/traces/ і класифікація (Лаб. 3, крок 06). БЕЗ мережі.
 *
 *   npx tsx scripts/telemetry/export-traces.ts
 *
 * Для кожного невдалого прогону (exit_status ≠ ok або приймання червоне) з docs/lab3/runs і docs/lab3/evals-runs:
 *   <дата>-<клас>-<trace_id>.json — спани (корінь invoke_agent + execute_tool), без вмісту промптів і аргументів інструментів;
 *   <дата>-<клас>-<trace_id>.txt  — текстова витяжка: за якими полями зроблено висновок;
 *   index.json                    — перелік для errors.md.
 * Клас «задача» береться лише з ручних анотацій docs/lab3/traces/manual-classes.json (ключ — тека прогону).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CLASS_NAME, classifyFailure, type Evidence, type FailureClass } from '../../src/telemetry/classify';
import { buildSpans, parseJournal, type RunLike, type Span } from '../../src/telemetry/spans';

const OUT = 'docs/lab3/traces';
const MANUAL = join(OUT, 'manual-classes.json');

export interface IndexRow {
  readonly run_dir: string;
  readonly task_id: string;
  readonly trace_id: string;
  readonly cls: FailureClass;
  readonly why: string;
  readonly file: string;
  readonly spans: number;
  readonly tool_spans: number;
  readonly tool_errors: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly duration_s: number;
  readonly cost_usd_estimate: number;
}

const read = (dir: string, name: string): string => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');

/** Текстова витяжка: поля, за якими зроблено висновок. Вмісту промптів і аргументів інструментів тут немає. */
export function extraction(row: IndexRow, spans: readonly Span[], date: string): string {
  const root = spans[0];
  const attrs = Object.entries(root?.attributes ?? {}).map(([k, v]) => `  ${k} = ${Array.isArray(v) ? JSON.stringify(v) : String(v)}`);
  const tools = spans.slice(1).map((s) => `  ${s.start}  ${s.name}  ${s.status}${s.attributes['error.type'] ? `  error.type=${String(s.attributes['error.type'])}` : ''}`);
  return [
    `# ${date} · ${CLASS_NAME[row.cls]} · trace_id ${row.trace_id}`,
    `прогін: ${row.run_dir} · задача ${row.task_id}`,
    `доказ класу: ${row.why}`,
    '',
    `кореневий спан: ${root?.name ?? '—'}  (${root?.start ?? ''} → ${root?.end ?? ''})  status=${root?.status ?? ''}`,
    ...attrs,
    '',
    `спани інструментів (${tools.length}; вміст і аргументи не записуються):`,
    ...(tools.length > 0 ? tools : ['  — жодного']),
    '',
  ].join('\n');
}

function main(): void {
  const manual: Record<string, { cls: FailureClass; why: string }> = existsSync(MANUAL) ? (JSON.parse(readFileSync(MANUAL, 'utf8')) as Record<string, { cls: FailureClass; why: string }>) : {};
  mkdirSync(OUT, { recursive: true });
  const rows: IndexRow[] = [];
  for (const root of ['docs/lab3/runs', 'docs/lab3/evals-runs']) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root).sort()) {
      const dir = join(root, d);
      if (!existsSync(join(dir, 'run.json'))) continue;
      const run = JSON.parse(read(dir, 'run.json')) as RunLike & { acceptance: { cmd: string; exit: number }[]; trace_id?: string | null };
      const spans = buildSpans(run, parseJournal(read(dir, 'journal.jsonl')));
      if (spans.length === 0) continue; // без сесії траси немає
      const ev: Evidence = { run, spans, patchEmpty: read(dir, 'patch.diff').trim() === '', ...(manual[d] ? { manual: manual[d] } : {}) };
      const c = classifyFailure(ev);
      if (c === null) continue;
      const rootSpan = spans[0] as Span;
      const date = run.started_at.slice(0, 10);
      const base = `${date}-${c.cls}-${rootSpan.trace_id}`;
      const tools = spans.slice(1);
      const row: IndexRow = {
        run_dir: `${root}/${d}`, task_id: run.task_id, trace_id: rootSpan.trace_id, cls: c.cls, why: c.why, file: `${OUT}/${base}.json`,
        spans: spans.length, tool_spans: tools.length, tool_errors: tools.filter((s) => s.status === 'ERROR').length,
        input_tokens: Number(rootSpan.attributes['gen_ai.usage.input_tokens']), output_tokens: Number(rootSpan.attributes['gen_ai.usage.output_tokens']),
        duration_s: run.duration_s, cost_usd_estimate: run.cost_usd_estimate ?? 0,
      };
      writeFileSync(join(OUT, `${base}.json`), `${JSON.stringify(spans, null, 2)}\n`, 'utf8');
      writeFileSync(join(OUT, `${base}.txt`), extraction(row, spans, date), 'utf8');
      rows.push(row);
    }
  }
  writeFileSync(join(OUT, 'index.json'), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  const by = Object.fromEntries((['task', 'prompt', 'tool', 'model', 'harness'] as const).map((k) => [CLASS_NAME[k], rows.filter((r) => r.cls === k).length]));
  console.log(`невдалих прогонів із трасою: ${rows.length}; за класами: ${JSON.stringify(by)}`);
}

if (process.argv[1]?.endsWith('export-traces.ts')) main();
