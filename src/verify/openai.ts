/**
 * Виклик верифікатора через OpenAI Chat Completions (ХОДИТЬ У МЕРЕЖУ, платно — центи).
 * Те саме з'єднання, що в scripts/verify.ts (Лаб. 2), винесене сюди, щоб харнес не копіював його вдруге.
 * fetch передається параметром: тести підставляють підробку.
 */
import { chatCompletionsModel, type Fetch } from '../agent/adapters';
import { addUsage, priceUsd, ZERO_USAGE, type Usage } from '../cost';
import { CATALOG } from '../models';
import type { Ask } from './judge';

export interface OpenAiJudge {
  readonly ask: Ask;
  readonly provider: 'openai';
  readonly modelId: string;
  readonly usage: () => Usage;
  readonly costUsd: () => number;
}

export function openAiJudge(key: string, modelId: string, send: Fetch = fetch): OpenAiJudge {
  const spec = Object.values(CATALOG).find((s) => s.id === modelId);
  if (!spec || spec.provider !== 'openai') throw new Error(`модель «${modelId}» немає серед моделей OpenAI у src/models.ts`);

  // без інструментів OpenAI не приймає порожній tools; відповідь — JSON-обʼєкт
  const jsonOnly: Fetch = (url, init) => {
    const { tools: _tools, ...body } = JSON.parse(String(init.body)) as Record<string, unknown>;
    return send(url, { ...init, body: JSON.stringify({ ...body, response_format: { type: 'json_object' } }) });
  };
  const model = chatCompletionsModel({
    url: 'https://api.openai.com/v1/chat/completions',
    model: spec.id,
    headers: { authorization: `Bearer ${key}` },
    fetch: jsonOnly,
  });
  let usage = ZERO_USAGE;
  const ask: Ask = async (system, user) => {
    const turn = await model(system, [{ role: 'user', text: user }], []);
    usage = addUsage(usage, turn.usage);
    return turn.text;
  };
  return { ask, provider: 'openai', modelId: spec.id, usage: () => usage, costUsd: () => priceUsd(spec, usage) };
}
