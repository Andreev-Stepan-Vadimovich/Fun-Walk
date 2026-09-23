/**
 * Форматирует длительность прогулки: «1 ч 55 мин пешком»
 */
export function formatWalkingDuration(minutes: number): string {
  if (minutes <= 0) return '—';

  if (minutes < 60) {
    return `~${minutes} мин пешком`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `~${hours} ч пешком`;
  }

  return `~${hours} ч ${mins} мин пешком`;
}
