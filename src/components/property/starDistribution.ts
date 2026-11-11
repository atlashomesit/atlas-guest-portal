/** TASK-101380: per-star counts for a listing, or null when the review list cannot support an honest picture (see RatingDistribution.tsx). */
export interface StarCount {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
}

const MIN_REVIEWS = 3;
const STARS = [5, 4, 3, 2, 1] as const;

export function starDistribution(ratings: readonly number[], totalCount: number): StarCount[] | null {
  if (ratings.length < MIN_REVIEWS || ratings.length !== totalCount) return null;
  if (!ratings.every((r) => Number.isInteger(r) && r >= 1 && r <= 5)) return null;
  return STARS.map((star) => ({ star, count: ratings.filter((r) => r === star).length }));
}
