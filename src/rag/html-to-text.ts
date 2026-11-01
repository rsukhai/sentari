/**
 * HTML статті Вікіпедії (MediaWiki action=parse) → простий текст для пошуку.
 * На відміну від explaintext, зберігає таблиці: рядок таблиці → «клітинка | клітинка».
 * Без залежностей і без DOM — регулярні вирази покривають розмітку MediaWiki, а не довільний HTML.
 */

/** Розділи-хвости, що не несуть змісту для відповіді. */
const TAIL_SECTIONS = ['See also', 'References', 'Notes', 'Further reading', 'External links', 'Bibliography'];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', minus: '−', times: '×', deg: '°' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

/** Вміст клітинки — в один рядок. */
const cellText = (inner: string) =>
  decodeEntities(stripTags(inner.replace(/<br\s*\/?>/gi, '; ')))
    .replace(/\s+/g, ' ')
    .trim();

export function wikiHtmlToText(html: string): string {
  let s = html;

  // відрізаємо хвіст від першого службового розділу
  const tail = new RegExp(`<h2[^>]*id="(${TAIL_SECTIONS.map((t) => t.replace(/ /g, '_')).join('|')})"`, 'i');
  const cut = s.search(tail);
  if (cut >= 0) s = s.slice(0, cut);

  s = s
    // формули: лишаємо TeX з alttext замість MathML і картинки-заглушки
    .replace(/<math[^>]*alttext="([^"]*)"[\s\S]*?<\/math>/gi, (_, tex: string) => ` ${decodeEntities(tex)} `)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // службові плашки редакторів («This section needs more citations…»)
    .replace(/<table[^>]*class="[^"]*\b(ambox|box-[\w-]+)\b[^"]*"[\s\S]*?<\/table>/gi, '')
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<div[^>]*class="[^"]*(navbox|reflist|mw-references-wrap)[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span>\s*<\/span>/gi, '');

  // заголовки — Markdown (h2 → ##): за ними ріже src/rag/chunk.ts
  s = s.replace(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) => {
    return `\n\n${'#'.repeat(Number(level))} ${cellText(inner)}\n`;
  });

  // таблиці: кожен <tr> — один рядок, клітинки через « | »; пробіли між тегами таблиці — шум
  s = s
    .replace(/(<\/?(?:table|tbody|thead|tfoot|tr|td|th)\b[^>]*>)\s+/gi, '$1')
    .replace(/<caption[^>]*>([\s\S]*?)<\/caption>/gi, (_, inner: string) => `\n${cellText(inner)}\n`)
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row: string) => {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1] ?? ''));
      return `${cells.join(' | ')}\n`;
    })
    .replace(/<\/?table[^>]*>/gi, '\n');

  // блоки й списки (<li\b — щоб не зачепити <link>)
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|li|ul|ol|dl|dd|dt|blockquote|figure|figcaption)>/gi, '\n');

  return decodeEntities(stripTags(s))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/\s*\|\s*$/, '').trim())
    // хвіст складеної плашки (таблиця в таблиці), який не зрізав регулярний вираз вище
    .filter((line) => line !== '(Learn how and when to remove this message)')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
