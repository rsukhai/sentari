import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyGates, findRun, type GateRecord } from '../../scripts/harness/apply-gates';
import { buildRecord, taskIdFromBranch, verdict } from '../../scripts/harness/record-gates.mjs';

describe('verdict: result → pass | fail | skipped', () => {
  it('зводить статуси GitHub', () => {
    expect(verdict('success')).toBe('pass');
    expect(verdict('failure')).toBe('fail');
    expect(verdict('skipped')).toBe('skipped');
    expect(verdict('cancelled')).toBe('skipped');
  });

  it('невідоме значення — fail, а не тихий pass', () => {
    expect(verdict('')).toBe('fail');
    expect(verdict(undefined)).toBe('fail');
  });
});

describe('buildRecord: червоний вердикт береться з result, а не з outputs', () => {
  it('types впала: lint/tests/build — skipped (не failure), outputs порожні', () => {
    const rec = buildRecord({
      results: { types: 'failure', lint: 'skipped', tests: 'skipped', build: 'skipped' },
      outputs: { types: '', lint: '', tests: '', build: '' },
      branch: 'harness/red-2026-11-08',
      sha: 'abc',
      runUrl: 'https://example/run/1',
    });
    expect(rec.gates).toEqual({ types: 'fail', lint: 'skipped', tests: 'skipped', build: 'skipped', verify: 'skipped' });
    expect(rec.confirmed_by_output.types).toBe(false);
    expect(rec.task_id).toBeNull();
  });

  it('усе зелене: pass підтверджено outputs', () => {
    const ok = { types: 'success', lint: 'success', tests: 'success', build: 'success', verify: 'success' };
    const rec = buildRecord({ results: ok, outputs: { types: 'pass', lint: 'pass', tests: 'pass', build: 'pass', verify: 'pass' }, branch: 'harness/t-07-r2', sha: 'f1' });
    expect(Object.values(rec.gates)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
    expect(Object.values(rec.confirmed_by_output).every(Boolean)).toBe(true);
    expect(rec.task_id).toBe('t-07');
  });

  it('детерміновані брами зелені, верифікатор червоний: fail лише на verify', () => {
    const rec = buildRecord({
      results: { types: 'success', lint: 'success', tests: 'success', build: 'success', verify: 'failure' },
      outputs: { types: 'pass', lint: 'pass', tests: 'pass', build: 'pass', verify: '' },
      branch: 'harness/t-08-r2',
    });
    expect(rec.gates).toEqual({ types: 'pass', lint: 'pass', tests: 'pass', build: 'pass', verify: 'fail' });
    expect(rec.confirmed_by_output.verify).toBe(false);
  });

  it('гілка не прогін фабрики: verify skipped, а не тихий pass', () => {
    const rec = buildRecord({ results: { types: 'success', lint: 'success', tests: 'success', build: 'success', verify: 'skipped' }, outputs: {} });
    expect(rec.gates.verify).toBe('skipped');
  });

  it('зелений result без підтвердження outputs — позначено як непідтверджений', () => {
    const rec = buildRecord({ results: { types: 'success', lint: 'success', tests: 'success', build: 'success' }, outputs: {} });
    expect(rec.gates.types).toBe('pass');
    expect(rec.confirmed_by_output.types).toBe(false);
  });
});

describe('taskIdFromBranch', () => {
  it('розпізнає лише гілки прогонів фабрики', () => {
    expect(taskIdFromBranch('harness/t-01')).toBe('t-01');
    expect(taskIdFromBranch('harness/t-08-r2')).toBe('t-08');
    expect(taskIdFromBranch('harness/red-2026-11-08')).toBeNull();
    expect(taskIdFromBranch('lab3/01-gates')).toBeNull();
    expect(taskIdFromBranch(null)).toBeNull();
  });
});

describe('apply-gates: звʼязок CI → прогін фабрики за SHA', () => {
  const record: GateRecord = {
    task_id: 't-07',
    branch: 'harness/t-07',
    sha: 'deadbeef',
    gates: { types: 'pass', lint: 'pass', tests: 'pass', build: 'pass' },
    ci_run_url: 'https://github.com/x/y/actions/runs/1',
  };

  const root = () => {
    const r = mkdtempSync(join(tmpdir(), 'runs-'));
    const put = (dir: string, run: object) => {
      mkdirSync(join(r, dir));
      writeFileSync(join(r, dir, 'run.json'), JSON.stringify(run));
    };
    put('t-07-1', { task_id: 't-07', branch_commit: 'old', gates: {} });
    put('t-07-2', { task_id: 't-07', branch_commit: 'deadbeef', gates: {} });
    put('t-01-1', { task_id: 't-01', branch_commit: 'deadbeef', gates: {} });
    mkdirSync(join(r, 'порожня-тека'));
    return r;
  };

  it('знаходить прогін за SHA і task_id, а не за часом зміни', () => {
    expect(findRun(root(), record)).toMatch(/t-07-2[/\\]run\.json$/);
  });

  it('немає збігу — null, а не «найсвіжіший»', () => {
    expect(findRun(root(), { ...record, sha: 'невідомий' })).toBeNull();
    expect(findRun(root(), { ...record, sha: null })).toBeNull();
  });

  it('applyGates додає gates і посилання, решту run.json не чіпає', () => {
    const out = applyGates({ task_id: 't-07', duration_s: 26.1, gates: {} }, record);
    expect(out.gates).toEqual(record.gates);
    expect(out.ci_run_url).toBe(record.ci_run_url);
    expect(out.duration_s).toBe(26.1);
  });
});
