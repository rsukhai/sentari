/**
 * Спільна логіка evals (Лаб. 3, крок 04): банк, оцінювання теки спроби, pass@k / pass^k і порівняння з базовим рівнем.
 * Чисті функції (файлова система — лише в loadBank/gradeAttempt), без мережі.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Task } from '../harness/run-task';
import { grade, type GraderResult } from './graders';

export const BANK = 'docs/lab3/tasks.jsonl';
export const ATTEMPTS_DIR = 'docs/lab3/evals-runs';
export const EVALS_LOG = 'docs/lab3/evals.jsonl';
export const BASELINE = 'docs/lab3/evals-baseline.json';

/** Один рядок журналу: одна спроба. */
export interface EvalLine {
  readonly task_id: string;
  readonly bucket: string;
  readonly frozen_at: string;
  readonly attempt: number;
  readonly sha: string;
  /** спроба успішна, лише якщо ВСІ оцінювачі з label зелені */
  readonly pass: boolean;
  readonly graders: readonly GraderResult[];
  readonly duration_s: number;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cost_usd_estimate: number | null;
  readonly exit_status: string;
  readonly agent_path: string;
  readonly trace_id: string | null;
  readonly at: string;
}

export type Baseline = Record<string, { bucket: string; pow_k: number; k: number; frozen_at: string }>;

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);
}

/** Банк: лише задачі з полями evals (bucket і label). Задачі без них — старі рядки кроку 00 — у банк не входять. */
export function loadBank(path: string = BANK): Task[] {
  return readJsonl<Task>(path).filter((t) => t.bucket !== undefined && t.label !== undefined);
}

const read = (dir: string, name: string): string => {
  const f = join(dir, name);
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
};

/** Тека спроби: <ATTEMPTS_DIR>/<id>-a<n>/ з patch.diff, output.txt, journal.jsonl, run.json. */
export const attemptDir = (id: string, attempt: number, root: string = ATTEMPTS_DIR): string => join(root, `${id}-a${attempt}`);

/** Оцінити одну збережену спробу. Рядок журналу відтворюється з артефакту, а не з годинника: той самий вхід → той самий рядок. */
export function gradeAttempt(task: Task, attempt: number, dir: string, sha: string): EvalLine {
  const run = JSON.parse(read(dir, 'run.json')) as {
    acceptance: { cmd: string; exit: number }[];
    duration_s: number;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd_estimate: number | null;
    exit_status: string;
    agent_path: string;
    trace_id: string | null;
    started_at: string;
  };
  const results = grade({ task, patch: read(dir, 'patch.diff'), output: read(dir, 'output.txt'), journal: read(dir, 'journal.jsonl'), acceptance: run.acceptance });
  return {
    task_id: task.id,
    bucket: task.bucket ?? 'unknown',
    frozen_at: task.frozen_at ?? '',
    attempt,
    sha,
    pass: results.length > 0 && results.every((r) => r.pass),
    graders: results,
    duration_s: run.duration_s,
    input_tokens: run.input_tokens,
    output_tokens: run.output_tokens,
    cost_usd_estimate: run.cost_usd_estimate,
    exit_status: run.exit_status,
    agent_path: run.agent_path,
    trace_id: run.trace_id,
    at: run.started_at,
  };
}

/** Усі збережені спроби банку: задача × номери спроб, що є на диску. Відсутня тека — спроби просто немає. */
export function gradeAll(bank: readonly Task[], root: string, sha: string): EvalLine[] {
  const lines: EvalLine[] = [];
  const dirs = existsSync(root) ? readdirSync(root) : [];
  for (const task of bank) {
    const mine = dirs
      .map((d) => new RegExp(`^${task.id}-a(\\d+)$`).exec(d))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
    for (const n of mine) lines.push(gradeAttempt(task, n, attemptDir(task.id, n, root), sha));
  }
  return lines;
}

// ---- Числа ---------------------------------------------------------------------------------

export interface TaskTally {
  readonly bucket: string;
  readonly frozen_at: string;
  readonly ok: number;
  readonly n: number;
}

export function tallyByTask(lines: readonly Pick<EvalLine, 'task_id' | 'bucket' | 'frozen_at' | 'pass'>[]): Map<string, TaskTally> {
  const m = new Map<string, TaskTally>();
  for (const l of lines) {
    const c = m.get(l.task_id) ?? { bucket: l.bucket, frozen_at: l.frozen_at, ok: 0, n: 0 };
    m.set(l.task_id, { ...c, ok: c.ok + (l.pass ? 1 : 0), n: c.n + 1 });
  }
  return m;
}

export interface BucketSummary {
  readonly bucket: string;
  readonly tasks: number;
  /** спроб на задачу (мінімум серед задач кошика; зазвичай k однакове) */
  readonly k: number;
  /** частка задач, де хоч одна спроба успішна */
  readonly pass_at_k: number;
  /** частка задач, де успішні ВСІ спроби */
  readonly pass_pow_k: number;
  readonly median_duration_s: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd_estimate: number;
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

/** pass@k і pass^k по кошиках; k береться з кількості спроб задачі, бо в edge воно інше, ніж у regression. */
export function summarize(lines: readonly EvalLine[]): BucketSummary[] {
  const byTask = tallyByTask(lines);
  const buckets = new Map<string, { tasks: number; at: number; pow: number; k: number }>();
  for (const { bucket, ok, n } of byTask.values()) {
    const b = buckets.get(bucket) ?? { tasks: 0, at: 0, pow: 0, k: n };
    buckets.set(bucket, { tasks: b.tasks + 1, at: b.at + (ok >= 1 ? 1 : 0), pow: b.pow + (ok === n ? 1 : 0), k: Math.min(b.k, n) });
  }
  return [...buckets].map(([bucket, b]) => {
    const mine = lines.filter((l) => l.bucket === bucket);
    return {
      bucket,
      tasks: b.tasks,
      k: b.k,
      pass_at_k: b.at / b.tasks,
      pass_pow_k: b.pow / b.tasks,
      median_duration_s: median(mine.map((l) => l.duration_s)),
      input_tokens: mine.reduce((s, l) => s + (l.input_tokens ?? 0), 0),
      output_tokens: mine.reduce((s, l) => s + (l.output_tokens ?? 0), 0),
      cost_usd_estimate: Math.round(mine.reduce((s, l) => s + (l.cost_usd_estimate ?? 0), 0) * 1e4) / 1e4,
    };
  });
}

// ---- Базовий рівень і брама ----------------------------------------------------------------

export function makeBaseline(lines: readonly EvalLine[]): Baseline {
  const out: Baseline = {};
  for (const [id, c] of tallyByTask(lines)) out[id] = { bucket: c.bucket, pow_k: c.ok === c.n ? 1 : c.ok / c.n, k: c.n, frozen_at: c.frozen_at };
  return out;
}

export interface GateVerdict {
  /** банк не заморожений або не збігається з базовим рівнем — числа непорівнянні */
  readonly frozenError: string | null;
  /** задачі з кошика regression, що мали pass^k = 1, а зараз мають менше (або зникли) */
  readonly broke: readonly string[];
}

/** Брама дивиться на КОНКРЕТНІ задачі, а не на середнє; edge і new у ній не беруть участі. */
export function compareToBaseline(lines: readonly EvalLine[], baseline: Baseline): GateVerdict {
  const now = tallyByTask(lines);
  const frozen = new Set([...now.values()].map((c) => c.frozen_at));
  const baseFrozen = new Set(Object.values(baseline).map((b) => b.frozen_at));
  if (frozen.size !== 1) return { frozenError: `банк не заморожений: frozen_at = ${[...frozen].join(', ')}`, broke: [] };
  if (baseFrozen.size !== 1 || ![...frozen].every((f) => baseFrozen.has(f))) {
    return { frozenError: `frozen_at банку (${[...frozen].join(', ')}) не збігається з базовим рівнем (${[...baseFrozen].join(', ')}): змінено банк без нового базового рівня`, broke: [] };
  }
  const broke: string[] = [];
  for (const [id, b] of Object.entries(baseline)) {
    if (b.bucket !== 'regression' || b.pow_k !== 1) continue; // у браму входить лише regression, що раніше проходив усі спроби
    const c = now.get(id);
    if (c === undefined) {
      broke.push(`${id}: було pass^${b.k}=1, у поточному прогоні задачі немає`);
      continue;
    }
    if (c.n < b.k) broke.push(`${id}: було ${b.k} спроб, стало ${c.n}`);
    else if (c.ok < c.n) broke.push(`${id}: було pass^${b.k}=1, стало ${c.ok}/${c.n}`);
  }
  return { frozenError: null, broke };
}
