import { describe, expect, it } from 'vitest';

import { GET, dynamic } from '../app/api/health/route';

describe('GET /api/health', () => {
  it('віддає 200 і JSON зі статусом ok', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body: unknown = await response.json();
    expect(body).toMatchObject({ status: 'ok' });
  });

  it('забороняє кешування відповіді', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(GET().headers.get('cache-control')).toBe('no-store');
  });
});
