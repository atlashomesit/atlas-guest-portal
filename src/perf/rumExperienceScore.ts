/**
 * PERF-067: Real-user composite experience score segmented by device class and network speed.
 */

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type NetworkSpeedBucket = '3g' | '4g' | 'wifi';

export interface RumVitalsSample {
  lcpMs: number;
  inpMs: number;
  cls: number;
  deviceClass: DeviceClass;
  networkSpeed: NetworkSpeedBucket;
}

export function computeCompositeExperienceScore(sample: Pick<RumVitalsSample, 'lcpMs' | 'inpMs' | 'cls'>): number {
  const lcpScore = sample.lcpMs <= 2500 ? 100 : sample.lcpMs >= 4000 ? 40 : 100 - ((sample.lcpMs - 2500) / 1500) * 60;
  const inpScore = sample.inpMs <= 200 ? 100 : sample.inpMs >= 500 ? 40 : 100 - ((sample.inpMs - 200) / 300) * 60;
  const clsScore = sample.cls <= 0.1 ? 100 : sample.cls >= 0.25 ? 40 : 100 - ((sample.cls - 0.1) / 0.15) * 60;
  return Math.round(lcpScore * 0.45 + inpScore * 0.35 + clsScore * 0.2);
}

export function segmentExperienceScores(
  samples: RumVitalsSample[]
): Record<string, { count: number; avgScore: number }> {
  const buckets: Record<string, { sum: number; count: number }> = {};
  for (const s of samples) {
    const key = `${s.deviceClass}:${s.networkSpeed}`;
    const score = computeCompositeExperienceScore(s);
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += score;
    buckets[key].count += 1;
  }
  const result: Record<string, { count: number; avgScore: number }> = {};
  for (const [k, v] of Object.entries(buckets)) {
    result[k] = { count: v.count, avgScore: Math.round(v.sum / v.count) };
  }
  return result;
}
