/** Formats a non-negative duration as m:ss or h:mm:ss, dropping partial seconds. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError('Duration must be a finite, non-negative number of milliseconds');
  }

  const totalSeconds = Math.floor(ms / 1_000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours === 0) {
    return `${totalMinutes}:${paddedSeconds}`;
  }

  return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
}
