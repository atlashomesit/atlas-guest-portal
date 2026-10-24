import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketplaceListingCard from './MarketplaceListingCard';
import { resolveMarketplaceListingDisplayName } from '../pages/MarketplaceHomepage';

describe('TASK-10299086 — MarketplaceListingCard & resolveMarketplaceListingDisplayName', () => {
  it('resolves displayName and publicTitle over internal SKU codes', () => {
    expect(
      resolveMarketplaceListingDisplayName({
        id: 101,
        title: 'Atlas101',
        displayName: 'Studio 101 Lake View',
      }),
    ).toBe('Studio 101 Lake View');

    expect(
      resolveMarketplaceListingDisplayName({
        id: 501,
        title: 'Atlas501_PH',
      }),
    ).toBe('Penthouse 501');

    expect(
      resolveMarketplaceListingDisplayName({
        id: 202,
        name: 'Atlas202_RAW',
        publicTitle: 'Sea View Suite 202',
      }),
    ).toBe('Sea View Suite 202');
  });

  it('renders guest-friendly name on the card', () => {
    render(
      <MarketplaceListingCard
        id={101}
        title="Atlas101"
        pricePerNight={4500}
        city="Goa"
        maxGuests={2}
        rating={4.8}
        reviewCount={10}
      />,
    );

    expect(screen.getByText('Studio 101')).toBeInTheDocument();
    expect(screen.getByText('Goa')).toBeInTheDocument();
    expect(screen.getByText('₹4,500/night')).toBeInTheDocument();
  });
});
