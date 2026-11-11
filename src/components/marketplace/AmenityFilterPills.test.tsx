import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AmenityFilterPills from './AmenityFilterPills';
import {
  matchesAmenityFilter,
  type ListingWithAmenities,
} from '@/utils/amenityFilters';

describe('TASK-10298932 AmenityFilterPills component', () => {
  it('renders all default amenity pills and handles selection', () => {
    const onSelect = vi.fn();
    render(<AmenityFilterPills selectedAmenity={null} onSelectAmenity={onSelect} />);

    expect(screen.getByTestId('marketplace-amenities-pills')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-amenity-pool')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-amenity-pet-friendly')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-amenity-beachfront')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-amenity-mountain-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('marketplace-amenity-pool'));
    expect(onSelect).toHaveBeenCalledWith('Pool');
  });

  it('deselects amenity when clicking the currently active pill', () => {
    const onSelect = vi.fn();
    render(<AmenityFilterPills selectedAmenity="Pool" onSelectAmenity={onSelect} />);

    fireEvent.click(screen.getByTestId('marketplace-amenity-pool'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders Clear button when an amenity is active and clears on click', () => {
    const onSelect = vi.fn();
    render(<AmenityFilterPills selectedAmenity="Beachfront" onSelectAmenity={onSelect} />);

    const clearBtn = screen.getByRole('button', { name: /clear/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('TASK-10298932 matchesAmenityFilter', () => {
  it('always matches when no amenity is selected', () => {
    const item: ListingWithAmenities = { title: 'Random Stay' };
    expect(matchesAmenityFilter(item, null)).toBe(true);
    expect(matchesAmenityFilter(item, '')).toBe(true);
  });

  it('matches via explicit amenityCodes even when title lacks the keyword', () => {
    const poolListing: ListingWithAmenities = {
      title: 'Serene Villa 101',
      slug: 'serene-villa-101',
      city: 'Goa',
      amenityCodes: ['swimming_pool', 'wifi'],
    };
    expect(matchesAmenityFilter(poolListing, 'Pool')).toBe(true);

    const petListing: ListingWithAmenities = {
      title: 'Green Meadows Cottage',
      amenityCodes: ['pets_allowed', 'ac'],
    };
    expect(matchesAmenityFilter(petListing, 'Pet Friendly')).toBe(true);

    const beachListing: ListingWithAmenities = {
      title: 'Coastal Haven',
      amenityCodes: ['beach_access'],
    };
    expect(matchesAmenityFilter(beachListing, 'Beachfront')).toBe(true);

    const mountainListing: ListingWithAmenities = {
      title: 'Cloud Top Chalet',
      amenityCodes: ['mountain_view'],
    };
    expect(matchesAmenityFilter(mountainListing, 'Mountain View')).toBe(true);
  });

  it('matches via explicit amenities object array', () => {
    const listing: ListingWithAmenities = {
      title: 'Cozy Homestay',
      amenities: [{ code: 'private_pool' }, { name: 'High Speed WiFi' }],
    };
    expect(matchesAmenityFilter(listing, 'Pool')).toBe(true);
    expect(matchesAmenityFilter(listing, 'Pet Friendly')).toBe(false);
  });

  it('falls back cleanly to title/city/slug/description when amenityCodes are omitted', () => {
    const listing: ListingWithAmenities = {
      title: 'Luxury Villa with Private Pool and Garden',
      city: 'Lonavala',
    };
    expect(matchesAmenityFilter(listing, 'Pool')).toBe(true);
    expect(matchesAmenityFilter(listing, 'Beachfront')).toBe(false);
  });

  it('safely handles missing or null fields without throwing runtime errors', () => {
    const emptyItem: ListingWithAmenities = {
      title: null,
      slug: null,
      city: null,
      description: null,
      amenityCodes: null,
      amenities: null,
    };
    expect(() => matchesAmenityFilter(emptyItem, 'Pool')).not.toThrow();
    expect(matchesAmenityFilter(emptyItem, 'Pool')).toBe(false);

    const corruptCodesItem: ListingWithAmenities = {
      title: 'Test',
      amenityCodes: [null, undefined, ''] as unknown as string[],
      amenities: [null, { code: null }] as unknown as { code: string }[],
    };
    expect(() => matchesAmenityFilter(corruptCodesItem, 'Pool')).not.toThrow();
    expect(matchesAmenityFilter(corruptCodesItem, 'Pool')).toBe(false);
  });
});
