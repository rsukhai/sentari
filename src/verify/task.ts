/**
 * Верифікатор задачі харнеса (Лаб. 3, крок 02): критерії беруться з задачі черги, а не зі spec.md.
 * Чисті функції — без мережі й без файлової системи (читання файлів передається параметром).
 */
import type { Criterion } from './judge';
import type { Provider } from '../models';
import type { Task } from '../../scripts/harness/run-task';

/** Файли секретів (крім шаблону .env.example). */
const SECRET_PATH = /(^|\/)\.env(?!\.example$)[^/]*$/;

/** Скільки перших рядків файлу довідки бачить суддя. */
export const CONTEXT_HEAD_LINES = 25;

export const TASK_JUDGE_SYSTEM = [
  'Ти — незалежний верифікатор зміни, яку автономний агент зробив за завданням. Ти оцінюєш РІВНО ОДИН критерій приймання.',
  'Вхід: завдання, яке мав виконати агент; критерій; довідка (початок файлів, на які посилається завдання); diff зміни. Іншого контексту немає, команди ти не запускаєш.',
  'Поверни ЛИШЕ JSON-обʼєкт: {"id": "<номер критерію дослівно>", "verdict": "pass" | "fail" | "unknown", "reason": "<1–2 речення>", "evidence": "<файл і рядок або цитата з diff чи довідки>"}.',
  'pass — diff (з довідкою) прямо показує, що твердження критерію виконується буквально так, як воно сформульоване.',
  'fail — diff прямо показує, що твердження порушено, АБО критерій вимагає чогось, що мало б бути в diff (рядок коду, тест, текст), а його там немає.',
  'unknown — з наданих даних судження неможливе: критерій вимагає запуску команди, вмісту файлу, якого немає в diff і довідці, або результату, який diff не показує. Не вгадуй.',
  'Не перевіряй те, чого критерій не стверджує. Не виправляй і не переписуй зміну; не давай загальних порад.',
  'evidence порожній лише для unknown.',
].join('\n');

/** Критерії задачі → формат судді. Задача без criteria не може пройти верифікатор: брама не мовчить. */
export function taskCriteria(task: Pick<Task, 'id' | 'criteria'>): Criterion[] {
  if (!task.criteria || task.criteria.length === 0) {
    throw new Error(`${task.id}: у задачі немає criteria — верифікатору нічого перевіряти`);
  }
  return task.criteria.map((c) => ({
    id: c.id,
    statement: c.statement,
    check: 'за diff зміни, текстом завдання і довідкою',
  }));
}

/**
 * Довідка для судді: текст завдання + початок файлів із task.context.
 * `readFile` повертає текст файлу або null, якщо файлу немає (тоді він позначається, а не мовчки пропускається).
 */
export function taskContext(task: Pick<Task, 'input' | 'context'>, readFile: (path: string) => string | null): string {
  const parts = [`Завдання, яке виконував агент: ${task.input}`];
  for (const path of task.context ?? []) {
    // довідка йде у публічний запит до сторонньої моделі: файли секретів сюди не потрапляють ніколи
    if (SECRET_PATH.test(path)) throw new Error(`context: «${path}» — файл секретів, у запит до верифікатора він не йде`);
    const text = readFile(path);
    if (text === null) {
      parts.push(`### ${path}\n[файлу немає в дереві]`);
      continue;
    }
    parts.push(`### ${path} (перші ${CONTEXT_HEAD_LINES} рядків)\n${text.split(/\r?\n/).slice(0, CONTEXT_HEAD_LINES).join('\n')}`);
  }
  return parts.join('\n\n');
}

/** Виконавець — Claude Code (родина Anthropic); інші шляхи фабрики поки не підтримані. */
export function executorProvider(agentPath: string): Provider {
  if (agentPath.startsWith('claude-code')) return 'anthropic';
  throw new Error(`невідомий шлях агента «${agentPath}»: родину виконавця не визначено`);
}

/** Пастка кроку 02: та сама родина судить сама себе. Відмова, а не попередження. */
export function assertOtherFamily(executor: Provider, verifier: Provider): void {
  if (executor === verifier) {
    throw new Error(`верифікатор тієї самої родини (${verifier}), що й виконавець: потрібна модель іншого провайдера`);
  }
}
