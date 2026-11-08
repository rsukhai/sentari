/**
 * Пул фіксованої ширини з бюджетом (крок 07). Без залежностей і без мережі.
 * Чому не Promise.all над усіма задачами: ширина не обмежена, і Promise.all відкидається
 * на ПЕРШІЙ помилці (429), гублячи облік гілок, що вже відпрацювали. Тут кожна гілка
 * ловить свою помилку сама.
 */

/** БЮДЖЕТ. Записано ДО запуску; ті самі числа — у docs/lab2/budget.md, розділ 2. */
export interface Budget {
  /** Максимум гілок, що виконуються одночасно. */
  readonly maxBranches: number;
  /** Стеля токенів на весь прогін: нова гілка не стартує, коли її перетнуто. */
  readonly maxTokens: number;
  /** Стеля часу стіни на весь прогін, мс. */
  readonly maxWallMs: number;
}

/** 8 — ширше на 20 запитах уже нема куди; 50 000 — токени кроку 06 (23 710) із запасом ×2; 10 хв. */
export const BUDGET: Budget = { maxBranches: 8, maxTokens: 50_000, maxWallMs: 10 * 60_000 };

export async function runPool<T>(
  tasks: readonly (() => Promise<T>)[],
  budget: Budget,
  spentTokens: () => number,
  now: () => number = () => performance.now(),
): Promise<{ results: (T | Error | undefined)[]; stoppedEarly: boolean }> {
  const results: (T | Error | undefined)[] = new Array(tasks.length);
  const startedAt = now();
  let next = 0;
  let stoppedEarly = false;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      // ПРАВИЛО ЗУПИНКИ: перевіряється перед стартом нової гілки, а не всередині неї.
      if (spentTokens() >= budget.maxTokens || now() - startedAt >= budget.maxWallMs) {
        stoppedEarly = true;
        return;
      }
      const i = next++;
      const task = tasks[i];
      if (!task) continue;
      try {
        results[i] = await task();
      } catch (error) {
        results[i] = error instanceof Error ? error : new Error(String(error));
      }
    }
  };
  const width = Math.max(1, Math.min(budget.maxBranches, tasks.length));
  await Promise.all(Array.from({ length: width }, worker));
  return { results, stoppedEarly };
}
