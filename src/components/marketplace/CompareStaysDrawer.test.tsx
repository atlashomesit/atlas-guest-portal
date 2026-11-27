import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  CompareStaysDrawer,
  MAX_COMPARE_STAYS,
  type CompareStayItem,
} from './CompareStaysDrawer';

const stays: CompareStayItem[] = [
  {
    id: 101,
    title: 'Hilltop Villa',
    location: 'Coorg',
    imageUrl: 'https://example.com/101.jpg',
    allInTotalLabel: '₹8,400 total',
    nightlyRateLabel: '₹4,200 / night',
    rating: 4.8,
    reviewCount: 22,
    maxGuests: 6,
    amenities: ['WiFi', 'Pool'],
    breakfastIncluded: true,
    cancellationLabel: 'Free cancellation',
    href: '/homes/hilltop-villa/101?tenant=t1&brand=atlastays',
  },
  {
    id: 102,
    title: 'Lakeview Cottage',
    location: 'Ooty',
    imageUrl: 'https://example.com/102.jpg',
    allInTotalLabel: '₹6,200 total',
    nightlyRateLabel: '₹3,100 / night',
    rating: 4.6,
    reviewCount: 14,
    maxGuests: 4,
    amenities: ['WiFi', 'Parking'],
    breakfastIncluded: false,
    cancellationLabel: 'Moderate',
    href: '/homes/lakeview-cottage/102?tenant=t2&brand=atlastays',
  },
];

describe('MKT-062: CompareStaysDrawer', () => {
  it('supports up to 4 stays and enables Compare now at >= 2 stays', () => {
    expect(MAX_COMPARE_STAYS).toBe(4);
    const onOpen = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <CompareStaysDrawer
          items={[stays[0]]}
          open={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compare-stays-tray').textContent).toContain('Compare stays (1/4)');
    expect((screen.getByTestId('compare-stays-open') as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <MemoryRouter>
        <CompareStaysDrawer
          items={stays}
          open={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect((screen.getByTestId('compare-stays-open') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('compare-stays-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders comparison table rows and supports removing / clearing', () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    render(
      <MemoryRouter>
        <CompareStaysDrawer
          items={stays}
          open={true}
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onRemove={onRemove}
          onClear={onClear}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compare-stays-row-price').textContent).toContain('₹8,400 total');
    expect(screen.getByTestId('compare-stays-row-rating').textContent).toContain('4.8');
    expect(screen.getByTestId('compare-stays-row-meals').textContent).toContain('Breakfast included');
    expect(screen.getByTestId('compare-stays-row-cancellation').textContent).toContain('Free cancellation');

    fireEvent.click(screen.getByTestId('compare-stay-remove-101'));
    expect(onRemove).toHaveBeenCalledWith(101);

    fireEvent.click(screen.getByTestId('compare-stays-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
