import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParentChildCrossSellBanner from './ParentChildCrossSellBanner';

describe('ParentChildCrossSellBanner (TASK-1040325)', () => {
  it('stacks child room cards in a single column with concise View room CTA and aria-label', () => {
    render(
      <ParentChildCrossSellBanner
        isParentCluster
        isUnavailable
        parentName="QA Fixture Lock-off Villa"
        availability={{
          cause: 'ChildrenBooked',
          totalChildren: 3,
          unavailableChildren: 1,
          freeChildren: [
            {
              listingId: 101,
              name: 'QA Fixture Lock-off Villa - Bedroom 2',
              nightlyRate: 4500,
              maxGuests: 2,
            },
            {
              listingId: 102,
              name: 'QA Fixture Lock-off Villa - Bedroom 3',
              nightlyRate: 4500,
              maxGuests: 2,
            },
          ],
        } as any}
      />,
    );

    const card = screen.getByTestId('child-room-card-101');
    expect(card.className).toContain('overflow-hidden');
    expect(card.parentElement?.className).toContain('grid-cols-1');
    expect(card.parentElement?.className).not.toContain('sm:grid-cols-2');

    const cta = screen.getByTestId('select-child-room-101');
    expect(cta.textContent).toBe('View room');
    expect(cta.getAttribute('aria-label')).toBe('View QA Fixture Lock-off Villa - Bedroom 2');
  });
});
