import { describe, expect, it } from 'vitest';

import { buildHealthReport } from './health';

const NOW = new Date('2026-09-12T10:30:00.000Z');

describe('buildHealthReport', () => {
  it('повертає статус ok, час у ISO та передану версію', () => {
    const report = buildHealthReport(NOW, 42, '0.1.0');

    expect(report).toEqual({
      status: 'ok',
      timestamp: '2026-09-12T10:30:00.000Z',
      uptimeSeconds: 42,
      version: '0.1.0',
    });
  });

  it('заокруглює дробовий аптайм до цілих секунд', () => {
    expect(buildHealthReport(NOW, 12.6, 'unknown').uptimeSeconds).toBe(13);
  });

  it('не дає від\'ємного аптайму', () => {
    expect(buildHealthReport(NOW, -1, 'unknown').uptimeSeconds).toBe(0);
  });
});
