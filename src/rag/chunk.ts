/**
 * ФРАГМЕНТАЦІЯ (крок 04). Чиста функція: без мережі, без файлової системи.
 *
 * Правило — docs/lab2/indexing.md, розділ 2: межі за заголовками Markdown,
 * задовгий розділ добиваємо за абзацами й реченнями, короткі огризки
 * приклеюємо до попереднього.
 *
 * Інваріант, від якого залежить цитування на кроці 05:
 *   chunk.text === normalize(raw).slice(chunk.start, chunk.end)
 */

export interface ChunkRule {
  /** Цільовий максимум фрагмента в символах. */
  readonly maxChars: number;
  /** Коротший фрагмент приклеюємо до попереднього. */
  readonly minChars: number;
  /** Перекриття сусідніх фрагментів у символах. */
  readonly overlapChars: number;
}

/** Обрано власником репозиторію за вимірами колекції (indexing.md, розділ 2). */
export const RULE: ChunkRule = { maxChars: 1200, minChars: 200, overlapChars: 120 };

export interface Chunk {
  /** obd#0007 — стабільний: залежить лише від id документа і порядку. */
  readonly id: string;
  readonly docId: string;
  /** Шлях заголовків: «EGR › Diesel engines». Порожній, якщо заголовків немає. */
  readonly heading: string;
  /** 0-based зсув у НОРМАЛІЗОВАНОМУ тексті документа. */
  readonly start: number;
  /** Виключно: text === normalized.slice(start, end). */
  readonly end: number;
  readonly text: string;
}

/** Нормалізація — частина індексу. Змінили її — перебудуйте індекс. */
export function normalize(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
}

interface Span {
  start: number;
  end: number;
}

/** Розділи між рядками-заголовками. Заголовок лишається ВСЕРЕДИНІ розділу. */
function sections(text: string): { heading: string; span: Span }[] {
  const out: { heading: string; span: Span }[] = [];
  const path: string[] = [];
  let current = { heading: '', start: 0 };
  let offset = 0;
  for (const line of text.split('\n')) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (m?.[1] && m[2]) {
      if (offset > current.start) out.push({ heading: current.heading, span: { start: current.start, end: offset } });
      const level = m[1].length;
      path.length = level - 1;
      path[level - 1] = m[2].trim();
      current = { heading: path.filter(Boolean).join(' › '), start: offset };
    }
    offset += line.length + 1; // +1 — це '\n'
  }
  out.push({ heading: current.heading, span: { start: current.start, end: text.length } });
  // шапка YAML (---…---: джерело, ліцензія, ревізія) — метадані, а не зміст: у фрагменти не йде
  const frontMatter = /^---\n[\s\S]*?\n---\n/.exec(text)?.[0].length ?? 0;
  const kept = out
    .map((s) => ({ heading: s.heading, span: { start: Math.max(s.span.start, frontMatter), end: s.span.end } }))
    .filter((s) => s.span.end > s.span.start && text.slice(s.span.start, s.span.end).trim() !== '');
  // розділ, у якому лише рядок заголовка («## Applications», одразу за ним «### …»), — не зміст:
  // приєднуємо його до наступного розділу, щоб не було фрагментів-заголовків без тексту
  const merged: { heading: string; span: Span }[] = [];
  let carry: number | null = null;
  for (const [i, s] of kept.entries()) {
    const body = text.slice(s.span.start, s.span.end).replace(/^#{1,6}\s+.+\n?/, '').trim();
    const next = kept[i + 1];
    if (body === '' && next !== undefined && next.span.start === s.span.end) {
      carry ??= s.span.start;
      continue;
    }
    merged.push({ heading: s.heading, span: { start: carry ?? s.span.start, end: s.span.end } });
    carry = null;
  }
  return merged;
}

/**
 * Остання межа у вікні — але лише в його другій половині: інакше розділ на
 * 1200 символів різався б після першого ж абзацу на 40 символів.
 */
function lastBoundary(window: string, re: RegExp): number | null {
  let found: number | null = null;
  for (const m of window.matchAll(re)) found = (m.index ?? 0) + m[0].length;
  return found !== null && found > window.length / 2 ? found : null;
}

function split(text: string, span: Span, rule: ChunkRule): Span[] {
  const pieces: Span[] = [];
  let start = span.start;
  while (span.end - start > rule.maxChars) {
    const window = text.slice(start, start + rule.maxChars);
    const cut =
      lastBoundary(window, /\n{2,}/g) ?? // 1. порожній рядок
      lastBoundary(window, /\n/g) ?? // 2. кінець рядка (рядок таблиці «клітинка | клітинка»)
      lastBoundary(window, /[.!?…»]\s/g) ?? // 3. кінець речення
      lastBoundary(window, /\s/g) ?? // 4. хоч пробіл
      rule.maxChars; // 5. різати всередині слова
    const end = start + cut;
    pieces.push({ start, end });
    // перекриття: відступаємо назад і виходимо на межу слова
    const back = Math.max(end - rule.overlapChars, start + 1);
    const ws = text.slice(back, end).search(/\s/);
    start = ws > 0 ? back + ws + 1 : back;
  }
  pieces.push({ start, end: span.end });
  return pieces;
}

export function chunkDocument(docId: string, raw: string, rule: ChunkRule = RULE): Chunk[] {
  const text = normalize(raw);
  const parts: { heading: string; span: Span }[] = [];
  for (const section of sections(text)) {
    for (const span of split(text, section.span, rule)) parts.push({ heading: section.heading, span });
  }
  // огризки коротші за minChars приклеюємо до попереднього фрагмента того ж розділу
  const merged: { heading: string; span: Span }[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    const short = part.span.end - part.span.start < rule.minChars;
    const fits = prev !== undefined && part.span.end - prev.span.start <= rule.maxChars + rule.overlapChars;
    if (prev !== undefined && short && fits && prev.heading === part.heading) {
      merged[merged.length - 1] = { heading: prev.heading, span: { start: prev.span.start, end: part.span.end } };
    } else {
      merged.push(part);
    }
  }
  return merged.map((part, i) => ({
    id: `${docId}#${String(i).padStart(4, '0')}`,
    docId,
    heading: part.heading,
    start: part.span.start,
    end: part.span.end,
    text: text.slice(part.span.start, part.span.end),
  }));
}
