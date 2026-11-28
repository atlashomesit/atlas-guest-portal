import { useMemo } from 'react';

export type PriceHistogramBucket = {
  from: number;
  to: number;
  count: number;
};

export type PriceHistogramDto = {
  min: number;
  max: number;
  bucketSize: number;
  buckets: PriceHistogramBucket[];
};

export function buildFallbackPriceHistogram(
  prices: number[],
  bucketCount = 12,
): PriceHistogramDto | null {
  const valid = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (valid.length === 0) return null;
  const min = Math.floor(Math.min(...valid));
  const rawMax = Math.ceil(Math.max(...valid));
  const max = rawMax > min ? rawMax : min + 1000;
  const count = Math.max(4, Math.min(20, bucketCount));
  const bucketSize = Math.max(1, Math.ceil((max - min) / count));
  const buckets: PriceHistogramBucket[] = Array.from({ length: count }, (_, idx) => {
    const from = min + idx * bucketSize;
    const to = idx === count - 1 ? Math.max(max, from + bucketSize) : from + bucketSize;
    return { from, to, count: 0 };
  });
  for (const p of valid) {
    const idx = Math.min(count - 1, Math.max(0, Math.floor((p - min) / bucketSize)));
    buckets[idx].count += 1;
  }
  return { min, max: buckets[count - 1].to, bucketSize, buckets };
}

export type PriceRangeHistogramProps = {
  histogram: PriceHistogramDto | null;
  minPriceInput: string;
  maxPriceInput: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onClear: () => void;
};

export default function PriceRangeHistogram({
  histogram,
  minPriceInput,
  maxPriceInput,
  onMinPriceChange,
  onMaxPriceChange,
  onClear,
}: PriceRangeHistogramProps) {
  const parsedMin = minPriceInput.trim() !== '' && Number.isFinite(Number(minPriceInput))
    ? Number(minPriceInput)
    : null;
  const parsedMax = maxPriceInput.trim() !== '' && Number.isFinite(Number(maxPriceInput))
    ? Number(maxPriceInput)
    : null;

  const domainMin = histogram?.min ?? 0;
  const domainMax = histogram && histogram.max > histogram.min ? histogram.max : domainMin + 10000;

  const sliderMin = parsedMin != null ? Math.max(domainMin, Math.min(domainMax, parsedMin)) : domainMin;
  const sliderMax = parsedMax != null ? Math.max(sliderMin, Math.min(domainMax, parsedMax)) : domainMax;

  const maxBucketCount = useMemo(() => {
    if (!histogram || histogram.buckets.length === 0) return 1;
    return Math.max(1, ...histogram.buckets.map((b) => b.count));
  }, [histogram]);

  const matchingCount = useMemo(() => {
    if (!histogram || histogram.buckets.length === 0) return null;
    const lo = parsedMin ?? domainMin;
    const hi = parsedMax ?? domainMax;
    return histogram.buckets.reduce((sum, b) => {
      const overlaps = b.to >= lo && b.from <= hi;
      return overlaps ? sum + b.count : sum;
    }, 0);
  }, [histogram, parsedMin, parsedMax, domainMin, domainMax]);

  return (
    <div className="flex flex-col gap-2" data-testid="price-range-histogram">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="marketplace-min-price" className="text-sm font-medium text-text-muted">
          Price / night
        </label>
        {matchingCount != null && (
          <span
            data-testid="price-histogram-count"
            className="text-xs font-medium text-text-secondary"
            aria-live="polite"
          >
            {matchingCount} {matchingCount === 1 ? 'stay' : 'stays'} in this range
          </span>
        )}
      </div>

      {histogram && histogram.buckets.length > 0 && (
        <div className="w-full max-w-md">
          <div
            role="img"
            aria-label={`Price distribution from ₹${domainMin} to ₹${domainMax}`}
            data-testid="price-histogram-chart"
            className="flex h-12 items-end gap-0.5 px-1"
          >
            {histogram.buckets.map((bucket, idx) => {
              const inRange = bucket.to >= (parsedMin ?? domainMin) && bucket.from <= (parsedMax ?? domainMax);
              const heightPct = bucket.count === 0 ? 8 : Math.max(16, Math.round((bucket.count / maxBucketCount) * 100));
              return (
                <div
                  key={`${bucket.from}-${idx}`}
                  data-testid="price-histogram-bar"
                  data-in-range={inRange ? 'true' : 'false'}
                  title={`₹${bucket.from}–₹${bucket.to}: ${bucket.count}`}
                  style={{ height: `${heightPct}%` }}
                  className={`flex-1 rounded-t-sm transition-colors ${
                    inRange ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="range"
              aria-label="Minimum nightly price slider"
              data-testid="price-histogram-min-slider"
              min={domainMin}
              max={domainMax}
              step={Math.max(1, Math.round((domainMax - domainMin) / 40))}
              value={sliderMin}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = Number.parseInt(raw, 10);
                if (!Number.isNaN(parsed)) {
                  onMinPriceChange(String(parsed > sliderMax ? sliderMax : parsed));
                }
              }}
              className="min-h-[44px] w-full accent-black cursor-pointer"
            />
            <input
              type="range"
              aria-label="Maximum nightly price slider"
              data-testid="price-histogram-max-slider"
              min={domainMin}
              max={domainMax}
              step={Math.max(1, Math.round((domainMax - domainMin) / 40))}
              value={sliderMax}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = Number.parseInt(raw, 10);
                if (!Number.isNaN(parsed)) {
                  onMaxPriceChange(String(parsed < sliderMin ? sliderMin : parsed));
                }
              }}
              className="min-h-[44px] w-full accent-black cursor-pointer"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="marketplace-min-price"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Min"
          value={minPriceInput}
          onChange={(e) => onMinPriceChange(e.target.value)}
          className="min-h-[44px] w-24 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
        <span aria-hidden className="text-text-muted">–</span>
        <input
          id="marketplace-max-price"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Max"
          aria-label="Max price"
          value={maxPriceInput}
          onChange={(e) => onMaxPriceChange(e.target.value)}
          className="min-h-[44px] w-24 rounded-lg border border-border px-3 py-1.5 text-sm"
        />
        {(minPriceInput !== '' || maxPriceInput !== '') && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-muted"
          >
            Clear price
          </button>
        )}
      </div>
    </div>
  );
}
