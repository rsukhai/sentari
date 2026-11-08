/**
 * Згода між ручною розміткою й суддею (Лаб. 3, крок 02): сира частка збігів і каппа Коена — два окремі числа.
 */
export type Label = 'pass' | 'fail' | 'unknown';
export const LABELS: readonly Label[] = ['pass', 'fail', 'unknown'];

/** mine[i] — мій ручний вердикт, judge[i] — вердикт верифікатора. */
export function agreement(mine: readonly Label[], judge: readonly Label[]) {
  const n = mine.length;
  if (n === 0 || n !== judge.length) throw new Error('різна довжина розмітки');
  // сира згода: просто частка збігів
  const po = mine.filter((m, i) => m === judge[i]).length / n;
  // очікувана випадкова згода: сума добутків маргінальних часток
  const pe = LABELS.reduce((acc, l) => {
    const pm = mine.filter((x) => x === l).length / n;
    const pj = judge.filter((x) => x === l).length / n;
    return acc + pm * pj;
  }, 0);
  // каппа Коена; pe === 1 означає, що всі мітки однакові — каппа не визначена
  const kappa = pe === 1 ? Number.NaN : (po - pe) / (1 - pe);
  return { n, raw: po, expected: pe, kappa };
}

/** Матриця невідповідностей: рядок — моя мітка, стовпчик — мітка судді. */
export function confusion(mine: readonly Label[], judge: readonly Label[]): Record<Label, Record<Label, number>> {
  const m = Object.fromEntries(LABELS.map((a) => [a, Object.fromEntries(LABELS.map((b) => [b, 0]))])) as Record<Label, Record<Label, number>>;
  mine.forEach((a, i) => {
    const b = judge[i];
    if (b === undefined) throw new Error('різна довжина розмітки');
    m[a][b] += 1;
  });
  return m;
}
