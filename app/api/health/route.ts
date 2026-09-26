import type { HealthResponse } from '../../../src/health';

export function GET(): Response {
  const body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  } satisfies HealthResponse;

  return Response.json(body);
}
