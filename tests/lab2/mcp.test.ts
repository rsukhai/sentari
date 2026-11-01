import { describe, expect, it } from 'vitest';

import { fetchChunk, fetchInput, searchCorpus, searchInput, withTimeout, type Deps } from '../../src/mcp/tools';
import { buildBm25 } from '../../src/rag/bm25';
import { fakeEmbedder, type Embedder } from '../../src/rag/embed';

const embedder = fakeEmbedder();

async function fixture(e: Embedder = embedder): Promise<Deps> {
  const raw = [
    { id: 'egr#0000', docId: 'egr', heading: 'Problems', start: 0, end: 60, text: 'The EGR valve can become clogged with carbon deposits.' },
    { id: 'maf#0000', docId: 'maf', heading: 'Cleaning', start: 0, end: 50, text: 'Use a dedicated MAF sensor cleaner, not brake cleaner.' },
  ];
  const chunks = await Promise.all(raw.map(async (c) => ({ ...c, vector: await embedder.embedQuery(c.text) })));
  const index = { embedder: embedder.id, dimensions: 64, chunks, documents: [] } as unknown as Deps['index'];
  return { index, words: buildBm25(chunks.map((c) => ({ id: c.id, text: c.text }))), embedder: e };
}

describe('інструменти MCP-сервера', () => {
  it('нормальний виклик: пошук знаходить фрагмент і цитує його', async () => {
    const parts = await searchCorpus(await fixture(), { query: 'MAF sensor cleaner', topK: 2 });
    expect(parts.length).toBeGreaterThan(0);
    expect(parts[0]).toContain('[maf#0000] maf › Cleaning · символи 0–50');
    expect(fetchChunk(await fixture(), { id: 'egr#0000' })).toContain('clogged with carbon deposits');
  });

  it('порушення схеми: виклик не вдається і обробник не починає роботу', async () => {
    expect(searchInput.safeParse({ query: 'ок', topK: 10_000 }).success).toBe(false);
    expect(searchInput.safeParse({ query: '', topK: 1 }).success).toBe(false);
    expect(searchInput.safeParse({ query: 'x'.repeat(501) }).success).toBe(false);
    expect(searchInput.safeParse({ query: 'x', path: '/etc' }).success).toBe(false); // .strict()
    expect(fetchInput.safeParse({ id: 'egr#7' }).success).toBe(false);
    expect(searchInput.parse({ query: 'x' }).topK).toBe(5); // типове значення — як у застосунку
    await expect(searchCorpus(await fixture(), { query: 'ок', topK: 10_000 })).rejects.toThrow();
  });

  it('ВІДМОВА: вийти за межі індексу не вдається — головний тест кроку', async () => {
    const deps = await fixture();
    // шлях не проходить навіть схему: параметра-шляху немає, а в шаблоні id немає / \ .
    expect(fetchInput.safeParse({ id: '../../.env' }).success).toBe(false);
    expect(fetchInput.safeParse({ id: 'C:\\Users\\me\\.ssh\\id_rsa' }).success).toBe(false);
    expect(fetchInput.safeParse({ id: 'egr#0000" OR 1=1' }).success).toBe(false);
    // формально правильний id, якого немає в індексі, — ВІДМОВА з причиною
    expect(() => fetchChunk(deps, { id: 'egr#9999' })).toThrowError(/немає в індексі/);
  });

  it('таймаут: завислий ембедер перетворюється на відмову з причиною', async () => {
    const hanging: Embedder = { ...embedder, embedQuery: () => new Promise(() => {}) };
    await expect(searchCorpus(await fixture(hanging), { query: 'EGR' }, 50)).rejects.toThrow('перевищено таймаут 50 мс');
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
});
