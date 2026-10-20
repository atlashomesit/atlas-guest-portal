import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ParentChildCrossSellBanner, { isParentListing } from './ParentChildCrossSellBanner';

describe('ParentChildCrossSellBanner (CLU-004)', () => {
  it('identifies parent cluster listings correctly', () => {
    expect(isParentListing({ isParentCluster: true })).toBe(true);
    expect(isParentListing({ clusterRole: 'PARENT' })).toBe(true);
    expect(isParentListing({ accommodationType: 'ClusterParent' })).toBe(true);
    expect(isParentListing({ name: 'Whole Villa Estate (6 Bedrooms)' })).toBe(true);
    expect(isParentListing({ name: 'Deluxe Private Suite' })).toBe(false);
  });

  it('renders cross-sell alert banner when parent villa is unavailable', () => {
    const onBrowse = vi.fn();
    render(
      <ParentChildCrossSellBanner
        isParentCluster={true}
        isUnavailable={true}
        parentName="Villa Magnolia"
        onBrowseRooms={onBrowse}
      />
    );

    const banner = screen.getByTestId('cluster-parent-child-cross-sell');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      'Entire villa is unavailable on these dates because 1 room is booked — but individual private rooms are still available!'
    );
    expect(banner).toHaveTextContent('Villa Magnolia is sold both as a whole villa and as separate private suites');

    const browseBtn = screen.getByTestId('view-child-rooms-btn');
    fireEvent.click(browseBtn);
    expect(onBrowse).toHaveBeenCalled();
  });

  it('renders available individual child rooms preview', () => {
    const onSelect = vi.fn();
    const rooms = [
      { id: 'room-101', name: 'Master Pool Suite', price: 6500, available: true },
      { id: 'room-102', name: 'Garden Deluxe Suite', price: 4500, available: true },
    ];

    render(
      <ParentChildCrossSellBanner
        isParentCluster={true}
        isUnavailable={true}
        childRooms={rooms}
        onSelectChildRoom={onSelect}
      />
    );

    expect(screen.getByTestId('child-room-card-room-101')).toHaveTextContent('Master Pool Suite');
    expect(screen.getByTestId('child-room-card-room-102')).toHaveTextContent('Garden Deluxe Suite');

    const selectBtn = screen.getByTestId('select-child-room-room-101');
    fireEvent.click(selectBtn);
    expect(onSelect).toHaveBeenCalledWith(rooms[0]);
  });

  it('does not render when listing is not parent or is available', () => {
    const { container: c1 } = render(
      <ParentChildCrossSellBanner isParentCluster={false} isUnavailable={true} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <ParentChildCrossSellBanner isParentCluster={true} isUnavailable={false} />
    );
    expect(c2.firstChild).toBeNull();
  });
});
