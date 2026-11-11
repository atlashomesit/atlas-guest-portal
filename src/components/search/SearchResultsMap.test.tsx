import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchResultsMap, { type SearchMapUnit } from './SearchResultsMap';
import { appendQuerySuffix } from '../../utils/navigation';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cluster-group">{children}</div>
  ),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
}));

describe('TASK-10298929 SearchResultsMap link formatting', () => {
  it('cleanly merges query parameters with & rather than producing double question marks', () => {
    const units: SearchMapUnit[] = [
      {
        numericId: 101,
        title: 'Atlas Villa 101',
        pricePerNight: 5000,
        canonicalPath: '/homes/atlas-villa-101/101?tenant=atlas',
        latitude: 17.385,
        longitude: 78.4867,
      },
    ];

    render(
      <MemoryRouter>
        <SearchResultsMap
          units={units}
          formatPrice={(p) => `₹${p}`}
          querySuffix="?checkIn=2026-11-01&checkOut=2026-11-05&guests=2"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /view/i });
    const href = link.getAttribute('href');
    expect(href).toBe(
      '/homes/atlas-villa-101/101?tenant=atlas&checkIn=2026-11-01&checkOut=2026-11-05&guests=2',
    );
    expect(href).not.toContain('??');
    expect(href).not.toContain('?tenant=atlas?');
  });

  it('correctly appends ? when canonicalPath has no existing query params', () => {
    const units: SearchMapUnit[] = [
      {
        numericId: 102,
        title: 'Quiet House',
        pricePerNight: 3500,
        canonicalPath: '/homes/quiet-house/102',
        latitude: 17.385,
        longitude: 78.4867,
      },
    ];

    render(
      <MemoryRouter>
        <SearchResultsMap
          units={units}
          formatPrice={(p) => `₹${p}`}
          querySuffix="?checkIn=2026-11-01&checkOut=2026-11-05"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /view/i });
    expect(link.getAttribute('href')).toBe('/homes/quiet-house/102?checkIn=2026-11-01&checkOut=2026-11-05');
  });

  it('appendQuerySuffix helper handles edge cases safely', () => {
    expect(appendQuerySuffix('/path', '')).toBe('/path');
    expect(appendQuerySuffix('/path', '?')).toBe('/path');
    expect(appendQuerySuffix('/path', '?a=1')).toBe('/path?a=1');
    expect(appendQuerySuffix('/path', 'a=1')).toBe('/path?a=1');
    expect(appendQuerySuffix('/path?x=1', '?a=1')).toBe('/path?x=1&a=1');
    expect(appendQuerySuffix('/path?x=1', 'a=1')).toBe('/path?x=1&a=1');
    expect(appendQuerySuffix('/path?x=1', '&a=1')).toBe('/path?x=1&a=1');
  });
});
