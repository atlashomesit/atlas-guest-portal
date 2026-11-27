import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  CompareListingsDrawer,
  MAX_COMPARE_LISTINGS,
  type CompareListingItem,
} from './CompareListingsDrawer';

const sampleItems: CompareListingItem[] = [
  {
    id: 1,
    title: 'Garden Suite',
    imageUrl: 'https://example.com/1.jpg',
    allInTotalLabel: '₹7,070 total',
    nightlyRateLabel: '₹3,535 / night',
    maxGuests: 3,
    bedLayoutLabel: '1 bedroom · 1 bath',
    amenities: ['WiFi', 'AC', 'Kitchen'],
    mealPlansLabel: 'Breakfast included (CP)',
    cancellationLabel: 'Flexible',
    href: '/homes/garden-suite/1',
  },
  {
    id: 2,
    title: 'Terrace Villa',
    imageUrl: 'https://example.com/2.jpg',
    allInTotalLabel: '₹10,500 total',
    nightlyRateLabel: '₹5,250 / night',
    maxGuests: 6,
    bedLayoutLabel: '2 bedrooms · 2 baths',
    amenities: ['WiFi', 'Pool', 'Parking'],
    mealPlansLabel: 'Room only (EP)',
    cancellationLabel: 'Moderate',
    href: '/homes/terrace-villa/2',
  },
];

describe('GUEST-096: CompareListingsDrawer', () => {
  it('hides tray when 0 items are selected', () => {
    render(
      <MemoryRouter>
        <CompareListingsDrawer
          items={[]}
          open={false}
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('compare-listings-tray')).toBeNull();
  });

  it('disables Compare CTA with 1 item and enables with 2-3 items', () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <CompareListingsDrawer
          items={[sampleItems[0]]}
          open={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </MemoryRouter>,
    );

    const openBtn = screen.getByTestId('compare-listings-open') as HTMLButtonElement;
    expect(openBtn.disabled).toBe(true);
    expect(MAX_COMPARE_LISTINGS).toBe(3);

    rerender(
      <MemoryRouter>
        <CompareListingsDrawer
          items={sampleItems}
          open={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect((screen.getByTestId('compare-listings-open') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('compare-listings-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders all comparison rows and supports removing an item or clearing all', () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();

    render(
      <MemoryRouter>
        <CompareListingsDrawer
          items={sampleItems}
          open={true}
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onRemove={onRemove}
          onClear={onClear}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('compare-listings-drawer')).toBeTruthy();
    expect(screen.getByTestId('compare-row-price').textContent).toContain('₹7,070 total');
    expect(screen.getByTestId('compare-row-guests').textContent).toContain('Up to 6 guests');
    expect(screen.getByTestId('compare-row-beds').textContent).toContain('2 bedrooms · 2 baths');
    expect(screen.getByTestId('compare-row-amenities').textContent).toContain('Pool');
    expect(screen.getByTestId('compare-row-meals').textContent).toContain('Breakfast included (CP)');
    expect(screen.getByTestId('compare-row-cancellation').textContent).toContain('Flexible');
    expect(screen.getByTestId('compare-book-1').getAttribute('href')).toBe('/homes/garden-suite/1');

    fireEvent.click(screen.getByTestId('compare-remove-1'));
    expect(onRemove).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByTestId('compare-listings-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
