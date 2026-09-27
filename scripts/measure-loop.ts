/**
 * Прогін власного циклу на задачі /api/health (крок 08). ХОДИТЬ У МЕРЕЖУ — лише вручну,
 * з кореня репозиторію:
 *
 *   npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-messages 10
 *   npx tsx --env-file=.env.local scripts/measure-loop.ts ollama-chat 1
 *   npx tsx --env-file=.env.local scripts/measure-loop.ts gemini 1
 *   npx tsx --env-file=.env.local scripts/measure-loop.ts openai 1       хмара, крок 11 (платно, центи)
 *   npx tsx --env-file=.env.local scripts/measure-loop.ts openrouter 1   шлюз, крок 11 (:free-модель)
 *
 * Кожен виклик інструмента дописується в .agent-log/agent-loop.jsonl.
 * Числа кожного прогону переносьте в таблицю docs/lab1/comparison.md.
 */
import { z } from 'zod';

import { chatCompletionsModel, messagesModel, type Fetch } from '../src/agent/adapters';
import { runAgentLoop, type Model } from '../src/agent/agent-loop';
import { createTools, jsonlLogger } from '../src/agent/tools';
import { priceUsd } from '../src/cost';
import { CATALOG, MODELS, type ModelSpec } from '../src/models';

const Proposal = z
  .object({
    summary: z.string().min(1),
    files: z.array(z.object({ path: z.string().min(1), content: z.string().min(1) }).strict()).min(1),
  })
  .strict();

const SYSTEM = [
  'Ти агент кодування в цьому репозиторії (Next.js App Router, TypeScript strict, Vitest).',
  'Маєш лише інструменти читання list_files і read_file. Спершу прочитай потрібні файли.',
  'Коли рішення готове, відповідай БЕЗ викликів інструментів, лише JSON:',
  '{"summary": "що зроблено", "files": [{"path": "відносний шлях", "content": "повний вміст файлу"}]}',
].join('\n');
const TASK =
  'Додай ендпоінт GET /api/health так, щоб проходив tests/health.test.ts (контракт — src/health.ts). Запропонуй повний вміст файлів.';

function pick(kind: string): { model: Model; spec: ModelSpec; form: string } {
  if (kind === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY порожній: заповніть .env.local');
    const spec = CATALOG['gemini-3.8-flash'];
    const raw = chatCompletionsModel({
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: spec.id,
      headers: { authorization: `Bearer ${key}` },
    });
    // Безкоштовний рівень: 5 запитів на хвилину, а кожен крок циклу — окремий запит.
    // Без паузи цикл на 6-му кроці отримував HTTP 429, тож між викликами — 13 с.
    let calls = 0;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const throttled: Model = async (system, messages, tools) => {
      if (calls++ > 0) await sleep(13_000);
      // HTTP 503 «high demand» — тимчасове перевантаження: до 3 спроб з паузою 20 с.
      // HTTP 429 (квота) не повторюємо — прогони мають зупинитися, щоб не спалити квоту.
      for (let attempt = 1; ; attempt++) {
        try {
          return await raw(system, messages, tools);
        } catch (error) {
          if (attempt >= 3 || !(error instanceof Error && error.message.includes('HTTP 503'))) throw error;
          console.warn(`  503, повтор ${attempt}/2 через 20 с`);
          await sleep(20_000);
        }
      }
    };
    return { spec, form: 'chat-completions', model: throttled };
  }
  if (kind === 'openai') {
    // Хмарний прогін кроку 11 замість Gemini (денна квота free tier вичерпана). Платно: центи.
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY порожній: заповніть .env.local');
    const spec = CATALOG['gpt-5.6-luna'];
    // gpt-5.6 у /v1/chat/completions не приймає інструменти разом із «роздумами» (HTTP 400) —
    // додаємо reasoning_effort: 'none', не змінюючи адаптер.
    const noReasoning: Fetch = (url, init) =>
      fetch(url, { ...init, body: JSON.stringify({ ...JSON.parse(String(init.body)), reasoning_effort: 'none' }) });
    return {
      spec,
      form: 'chat-completions',
      model: chatCompletionsModel({
        url: 'https://api.openai.com/v1/chat/completions',
        model: spec.id,
        headers: { authorization: `Bearer ${key}` },
        fetch: noReasoning,
      }),
    };
  }
  if (kind === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    const id = process.env.OPENROUTER_MODEL;
    if (!key || !id) throw new Error('OPENROUTER_API_KEY або OPENROUTER_MODEL порожні: заповніть .env.local');
    // Шлюзу немає в models.ts: для :free-моделі ціни 0; для платної впишіть ціни за 1 млн токенів зі сторінки моделі на OpenRouter.
    // provider: 'openai' — бо форма API OpenAI-сумісна; окремого значення для шлюзу в типі Provider немає.
    const spec: ModelSpec = { id, provider: 'openai', inputPerMTok: 0, outputPerMTok: 0, pricingUrl: 'https://openrouter.ai/models' };
    return {
      spec,
      form: 'chat-completions',
      model: chatCompletionsModel({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        model: id,
        headers: { authorization: `Bearer ${key}` },
      }),
    };
  }
  const spec = MODELS.local;
  if (kind === 'ollama-messages') {
    // qwen3:4b спершу «думає» (блок thinking) — з типовими 2048 токенами роздуми з'їдали весь ліміт,
    // JSON обрізався й не проходив схему (перші прогони — max-steps). Тому ліміт виходу більший.
    return { spec, form: 'messages', model: messagesModel({ url: `${spec.baseUrl}/v1/messages`, model: spec.id, maxTokens: 8192 }) };
  }
  if (kind === 'ollama-chat') {
    return { spec, form: 'chat-completions', model: chatCompletionsModel({ url: `${spec.baseUrl}/v1/chat/completions`, model: spec.id }) };
  }
  throw new Error(`Невідомий провайдер «${kind}». Є: ollama-messages, ollama-chat, gemini, openai, openrouter`);
}

const [kind = 'ollama-messages', runsArg = '1'] = process.argv.slice(2);
const { model, spec, form } = pick(kind);
const runs = Number(runsArg);
const tools = createTools(process.cwd());
const log = jsonlLogger('.agent-log/agent-loop.jsonl');
let valid = 0;
let firstOutput: unknown;

console.log('| # | провайдер | форма API | модель | зупинка | кроки | вхідні | кешовані | вихідні | $ фактично | $ за прайсом | затримка, мс | session |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (let i = 1; i <= runs; i++) {
  const session = `agent-loop-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const started = performance.now();
  try {
    const r = await runAgentLoop({
      model, tools, system: SYSTEM, task: TASK, output: Proposal, maxSteps: 12, tokenBudget: 150_000, session, log,
    });
    const ms = Math.round(performance.now() - started);
    const u = r.usage;
    console.log(
      `| ${i} | ${kind} | ${form} | ${spec.id} | ${r.stop} | ${r.steps} | ${u.inputTokens} | ${u.cachedTokens} | ${u.outputTokens} | 0 | ${priceUsd(spec, u).toFixed(6)} | ${ms} | ${session} |`,
    );
    if (r.stop === 'done') {
      valid++;
      firstOutput ??= r.output;
    }
  } catch (error) {
    // 429 чи обрив мережі: не крутимо далі, щоб не спалити квоту
    console.error(`Прогін ${i} перервано:`, error instanceof Error ? error.message : error);
    break;
  }
}
console.log(`\nВалідних структурованих виходів: ${valid} з ${runs}`);
if (firstOutput !== undefined) {
  // Пропозицію застосовуєте ВИ (цикл має лише інструменти читання), потім npm test.
  console.log(JSON.stringify(firstOutput, null, 2));
}
