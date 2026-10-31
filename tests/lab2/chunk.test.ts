import { describe, expect, it } from 'vitest';

import { chunkDocument, normalize, RULE } from '../../src/rag/chunk';
import { fakeEmbedder } from '../../src/rag/embed';
import { checkIndex, type IndexFile } from '../../src/rag/store';

const doc = `# Інструкція\n\n## Розділ 1\n${'А'.repeat(900)}\n\n${'Б'.repeat(900)}\n\n## Розділ 2\nКоротко.\n`;

describe('chunkDocument', () => {
  it('тримає інваріант зсувів', () => {
    const text = normalize(doc);
    for (const c of chunkDocument('doc-01', doc)) {
      expect(c.text).toBe(text.slice(c.start, c.end));
    }
  });

  it('не перевищує максимум', () => {
    for (const c of chunkDocument('doc-01', doc)) {
      expect(c.end - c.start).toBeLessThanOrEqual(RULE.maxChars);
    }
  });

  it('веде шлях заголовків', () => {
    const headings = chunkDocument('doc-01', doc).map((c) => c.heading);
    expect(headings).toContain('Інструкція › Розділ 1');
    expect(headings).toContain('Інструкція › Розділ 2');
  });

  it('детермінований: ті самі id на тому самому вході', () => {
    const a = chunkDocument('doc-01', doc).map((c) => c.id);
    const b = chunkDocument('doc-01', doc).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('шапка YAML не стає фрагментом, а зсуви лишаються зсувами у файлі', () => {
    const withMeta = `---\nid: egr\nlicense: CC BY-SA 4.0\n---\n\n${doc}`;
    const chunks = chunkDocument('egr', withMeta);
    expect(chunks.some((c) => c.text.includes('license:'))).toBe(false);
    expect(chunks[0]?.text.startsWith('# Інструкція')).toBe(true);
    for (const c of chunks) expect(c.text).toBe(normalize(withMeta).slice(c.start, c.end));
  });

  it('заголовок без тексту приєднується до наступного розділу', () => {
    const nested = `## Types\n\n### Two-way\n${'Текст про двокомпонентний каталізатор. '.repeat(10)}\n`;
    const chunks = chunkDocument('catalytic', nested);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text.startsWith('## Types\n\n### Two-way')).toBe(true);
    expect(chunks[0]?.heading).toBe('Types › Two-way');
  });

  it('довгу таблицю ріже по рядках, а не посеред клітинки', () => {
    const table = `## PIDs\n${Array.from({ length: 60 }, (_, i) => `${i} | Engine parameter number ${i} | 0 | 255`).join('\n')}\n`;
    for (const c of chunkDocument('obd-pids', table).slice(0, -1)) {
      expect(c.text.endsWith('\n')).toBe(true);
    }
  });
});

describe('checkIndex', () => {
  const index = { embedder: 'ollama:embeddinggemma-2:270m', dimensions: 768 } as IndexFile;

  it('падає з читабельною помилкою, якщо ембедер інший', () => {
    expect(() => checkIndex(index, fakeEmbedder(768))).toThrow('перебудуйте: npm run index');
  });
});
