/**
 * Circuit breaker фабрики (Лаб. 3, крок 03). Стани за Фаулером: closed (пропускаємо), open (не пропускаємо нічого),
 * half-open (рівно одна пробна задача). Це моє інженерне рішення за аналогією, а не усталена практика для агентних
 * циклів: див. docs/lab3/stop.md, «Походження патерну».
 *
 * Логіка — чисті функції (час передається параметром); стан між прогонами живе у файлі, а не в змінній процесу.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const BREAKER_FILE = '.harness/breaker.json';

export interface BreakerConfig {
  /** N однакових відмов підряд (той самий ключ) → open */
  readonly sameFailures: number;
  /** M задач підряд без прийнятого результату (будь-які відмови) → open */
  readonly noProgress: number;
  /** Перепочинок після першого open, хвилин */
  readonly cooldownMin: number;
  /** Стеля перепочинку: після кожної червоної пробної задачі він подвоюється, але не вище */
  readonly maxCooldownMin: number;
  /** Пробна задача, що не повернула результату довше за це (процес помер), перестає блокувати half-open */
  readonly probeTimeoutMin: number;
}

export const DEFAULT_BREAKER: BreakerConfig = { sameFailures: 3, noProgress: 4, cooldownMin: 30, maxCooldownMin: 240, probeTimeoutMin: 60 };

const State = z
  .object({
    state: z.enum(['closed', 'open', 'half-open']),
    /** однакові відмови підряд */
    streak: z.object({ key: z.string(), count: z.number().int().min(1) }).nullable(),
    /** будь-які відмови підряд (нема прогресу) */
    fails: z.number().int().min(0),
    opened_at: z.string().nullable(),
    trip: z.string().nullable(),
    /** поточний перепочинок, хвилин */
    cooldown_min: z.number().min(0),
    probe_started_at: z.string().nullable(),
    opens: z.number().int().min(0),
  })
  .strict();

export type Breaker = z.infer<typeof State>;

export const closedBreaker = (cfg: BreakerConfig = DEFAULT_BREAKER): Breaker => ({
  state: 'closed',
  streak: null,
  fails: 0,
  opened_at: null,
  trip: null,
  cooldown_min: cfg.cooldownMin,
  probe_started_at: null,
  opens: 0,
});

/** Відсутній файл — це «ще не було прогонів» (closed). Зіпсований — помилка: мовчки відкрити брейкер не можна. */
export function loadBreaker(path: string = BREAKER_FILE, cfg: BreakerConfig = DEFAULT_BREAKER): Breaker {
  if (!existsSync(path)) return closedBreaker(cfg);
  return State.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export function saveBreaker(b: Breaker, path: string = BREAKER_FILE): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(State.parse(b), null, 2)}\n`, 'utf8');
}

const minutes = (from: string, to: Date): number => (to.getTime() - Date.parse(from)) / 60000;

export interface Decision {
  readonly allow: boolean;
  /** true, якщо це пробна задача half-open */
  readonly probe: boolean;
  readonly why: string;
  readonly next: Breaker;
  readonly transition: 'half-open' | null;
}

/** Чи можна взяти наступну задачу з черги. */
export function decide(b: Breaker, now: Date, cfg: BreakerConfig = DEFAULT_BREAKER): Decision {
  if (b.state === 'closed') return { allow: true, probe: false, why: 'closed', next: b, transition: null };
  if (b.state === 'open') {
    const waited = minutes(b.opened_at ?? now.toISOString(), now);
    if (waited < b.cooldown_min) {
      const left = (b.cooldown_min - waited).toFixed(1);
      return { allow: false, probe: false, why: `open: ${b.trip}; перепочинок ще ${left} хв`, next: b, transition: null };
    }
    const next: Breaker = { ...b, state: 'half-open', probe_started_at: now.toISOString() };
    return { allow: true, probe: true, why: 'half-open: пробна задача', next, transition: 'half-open' };
  }
  // half-open: РІВНО одна пробна задача; поки вона в роботі, інших не пускаємо
  if (b.probe_started_at !== null && minutes(b.probe_started_at, now) < cfg.probeTimeoutMin) {
    return { allow: false, probe: false, why: 'half-open: пробна задача вже в роботі', next: b, transition: null };
  }
  const next: Breaker = { ...b, probe_started_at: now.toISOString() };
  return { allow: true, probe: true, why: 'half-open: попередня пробна задача не повернула результату, пробуємо знову', next, transition: 'half-open' };
}

export interface Outcome {
  /** Задача завершилась прийнятим результатом (exit_status ok і приймання пройшло). */
  readonly ok: boolean;
  /** Клас відмови: timeout | budget_or_turns | agent_failed | acceptance_failed | quota. Для ok не потрібен. */
  readonly key: string;
  /** Відмова провайдера за квотою (429): відкриває брейкер одразу, без накопичення. */
  readonly quota?: boolean;
}

export interface Recorded {
  readonly next: Breaker;
  readonly transition: 'open' | 'closed' | null;
  readonly trip: string | null;
}

const open = (b: Breaker, now: Date, trip: string, cooldown: number): Breaker => ({
  ...b,
  state: 'open',
  opened_at: now.toISOString(),
  trip,
  cooldown_min: cooldown,
  probe_started_at: null,
  opens: b.opens + 1,
});

/** Результат задачі → новий стан. Правило half-open жорсткіше за closed: одна червона задача повертає open негайно. */
export function record(b: Breaker, o: Outcome, now: Date, cfg: BreakerConfig = DEFAULT_BREAKER): Recorded {
  if (b.state === 'half-open') {
    if (o.ok) return { next: closedBreaker(cfg), transition: 'closed', trip: null };
    const longer = Math.min(Math.max(b.cooldown_min, 1) * 2, cfg.maxCooldownMin);
    const trip = `пробна задача червона: ${o.key}`;
    return { next: { ...open(b, now, trip, longer), streak: null, fails: 0 }, transition: 'open', trip };
  }
  if (b.state === 'open') return { next: b, transition: null, trip: null }; // у open задачі не запускаються
  if (o.ok) return { next: { ...b, streak: null, fails: 0 }, transition: null, trip: null };

  const streak = b.streak?.key === o.key ? { key: o.key, count: b.streak.count + 1 } : { key: o.key, count: 1 };
  const fails = b.fails + 1;
  let trip: string | null = null;
  if (o.quota === true) trip = 'quota (HTTP 429 / вичерпано ліміт провайдера)';
  else if (streak.count >= cfg.sameFailures) trip = `${o.key} ×${streak.count} підряд`;
  else if (fails >= cfg.noProgress) trip = `нема прогресу: ${fails} задач підряд без прийнятого результату`;

  if (trip !== null) return { next: { ...open(b, now, trip, cfg.cooldownMin), streak: null, fails: 0 }, transition: 'open', trip };
  return { next: { ...b, streak, fails }, transition: null, trip: null };
}
