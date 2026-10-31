/**
 * Колекція документів Лаб. 2: перелік береться з таблиці розділу 2 docs/lab2/spec.md,
 * щоб джерело правди було одне. Чисті функції — без файлів і мережі, тому тестуються в CI.
 */

export interface DocRef {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly license: string;
}

/** Розбирає таблицю «| id | назва | джерело | ліцензія | … |» з розділу 2 специфікації. */
export function parseDocTable(specMd: string): DocRef[] {
  const section = specMd.split(/^## /m).find((s) => s.startsWith('2.'));
  if (!section) return [];
  const docs: DocRef[] = [];
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim());
    // рядок таблиці: '', id, назва, url, ліцензія, чому, ''
    if (cells.length < 6) continue;
    const [, id, title, url, license] = cells;
    if (!id || !title || !url || !license || !url.startsWith('http')) continue;
    docs.push({ id, title, url, license });
  }
  return docs;
}

/** Назва статті Вікіпедії з URL: https://en.wikipedia.org/wiki/CAN_bus → «CAN bus». */
export function wikiTitle(url: string): string {
  const slug = url.split('/wiki/')[1] ?? '';
  return decodeURIComponent(slug).replace(/_/g, ' ');
}

/** Файл документа в data/obd/ за його id. */
export const docFile = (id: string) => `${id}.md`;

/**
 * Критерій A4: усі документи зі специфікації лежать у колекції й не порожні.
 * `files` — імʼя файлу → вміст. Повертає перелік проблем; порожній = «зелено».
 */
export function checkCorpus(docs: readonly DocRef[], files: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  if (docs.length === 0) problems.push('у spec.md не знайдено таблиці документів');
  const ids = new Set<string>();
  for (const doc of docs) {
    if (ids.has(doc.id)) problems.push(`id "${doc.id}" повторюється в spec.md`);
    ids.add(doc.id);
    const text = files.get(docFile(doc.id));
    if (text === undefined) problems.push(`${doc.id}: немає файлу ${docFile(doc.id)}`);
    else if (text.trim().length < 500) problems.push(`${doc.id}: документ підозріло короткий`);
  }
  for (const name of files.keys()) {
    if (!ids.has(name.replace(/\.md$/, ''))) problems.push(`${name}: файл не описаний у spec.md`);
  }
  return problems;
}
