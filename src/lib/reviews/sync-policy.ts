import type { NormalizedReview } from "@/lib/reviews/types";

/** Primera importación: hasta 100 reseñas del último año. */
export const INITIAL_SYNC_MAX_REVIEWS = 100;
export const INITIAL_SYNC_MAX_AGE_DAYS = 365;

/** Sincronizaciones posteriores (cron / botón): solo novedades recientes. */
export const INCREMENTAL_SYNC_MAX_REVIEWS = 30;

export function getInitialSyncCutoffDate(): Date {
  return new Date(
    Date.now() - INITIAL_SYNC_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );
}

export function applyInitialSyncWindow(
  reviews: NormalizedReview[]
): NormalizedReview[] {
  const cutoff = getInitialSyncCutoffDate();
  return reviews
    .filter((r) => r.date >= cutoff)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, INITIAL_SYNC_MAX_REVIEWS);
}

export function applyIncrementalSyncLimit(
  reviews: NormalizedReview[],
  limit = INCREMENTAL_SYNC_MAX_REVIEWS
): NormalizedReview[] {
  return reviews
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);
}
