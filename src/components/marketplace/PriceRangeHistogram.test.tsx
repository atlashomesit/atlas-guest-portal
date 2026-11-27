import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PriceRangeHistogram, {
  buildFallbackPriceHistogram,
  type PriceHistogramDto,
} from './PriceRangeHistogram';

const sampleHistogram: PriceHistogramDto = {
  min: 1000,
  max: 5000,
  bucketSize: 1000,
  buckets: [
    { from: 1000, to: 2000, count: 3 },
    { from: 2000, to: 3000, count: 5 },
    { from: 3000, to: 4000, count: 2 },
    { from: 4000, to: 5000, count: 1 },
  ],
};

describe('PriceRangeHistogram (MKT-071)', () => {
  it('renders bars, highlights in-range bars, and updates live stay count', () => {
    const onMin = vi.fn();
    const onMax = vi.fn();
    const onClear = vi.fn();

    render(
      <PriceRangeHistogram
        histogram={sampleHistogram}
        minPriceInput="2000"
        maxPriceInput="4000"
        onMinPriceChange={onMin}
        onMaxPriceChange={onMax}
        onClear={onClear}
      />,
    );

    const bars = screen.getAllByTestId('price-histogram-bar');
    expect(bars).toHaveLength(4);
    expect(screen.getByTestId('price-histogram-count')).toHaveTextContent('11 stays in this range');

    fireEvent.change(screen.getByTestId('price-histogram-min-slider'), { target: { value: '2500' } });
    expect(onMin).toHaveBeenCalledWith('2500');

    fireEvent.change(screen.getByTestId('price-histogram-max-slider'), { target: { value: '3500' } });
    expect(onMax).toHaveBeenCalledWith('3500');
  });

  it('builds a fallback histogram from positive listing prices', () => {
    const hist = buildFallbackPriceHistogram([1500, 2200, 4800], 8);
    expect(hist).not.toBeNull();
    expect(hist?.buckets).toHaveLength(8);
    const total = hist?.buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(3);
  });
});
