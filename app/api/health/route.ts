import { HealthResponse } from '../../../src/health';

// Відповідь містить поточний час на момент запиту — маршрут не можна
// пререндерити статично під час збірки, інакше timestamp застигне.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const body: HealthResponse = { status: 'ok', timestamp: new Date().toISOString() };
  return Response.json(body);
}
