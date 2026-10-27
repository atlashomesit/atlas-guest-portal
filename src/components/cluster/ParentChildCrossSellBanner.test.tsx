import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ParentChildCrossSellBanner, { buildChildRoomHref, isParentListing } from './ParentChildCrossSellBanner';
import { parseClusterChildrenAvailability, type ClusterChildrenAvailability } from '@/api/clusterChildrenClient';
import { readClusterListingFields } from '@/utils/clusterListing';

const child = (id: number, name: string, rate: number | null) => ({
  listingId: id, name, nightlyRate: rate, currency: 'INR', coverPhotoUrl: null,
});

const someBooked: ClusterChildrenAvailability = {
  cause: 'ChildrenBooked',
  totalChildren: 6,
  unavailableChildren: 1,
  freeChildren: [child(102, 'Suite 102', 4500), child(103, 'Suite 103', 5200)],
};

describe('ParentChildCrossSellBanner (CLU-004 / CLU-011)', () => {
  it('identifies parent listings from API fields only - never from the name', () => {
    expect(isParentListing({ isParentCluster: true })).toBe(true);
    expect(isParentListing({ clusterRole: 'parent' })).toBe(true);
    expect(isParentListing({ accommodationType: 'ClusterParent' })).toBe(true);
    expect(isParentListing({ clusterRole: 'CHILD' })).toBe(false);
    // the old name regex is deleted: isParentListing no longer even accepts a name
    expect(isParentListing({} as never)).toBe(false);
  });

  it('copy state 1 - some Children booked: names the real cause, the free count and the price', () => {
    render(<ParentChildCrossSellBanner availability={someBooked} parentName="Villa" />);
    expect(screen.getByTestId('cluster-cross-sell-headline')).toHaveTextContent(
      'The whole villa is taken because 1 room is booked, but 2 are free.',
    );
    expect(screen.getByTestId('cluster-cross-sell-count')).toHaveTextContent('2 of 6 rooms are free on these dates at Villa.');
    expect(screen.getByTestId('child-room-card-102')).toHaveTextContent('Suite 102');
    expect(screen.getByTestId('child-room-card-102')).toHaveTextContent('₹4,500/night');
  });

  it('copy state 1 - pluralises: 3 booked, 1 free', () => {
    render(
      <ParentChildCrossSellBanner
        availability={{ ...someBooked, unavailableChildren: 3, freeChildren: [child(102, 'Suite 102', 4500)] }}
      />,
    );
    expect(screen.getByTestId('cluster-cross-sell-headline')).toHaveTextContent(
      'The whole villa is taken because 3 rooms are booked, but 1 is free.',
    );
  });

  it('copy state 2 - Parent itself booked/blocked: no claim about rooms', () => {
    const { container } = render(
      <ParentChildCrossSellBanner
        availability={{ cause: 'ParentUnavailable', totalChildren: 6, unavailableChildren: 0, freeChildren: [] }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('copy state 3 - no free Child (or nothing known yet): no banner', () => {
    const none = { ...someBooked, unavailableChildren: 6, freeChildren: [] };
    const { container: c1 } = render(<ParentChildCrossSellBanner availability={none} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<ParentChildCrossSellBanner availability={null} />);
    expect(c2.firstChild).toBeNull();
    const { container: c3 } = render(
      <ParentChildCrossSellBanner availability={{ ...someBooked, cause: 'None' }} />,
    );
    expect(c3.firstChild).toBeNull();
  });

  it('prefilled link: Child page with the searched dates; click goes through onSelectChildRoom', () => {
    const onSelect = vi.fn();
    render(
      <ParentChildCrossSellBanner
        availability={someBooked}
        propertySlug="villa"
        checkIn="2026-11-11"
        checkOut="2026-11-13"
        onSelectChildRoom={onSelect}
      />,
    );
    const link = screen.getByTestId('select-child-room-102');
    expect(link).toHaveAttribute('href', '/homes/villa/102?checkIn=2026-11-11&checkOut=2026-11-13');
    expect(link).toHaveTextContent('View Suite 102');
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 102, href: '/homes/villa/102?checkIn=2026-11-11&checkOut=2026-11-13' }));
    expect(buildChildRoomHref('villa', 5)).toBe('/homes/villa/5');
  });

  it('does not render when the listing is not a parent or the dates are available', () => {
    const { container: c1 } = render(<ParentChildCrossSellBanner isParentCluster={false} availability={someBooked} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<ParentChildCrossSellBanner isUnavailable={false} availability={someBooked} />);
    expect(c2.firstChild).toBeNull();
  });
});

describe('cluster payload readers (CLU-011)', () => {
  it('reads clusterRole/clusterId from camel or Pascal JSON, null otherwise', () => {
    expect(readClusterListingFields({ clusterRole: 'parent', clusterId: 9 })).toEqual({ clusterRole: 'PARENT', clusterId: 9 });
    expect(readClusterListingFields({ ClusterRole: 'CHILD', ClusterId: 9 })).toEqual({ clusterRole: 'CHILD', clusterId: 9 });
    expect(readClusterListingFields({ name: 'Whole Villa' })).toEqual({ clusterRole: null, clusterId: null });
    expect(readClusterListingFields(null)).toEqual({ clusterRole: null, clusterId: null });
  });

  it('parses the API response and rejects an unknown cause', () => {
    expect(parseClusterChildrenAvailability({ cause: 'ChildrenBooked', totalChildren: 2, unavailableChildren: 1, freeChildren: [{ listingId: 5, name: 'A', nightlyRate: 100, currency: 'INR' }] }))
      .toEqual({ cause: 'ChildrenBooked', totalChildren: 2, unavailableChildren: 1, freeChildren: [child(5, 'A', 100)] });
    expect(parseClusterChildrenAvailability({ cause: 'Weird' })).toBeNull();
  });
});
