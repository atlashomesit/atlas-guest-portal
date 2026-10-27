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

  it('TASK-1039954: renders property type badge and aligned amenity chips', () => {
    render(
      <MarketplaceListingCard
        id={201}
        title="Sunset Villa"
        propertyType="Villa"
        amenityCodes={['wifi', 'air_conditioning', 'swimming_pool']}
        pricePerNight={12000}
        city="Udaipur"
      />,
    );

    const badge = screen.getByTestId('property-type-badge');
    expect(badge).toHaveTextContent('Villa');

    const amenityChips = screen.getAllByTestId('marketplace-amenity-chip');
    expect(amenityChips.length).toBeGreaterThan(0);
    expect(amenityChips[0]).toHaveTextContent(/Wifi|Air Conditioning|Swimming Pool/);

    const tagsContainer = screen.getByTestId('marketplace-card-tags');
    expect(tagsContainer).toBeInTheDocument();
  });

  it('TASK-10299109 & TASK-1039779: shows per-bed starting price indicator for hostel dorms', () => {
    render(
      <MarketplaceListingCard
        id={301}
        title="Zostel Backpacker Dorm"
        propertyType="Hostel"
        accommodationType="HostelDorm"
        pricePerNight={699}
        city="Jaipur"
      />,
    );

    expect(screen.getByTestId('property-type-badge')).toHaveTextContent('Hostel');
    expect(screen.getByTestId('hostel-per-bed-indicator')).toHaveTextContent(/per bed/i);
    expect(screen.getByTestId('marketplace-card-price')).toHaveTextContent(/bed/i);
  });
});
