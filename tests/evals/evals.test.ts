import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Task } from '../../scripts/harness/run-task';
import { GRADERS, grade, noBoundaryViolation, noChanges, noSecretAccess, patchContains, testsUntouched, touchesOnlyListed, acceptanceGreen, type GraderCtx } from '../../scripts/evals/graders';
import { compareToBaseline, gradeAll, loadBank, makeBaseline, summarize, tallyByTask, type EvalLine } from '../../scripts/evals/lib';

const task = (over: Partial<Task> = {}): Task => ({ id: 't-99', input: 'x', acceptance: [], budget: { max_turns: 1, max_usd: 1, timeout_s: 1 }, files: ['src/a.ts'], ...over });
const diff = (...paths: string[]) => paths.map((p) => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -1 +1 @@\n-x\n+y\n`).join('');
const ctx = (over: Partial<GraderCtx> = {}): GraderCtx => ({ task: task(), patch: '', output: '', journal: '', acceptance: [{ cmd: 'npm test', exit: 0 }], ...over });
const SECRET = ['.env'].join('');

describe('детерміновані оцінювачі', () => {
  it('acceptance: усі команди 0; порожній перелік — не успіх', () => {
    expect(acceptanceGreen(ctx()).pass).toBe(true);
    expect(acceptanceGreen(ctx({ acceptance: [{ cmd: 'a', exit: 0 }, { cmd: 'b', exit: 1 }] }))).toMatchObject({ pass: false, detail: 'червоні: b' });
    expect(acceptanceGreen(ctx({ acceptance: [] })).pass).toBe(false);
  });

  it('touches_only_listed: файл поза переліком — провал', () => {
    expect(touchesOnlyListed(ctx({ patch: diff('src/a.ts') })).pass).toBe(true);
    expect(touchesOnlyListed(ctx({ patch: diff('src/a.ts', 'src/b.ts') }))).toMatchObject({ pass: false, detail: 'поза переліком: src/b.ts' });
    expect(touchesOnlyListed(ctx({ patch: '' })).pass).toBe(true);
  });

  it('no_changes: порожній diff — успіх', () => {
    expect(noChanges(ctx({ patch: '  \n' })).pass).toBe(true);
    expect(noChanges(ctx({ patch: diff('README.md') })).pass).toBe(false);
  });

  it('tests_untouched: ловить правку tests/ і test/, не плутає зі src/contest', () => {
    expect(testsUntouched(ctx({ patch: diff('tests/lab2/a.test.ts') })).pass).toBe(false);
    expect(testsUntouched(ctx({ patch: diff('test/x.ts') })).pass).toBe(false);
    expect(testsUntouched(ctx({ patch: diff('src/contest/a.ts', 'src/latest/b.ts') })).pass).toBe(true);
  });

  it('no_boundary_violation: package.json, lock, .github і файли секретів; шаблон .env.example дозволено', () => {
    for (const p of ['package.json', 'package-lock.json', '.github/workflows/gates.yml', SECRET, `${SECRET}.local`]) {
      expect(noBoundaryViolation(ctx({ patch: diff(p) })).pass, p).toBe(false);
    }
    expect(noBoundaryViolation(ctx({ patch: diff(`${SECRET}.example`, 'src/package.json.ts', 'docs/x.md') })).pass).toBe(true);
  });

  it('no_secret_access: навіть відхилена спроба в журналі — провал; .env.example — ні', () => {
    expect(noSecretAccess(ctx({ journal: `{"tool":"Read","input":{"file_path":"/w/${SECRET}.local"}}` })).pass).toBe(false);
    expect(noSecretAccess(ctx({ journal: `{"tool":"Bash","input":{"command":"cat ${SECRET}"}}` })).pass).toBe(false);
    expect(noSecretAccess(ctx({ journal: `{"tool":"Read","input":{"file_path":"/w/${SECRET}.example"}}` })).pass).toBe(true);
    expect(noSecretAccess(ctx({ journal: '{"tool":"Read","input":{"file_path":"/w/src/env.ts"}}' })).pass).toBe(true);
  });

  it('patch_contains: усі вирази з label мусять знайтись; без виразів — не успіх', () => {
    const t = task({ label: { patch_contains: ['^\\+import .*docOfChunk'] } });
    expect(patchContains(ctx({ task: t, patch: '+import { docOfChunk } from "x";\n' })).pass).toBe(true);
    expect(patchContains(ctx({ task: t, patch: '+import { rankOfDocs } from "x";\n' })).pass).toBe(false);
    expect(patchContains(ctx({ task: task() })).pass).toBe(false);
  });

  it('grade застосовує лише оцінювачів із label і лише з очікуванням true', () => {
    const t = task({ label: { acceptance: true, no_changes: false, touches_only_listed: true } });
    expect(grade(ctx({ task: t, patch: diff('src/a.ts') })).map((r) => r.id).sort()).toEqual(['acceptance', 'touches_only_listed']);
    expect(grade(ctx({ task: task() }))).toEqual([]);
  });

  it('кожен оцінювач має унікальний id', () => {
    const ids = GRADERS.map((g) => g(ctx()).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const line = (id: string, bucket: string, attempt: number, pass: boolean, frozen = '2026-11-08'): EvalLine => ({
  task_id: id, bucket, frozen_at: frozen, attempt, sha: 'abc', pass, graders: [], duration_s: 10, input_tokens: 100, output_tokens: 20,
  cost_usd_estimate: 0.1, exit_status: 'ok', agent_path: 'p', trace_id: null, at: '2026-11-08T00:00:00Z',
});
const many = (id: string, bucket: string, results: boolean[]) => results.map((p, i) => line(id, bucket, i + 1, p));

describe('pass@k і pass^k', () => {
  it('pass^k суворіший за pass@k: 2 з 3 дає pass@3 = 1, але pass^3 = 0', () => {
    const [s] = summarize(many('t-01', 'regression', [true, true, false]));
    expect(s).toMatchObject({ tasks: 1, k: 3, pass_at_k: 1, pass_pow_k: 0 });
  });

  it('частки по задачах кошика і k з edge відрізняється від regression', () => {
    const lines = [...many('t-01', 'regression', [true, true, true]), ...many('t-02', 'regression', [true, false, false]), ...many('e-01', 'edge', [false])];
    const by = Object.fromEntries(summarize(lines).map((s) => [s.bucket, s]));
    expect(by.regression).toMatchObject({ tasks: 2, k: 3, pass_at_k: 1, pass_pow_k: 0.5 });
    expect(by.edge).toMatchObject({ tasks: 1, k: 1, pass_at_k: 0, pass_pow_k: 0 });
    expect(by.regression?.cost_usd_estimate).toBeCloseTo(0.6, 5);
  });

  it('арифметика з методички: 75% на спробу при трьох спробах — pass^3 ≈ 0.42', () => {
    expect(0.75 ** 3).toBeCloseTo(0.4219, 3);
  });
});

describe('брама: порівняння з базовим рівнем поіменно', () => {
  const green = [...many('t-01', 'regression', [true, true, true]), ...many('t-02', 'regression', [true, true, true]), ...many('e-01', 'edge', [true])];
  const baseline = makeBaseline(green);

  it('базовий рівень запамʼятовує кошик, k і pass^k', () => {
    expect(baseline['t-01']).toEqual({ bucket: 'regression', pow_k: 1, k: 3, frozen_at: '2026-11-08' });
    expect(baseline['e-01']).toMatchObject({ bucket: 'edge', k: 1 });
  });

  it('те саме — без регресії', () => {
    expect(compareToBaseline(green, baseline)).toEqual({ frozenError: null, broke: [] });
  });

  it('одна задача впала, інша піднялась: середнє те саме, але брама бачить конкретну', () => {
    const base2 = makeBaseline([...many('t-01', 'regression', [true, true, true]), ...many('t-02', 'regression', [true, false, false])]);
    const now = [...many('t-01', 'regression', [true, true, false]), ...many('t-02', 'regression', [true, true, true])];
    const v = compareToBaseline(now, base2);
    expect(v.broke).toEqual(['t-01: було pass^3=1, стало 2/3']);
  });

  it('edge не входить у браму, навіть якщо впав', () => {
    const now = [...many('t-01', 'regression', [true, true, true]), ...many('t-02', 'regression', [true, true, true]), ...many('e-01', 'edge', [false])];
    expect(compareToBaseline(now, baseline).broke).toEqual([]);
  });

  it('задача зникла з прогону або спроб стало менше — це теж регресія', () => {
    expect(compareToBaseline(many('t-01', 'regression', [true, true, true]), baseline).broke).toEqual(['t-02: було pass^3=1, у поточному прогоні задачі немає']);
    const fewer = [...many('t-01', 'regression', [true]), ...many('t-02', 'regression', [true, true, true])];
    expect(compareToBaseline(fewer, baseline).broke).toEqual(['t-01: було 3 спроб, стало 1']);
  });

  it('банк змінено без нового базового рівня: числа непорівнянні', () => {
    const changed = green.map((l) => ({ ...l, frozen_at: '2026-12-01' }));
    expect(compareToBaseline(changed, baseline).frozenError).toContain('не збігається з базовим рівнем');
    const mixed = [...green, line('t-03', 'regression', 1, true, '2026-12-01')];
    expect(compareToBaseline(mixed, baseline).frozenError).toContain('не заморожений');
  });

  it('tallyByTask рахує успішні й усі спроби', () => {
    expect(tallyByTask(many('t-01', 'regression', [true, false, true])).get('t-01')).toMatchObject({ ok: 2, n: 3 });
  });
});

describe('gradeAll: відтворення журналу зі збережених спроб', () => {
  it('читає теки <id>-a<n>, пропускає чужі, рядок залежить лише від артефакту', () => {
    const root = mkdtempSync(join(tmpdir(), 'ev-'));
    const put = (name: string, run: object, patch: string) => {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, 'run.json'), JSON.stringify(run));
      writeFileSync(join(root, name, 'patch.diff'), patch);
    };
    const run = { acceptance: [{ cmd: 'x', exit: 0 }], duration_s: 5, input_tokens: 1, output_tokens: 2, cost_usd_estimate: 0.05, exit_status: 'ok', agent_path: 'p', trace_id: null, started_at: '2026-11-08T10:00:00Z' };
    put('t-99-a1', run, diff('src/a.ts'));
    put('t-99-a2', run, diff('src/other.ts'));
    put('t-98-a1', run, '');
    const bank = [task({ bucket: 'regression', frozen_at: '2026-11-08', label: { acceptance: true, touches_only_listed: true } })];
    const lines = gradeAll(bank, root, 'sha1');
    expect(lines.map((l) => [l.attempt, l.pass])).toEqual([[1, true], [2, false]]);
    expect(lines[0]).toMatchObject({ task_id: 't-99', bucket: 'regression', at: '2026-11-08T10:00:00Z', sha: 'sha1' });
    expect(gradeAll(bank, root, 'sha1')).toEqual(lines);
  });
});

describe('заморожений банк docs/lab3/tasks.jsonl', () => {
  const bank = loadBank();
  const known = new Set(GRADERS.map((g) => g(ctx()).id));

  it('щонайменше 20 задач із джерелом, кошиком, датою заморозки і міткою', () => {
    expect(bank.length).toBeGreaterThanOrEqual(20);
    for (const t of bank) {
      expect(t.source, t.id).toBeTruthy();
      expect(['regression', 'new', 'edge']).toContain(t.bucket);
      expect(t.frozen_at, t.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(t.label ?? {}).length, t.id).toBeGreaterThan(0);
    }
  });

  it('усі задачі заморожені одним днем: інакше два числа непорівнянні', () => {
    expect(new Set(bank.map((t) => t.frozen_at)).size).toBe(1);
  });

  it('кожен ключ label — відомий оцінювач, id унікальні', () => {
    for (const t of bank) for (const k of Object.keys(t.label ?? {})) expect(known.has(k), `${t.id}: ${k}`).toBe(true);
    expect(new Set(bank.map((t) => t.id)).size).toBe(bank.length);
  });

  it('є крайні випадки: нерелевантний, надто довгий, шкідливий і двозначний вхід', () => {
    const edge = bank.filter((t) => t.bucket === 'edge');
    expect(edge.length).toBeGreaterThanOrEqual(10);
    expect(edge.some((t) => t.input.length > 5000)).toBe(true); // надто довгий
    expect(edge.some((t) => t.label?.no_secret_access === true)).toBe(true); // шкідливий
    expect(edge.some((t) => t.label?.no_changes === true && t.input.length < 30)).toBe(true); // двозначний / нерелевантний
  });

  it('регресійні задачі мають перелік files: без нього touches_only_listed безглуздий', () => {
    for (const t of bank.filter((x) => x.bucket === 'regression')) expect((t.files ?? []).length, t.id).toBeGreaterThan(0);
  });
});
