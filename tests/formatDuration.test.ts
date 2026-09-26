import { describe, expect, it } from 'vitest';

import { formatDuration } from '../src/formatDuration';

describe('formatDuration', () => {
  it('formats zero and drops partial seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_999)).toBe('0:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60_000)).toBe('1:00');
    expect(formatDuration(125_999)).toBe('2:05');
  });

  it('includes hours without wrapping the total duration', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(36_125_000)).toBe('10:02:05');
  });

  it('rejects invalid durations', () => {
    for (const value of [-1, NaN, Infinity, -Infinity]) {
      expect(() => formatDuration(value)).toThrow(RangeError);
    }
  });
});
