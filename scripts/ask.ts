/**
 * Відповідь асистента з джерелами (крок 05). ХОДИТЬ У МЕРЕЖУ: локальна Ollama (ембедер запиту)
 * і OpenAI gpt-5.6-luna (платно — частки цента за запит), ключ — через --env-file:
 *
 *   npx tsx --env-file=<файл секретів> scripts/ask.ts "<запит>"
 *
 * Друкує відповідь, цитати у форматі retrieval.md і результат validateAnswer.
 */
import { chatCompletionsModel, type Fetch } from '../src/agent/adapters';
import { priceUsd } from '../src/cost';
import { CATALOG } from '../src/models';
import { ANSWER_SYSTEM, answerPrompt, isRefusal, REFUSAL, refusedByRetrieval } from '../src/rag/answer';
import { citedIds, renderCitation, toCitation, validateAnswer } from '../src/rag/cite';
import { ollamaEmbedder } from '../src/rag/embed';
import { bm25From, hybridSearch } from '../src/rag/search';
import { loadIndex } from '../src/rag/store';

// та сама модель, що в базовій лінії (scripts/baseline.ts), — інакше крок 06 незіставний
const SPEC = CATALOG['gpt-5.6-luna'];

async function main() {
  const query = process.argv[2];
  if (!query) throw new Error('вкажіть запит: scripts/ask.ts "<запит>"');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY порожній: запускайте з --env-file');

  const embedder = ollamaEmbedder();
  const index = loadIndex('data/index.json', embedder);
  const { hits } = await hybridSearch(index, bm25From(index), embedder, query);
  console.log(`Видані фрагменти: ${hits.map((h) => `${h.chunk.id} (cos ${h.cosine.toFixed(4)})`).join(', ')}`);

  if (refusedByRetrieval(hits)) {
    console.log(`\nВідмова на рівні пошуку (косинус топ-1 нижче порога):\n${REFUSAL}`);
    return;
  }

  const plain: Fetch = (url, init) => {
    const { tools: _tools, ...body } = JSON.parse(String(init.body)) as Record<string, unknown>;
    return fetch(url, { ...init, body: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
  };
  const model = chatCompletionsModel({
    url: 'https://api.openai.com/v1/chat/completions',
    model: SPEC.id,
    headers: { authorization: `Bearer ${key}` },
    fetch: plain,
  });
  const started = Date.now();
  const turn = await model(ANSWER_SYSTEM, [{ role: 'user', text: answerPrompt(query, hits) }], []);
  const latency = Date.now() - started;

  console.log(`\nВідповідь асистента (дослівно):\n${turn.text}\n`);
  if (isRefusal(turn.text)) {
    console.log('Відмова моделі: у виданих фрагментах відповіді немає.');
  } else {
    const byId = new Map(hits.map((h) => [h.chunk.id, h.chunk]));
    console.log('Джерела:');
    for (const id of citedIds(turn.text)) {
      const chunk = byId.get(id);
      console.log(`  ${chunk ? renderCitation(toCitation(chunk, '')) : `[${id}] — НЕ видавався`}`);
    }
    const problems = validateAnswer(turn.text, hits.map((h) => h.chunk));
    console.log(`validateAnswer: проблем ${problems.length}${problems.length > 0 ? ` — ${problems.join('; ')}` : ''}`);
  }
  console.log(`\n${SPEC.id} · ${turn.usage.inputTokens}/${turn.usage.outputTokens} ток. · $${priceUsd(SPEC, turn.usage).toFixed(6)} · ${latency} мс`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
