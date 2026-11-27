import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataSaverBanner, isDataSaverPreferred } from './DataSaverBanner';

describe('PERF-048 DataSaverBanner', () => {
  it('detects Save-Data header and 2G effective connection types', () => {
    expect(isDataSaverPreferred({ connection: { saveData: true } })).toBe(true);
    expect(isDataSaverPreferred({ connection: { effectiveType: '2g' } })).toBe(true);
    expect(isDataSaverPreferred({ connection: { saveData: false, effectiveType: '4g' } })).toBe(false);
  });

  it('renders lightweight mode banner with full-site toggle', () => {
    const onToggle = vi.fn();
    render(<DataSaverBanner lightweightMode onToggleFullSite={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Load full site/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
