/**
 * Колекція документів Лаб. 2 (розділ 2 docs/lab2/spec.md).
 *
 *   npx tsx scripts/lab2/fetch-obd.ts         ХОДИТЬ У МЕРЕЖУ: завантажує статті Вікіпедії в data/obd/
 *   npx tsx scripts/lab2/fetch-obd.ts check   критерій A4, без мережі: усі документи на місці → exit 0
 *
 * Текст береться через MediaWiki API (action=parse, HTML → текст зі збереженими таблицями)
 * разом із revision id — тож кожен файл відтворюється за посиланням oldid. Ліцензія CC BY-SA 4.0 вимагає атрибуції,
 * тому вона стоїть у шапці кожного файлу.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { checkCorpus, docFile, parseDocTable, wikiTitle, type DocRef } from '../../src/rag/corpus';
import { wikiHtmlToText } from '../../src/rag/html-to-text';

const SPEC = 'docs/lab2/spec.md';
const DIR = 'data/obd';
const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'sentari-lab2/0.1 (https://github.com/rsukhai/sentari)';

interface ParseResult {
  parse?: { title: string; revid: number; text: string };
  error?: { info: string };
}

async function fetchDoc(doc: DocRef): Promise<string> {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'text|revid',
    disableeditsection: '1',
    disabletoc: '1',
    page: wikiTitle(doc.url),
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${doc.id}: HTTP ${res.status}`);
  const body = (await res.json()) as ParseResult;
  if (!body.parse) throw new Error(`${doc.id}: ${body.error?.info ?? 'статтю не знайдено'}`);
  const { title, revid, text } = body.parse;
  return [
    `---`,
    `id: ${doc.id}`,
    `title: ${title}`,
    `source: ${doc.url}`,
    `revision: https://en.wikipedia.org/w/index.php?oldid=${revid}`,
    `fetched: ${new Date().toISOString().slice(0, 10)}`,
    `license: ${doc.license} (Wikipedia contributors)`,
    `---`,
    ``,
    `# ${title}`,
    ``,
    wikiHtmlToText(text),
    ``,
  ].join('\n');
}

async function readCorpus(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const names = await readdir(DIR).catch(() => [] as string[]);
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    files.set(name, await readFile(join(DIR, name), 'utf8'));
  }
  return files;
}

async function main() {
  const docs = parseDocTable(await readFile(SPEC, 'utf8'));

  if (process.argv[2] === 'check') {
    const files = await readCorpus();
    const problems = checkCorpus(docs, files);
    if (problems.length > 0) {
      console.error(problems.map((p) => `  x ${p}`).join('\n'));
      process.exit(1);
    }
    const chars = [...files.values()].reduce((n, t) => n + t.length, 0);
    console.log(`колекція повна: ${files.size} документів, ${chars} символів`);
    return;
  }

  await mkdir(DIR, { recursive: true });
  for (const doc of docs) {
    const text = await fetchDoc(doc);
    await writeFile(join(DIR, docFile(doc.id)), text, 'utf8');
    console.log(`${doc.id.padEnd(15)} ${String(text.length).padStart(7)} симв.`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
