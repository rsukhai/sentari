/**
 * Суддя верифікатора (Лаб. 2, крок 03): один запит — один критерій приймання.
 * Чисті функції; модель передається параметром, тож тести не ходять у мережу.
 */
import { criterionVerdict, type CriterionVerdict } from './schema';

export interface Criterion {
  readonly id: string;
  /** Перевірне твердження, дослівно зі spec.md. */
  readonly statement: string;
  /** «Чим перевіряється», дослівно зі spec.md. */
  readonly check: string;
}

/** Таблиця «| A1 | твердження | чим перевіряється |» з розділу 6 специфікації. */
export function parseCriteria(specMd: string): Criterion[] {
  const section = specMd.split(/^## /m).find((s) => s.startsWith('6.'));
  if (!section) return [];
  const criteria: Criterion[] = [];
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim());
    const [, id, statement, check] = cells;
    if (id && statement && check && /^A\d+$/.test(id)) criteria.push({ id, statement, check });
  }
  return criteria;
}

/** Шляхи, вміст яких у запит не йде ніколи. */
const SECRET_PATH = /(^|\/)\.env(?!\.example$)[^/]*$/;
/** Великі дані: суддя бачить, що файл змінено, і скільки рядків, але не вміст. */
const BULK_PATH = /^(data\/|\.agent-log\/)|\.jsonl$/;
/** Винятки з BULK_PATH: еталонний набір — предмет критерію A2, суддя бачить його повністю. */
const ALWAYS_FULL = new Set(['docs/lab2/golden/queries.jsonl']);
const KEY_PATTERN = /\b(sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,})\b/g;

/**
 * Готує diff до відправки: прибирає секції файлів із секретами, стискає великі дані,
 * маскує все, що схоже на ключ API. Повертає також перелік пропущених файлів.
 */
export function prepareDiff(diff: string): { text: string; dropped: string[] } {
  const dropped: string[] = [];
  const sections = diff.split(/^(?=diff --git )/m);
  const kept = sections.map((section) => {
    const path = /^diff --git a\/(\S+) b\/(\S+)/.exec(section)?.[2];
    if (!path) return section;
    if (SECRET_PATH.test(path)) {
      dropped.push(path);
      return '';
    }
    if (BULK_PATH.test(path) && !ALWAYS_FULL.has(path)) {
      const lines = section.split('\n');
      const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
      const removed = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length;
      const header = lines.filter((l) => /^(diff --git|new file|deleted file|--- |\+\+\+ )/.test(l)).join('\n');
      return `${header}\n[вміст пропущено верифікатором: +${added} / -${removed} рядків]\n`;
    }
    return section;
  });
  return { text: kept.join('').replace(KEY_PATTERN, '[КЛЮЧ ПРИХОВАНО]'), dropped };
}

export const JUDGE_SYSTEM = [
  'Ти — незалежний верифікатор зміни в репозиторії. Ти оцінюєш РІВНО ОДИН критерій приймання зі специфікації.',
  'Вхід: критерій (твердження і спосіб перевірки) та diff зміни. Іншого контексту немає.',
  'Поверни ЛИШЕ JSON-обʼєкт: {"id": "<номер критерію дослівно>", "verdict": "pass" | "fail" | "unknown", "reason": "<1–2 речення>", "evidence": "<файл і рядок або цитата з diff>"}.',
  'pass — diff прямо показує, що твердження виконується після цієї зміни.',
  'fail — diff прямо показує, що твердження порушено (наприклад, зміна видаляє чи ламає те, що критерій вимагає).',
  'unknown — у diff недостатньо даних: критерій вимагає запуску команди чи числа з файлу, якого в diff немає, або зміна цього критерію не стосується. Не вгадуй.',
  'Якщо файл, на який посилається критерій, у diff не зʼявляється взагалі, — це unknown, а не fail.',
  // уточнення після калібрування 1 (docs/lab2/verifier.md): c02/A4 і c05/A2 — unknown замість pass
  'Якщо критерій перевіряється командою, а diff містить УСІ дані, які ця команда перевіряє (повний перелік файлів, усі рядки набору), і з них прямо видно, що твердження виконується, — це pass: відсутність результату запуску сама по собі не підстава для unknown. Якщо видно лише частину даних (змінено частину файлів, немає кількох рядків) — unknown.',
  'Числа (скільки документів, скільки запитів) бери із самого твердження критерію, а не шукай їх в інших файлах.',
  'evidence порожній лише для unknown. Без загальних порад.',
].join('\n');

export function judgePrompt(c: Criterion, diff: string): string {
  return [
    `Критерій ${c.id}: ${c.statement}`,
    `Чим перевіряється: ${c.check}`,
    '',
    'Diff зміни:',
    '```diff',
    diff,
    '```',
  ].join('\n');
}

/** Виклик моделі: system + user → текст відповіді. */
export type Ask = (system: string, user: string) => Promise<string>;

function parseVerdict(text: string, id: string): CriterionVerdict | string {
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return 'відповідь не є JSON';
  }
  const parsed = criterionVerdict.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  if (parsed.data.id !== id) return `id "${parsed.data.id}" замість "${id}"`;
  if (parsed.data.verdict !== 'unknown' && parsed.data.evidence.trim() === '') return 'порожній evidence для pass/fail';
  return parsed.data;
}

/** Суддя по одному критерію: невалідну відповідь перепитує один раз, потім падає. */
export async function judgeCriterion(ask: Ask, c: Criterion, diff: string): Promise<CriterionVerdict> {
  const prompt = judgePrompt(c, diff);
  const first = parseVerdict(await ask(JUDGE_SYSTEM, prompt), c.id);
  if (typeof first !== 'string') return first;
  const retry = `${prompt}\n\nТвоя попередня відповідь не пройшла схему (${first}). Поверни лише JSON-обʼєкт за схемою.`;
  const second = parseVerdict(await ask(JUDGE_SYSTEM, retry), c.id);
  if (typeof second !== 'string') return second;
  throw new Error(`${c.id}: відповідь судді двічі не пройшла схему — ${second}`);
}
