import { buildHealthReport } from '@/src/health';
import pkg from '../../../package.json';

// Здоров'я застосунку — це стан на момент запиту, тому відповідь не можна
// ані пререндерити під час збірки, ані віддавати з кешу.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const report = buildHealthReport(
    new Date(),
    process.uptime(),
    pkg.version,
  );

  return Response.json(report, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
