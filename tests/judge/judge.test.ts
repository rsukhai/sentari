import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { report } from '../../scripts/judge/calibrate';
import { parseRubric, type JudgeCase } from '../../scripts/judge/run-judge';
import { loadTasks } from '../../scripts/harness/verify-task';

const cases = readFileSync('docs/lab3/judge-cases.jsonl', 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as JudgeCase);

describe('parseRubric: преамбула й розділи за виміром', () => {
  it('ділить за «## вимір»; один суддя бачить лише свій розділ', () => {
    const r = parseRubric('Преамбула.\nДруге.\n\n## a\nтекст a\n\n## b\nтекст b\n');
    expect(r.preamble).toBe('Преамбула.\nДруге.');
    expect([...r.sections.keys()]).toEqual(['a', 'b']);
    expect(r.sections.get('a')).toContain('текст a');
    expect(r.sections.get('a')).not.toContain('текст b');
  });

  it.each(['before', 'after'])('рубрика %s містить розділ на кожен вимір набору і приклад fail', (v) => {
    const file = `docs/lab3/rubric/${v}.md`;
    if (!existsSync(file)) return; // «після» зʼявляється пізніше за «до»
    const r = parseRubric(readFileSync(file, 'utf8'));
    for (const d of new Set(cases.map((c) => c.dimension))) {
      expect(r.sections.has(d), `${v}: ${d}`).toBe(true);
      expect(r.sections.get(d)).toMatch(/pass/);
      expect(r.sections.get(d)).toMatch(/fail/);
      expect(r.sections.get(d)).toMatch(/unknown/);
    }
  });
});

describe('docs/lab3/judge-cases.jsonl: структура набору', () => {
  it('щонайменше 20 випадків, унікальні id, 6 відкладених, ≥ 3 вагання', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(cases.map((c) => c.case_id)).size).toBe(cases.length);
    expect(cases.filter((c) => c.holdout)).toHaveLength(6);
    expect(cases.filter((c) => c.hesitant === true).length).toBeGreaterThanOrEqual(3);
  });

  it('є і pass, і fail, і unknown, інакше каппа не визначена', () => {
    expect(new Set(cases.map((c) => c.mine))).toEqual(new Set(['pass', 'fail', 'unknown']));
  });

  it('відкладені випадки є в кожному вимірі', () => {
    for (const d of new Set(cases.map((c) => c.dimension))) expect(cases.some((c) => c.holdout && c.dimension === d), d).toBe(true);
  });

  it('кожен випадок посилається на наявну теку спроби і наявний критерій задачі', () => {
    const tasks = new Map(loadTasks('docs/lab3/tasks.jsonl').map((t) => [t.id, t]));
    for (const c of cases) {
      expect(existsSync(join(c.artifact, 'patch.diff')), `${c.case_id}: ${c.artifact}`).toBe(true);
      expect(tasks.get(c.task)?.criteria?.some((x) => x.id === c.criterion), `${c.case_id}: ${c.task}/${c.criterion}`).toBe(true);
      expect(c.reason.trim(), c.case_id).not.toBe('');
    }
  });
});

describe('calibrate.report', () => {
  const mk = (id: string, mine: JudgeCase['mine']): JudgeCase => ({ case_id: id, artifact: 'a', task: 't', criterion: 'c', dimension: 'd', mine, reason: 'r', holdout: false });
  const v = (id: string, verdict: JudgeCase['mine']) => [id, { case_id: id, dimension: 'd', verdict, reason: 'r' }] as const;

  it('друкує сиру згоду і каппу окремо та рахує «пропускає погане»', () => {
    const subset = [mk('1', 'pass'), mk('2', 'fail'), mk('3', 'fail'), mk('4', 'pass')];
    const text = report('тест', subset, new Map([v('1', 'pass'), v('2', 'pass'), v('3', 'fail'), v('4', 'pass')]));
    expect(text).toContain('сира згода 0.750');
    expect(text).toContain('каппа Коена');
    expect(text).toContain('пропускає погане (мій fail → суддя pass): 1');
  });

  it('без вердиктів — повідомлення, а не помилка', () => {
    expect(report('x', [mk('1', 'pass')], new Map())).toContain('немає жодного вердикту');
  });
});
