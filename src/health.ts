/**
 * Дані для ендпоінта `/api/health`.
 *
 * Логіка тут навмисно чиста: без мережі, без секретів і без звертання до
 * `Date.now()` чи `process.uptime()` всередині. Час і аптайм приходять
 * аргументами, тому функцію можна перевірити тестом без підміни годинника.
 */

/** Стан застосунку. Поки перевірок немає, `ok` — єдиний можливий результат. */
export type HealthStatus = 'ok';

export interface HealthReport {
  readonly status: HealthStatus;
  /** Момент відповіді в ISO-8601, UTC. */
  readonly timestamp: string;
  /** Скільки процес живий, у секундах, заокруглено до цілого. */
  readonly uptimeSeconds: number;
  /** Версія з `package.json`; `unknown`, якщо змінну не задано під час збірки. */
  readonly version: string;
}

/**
 * Збирає звіт про стан.
 *
 * @param now момент відповіді
 * @param uptimeSeconds аптайм процесу в секундах (`process.uptime()`)
 * @param version версія застосунку
 */
export function buildHealthReport(
  now: Date,
  uptimeSeconds: number,
  version: string,
): HealthReport {
  return {
    status: 'ok',
    timestamp: now.toISOString(),
    // Від'ємний аптайм неможливий, але зрізаємо його тут, а не в роуті:
    // тоді жоден виклик не зможе повернути безглузде число.
    uptimeSeconds: Math.max(0, Math.round(uptimeSeconds)),
    version,
  };
}
