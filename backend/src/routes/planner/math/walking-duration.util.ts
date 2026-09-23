/** Средняя скорость пешего хода, км/ч (3–4 км/ч) */
export const WALKING_SPEED_KMH = 3.5;

export function estimateWalkingDurationMin(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / WALKING_SPEED_KMH) * 60));
}

export function formatWalkingDuration(distanceKm: number): {
  durationMin: number;
  speedKmh: number;
} {
  return {
    durationMin: estimateWalkingDurationMin(distanceKm),
    speedKmh: WALKING_SPEED_KMH,
  };
}
