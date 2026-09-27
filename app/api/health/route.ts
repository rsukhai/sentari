import type { HealthResponse } from '../../../src/health';

export function GET(): Response {
  const body = {
    status: 'ok',

  } satisfies HealthResponse;

  return Response.json(body);
}
