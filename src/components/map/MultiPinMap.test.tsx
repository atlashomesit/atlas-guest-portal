import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { settle } from '@/test/settle';
import MultiPinMap, { type MapPin } from './MultiPinMap';

vi.mock('../../config/googleMaps', () => ({
  GOOGLE_MAPS_API_KEY: 'test-key',
}));

describe('MKT-070: MultiPinMap price pills and tap-to-preview card', () => {
  const clickHandlers: Array<() => void> = [];

  beforeEach(() => {
    clickHandlers.length = 0;
    (window as any).google = {
      maps: {
        Map: vi.fn().mockImplementation(function () {
          return {
            addListener: vi.fn(),
            fitBounds: vi.fn(),
            setCenter: vi.fn(),
            setZoom: vi.fn(),
            getBounds: vi.fn(),
          };
        }),
        LatLngBounds: vi.fn().mockImplementation(function () {
          return { extend: vi.fn() };
        }),
        InfoWindow: vi.fn().mockImplementation(function () {
          return { setContent: vi.fn(), open: vi.fn() };
        }),
        Marker: vi.fn().mockImplementation(function () {
          return {
            setMap: vi.fn(),
            addListener: vi.fn((event: string, cb: () => void) => {
              if (event === 'click') clickHandlers.push(cb);
            }),
          };
        }),
      },
    };
  });

  it('opens compact preview card with photo, >=4★ rating, live price, and View home link on pin tap and dismisses on close', async () => {
    const pins: MapPin[] = [
      {
        id: 'mp-1',
        lat: 17.44,
        lng: 78.38,
        title: 'Banjara Hills Villa',
        priceLabel: '₹3,528',
        coverImageUrl: 'https://example.com/villa.jpg',
        rating: 4.8,
        reviewCount: 19,
        propertyType: 'Villa',
        href: '/homes/banjara-hills-villa/101?tenant=t1&brand=atlastays',
      },
      {
        id: 'mp-2',
        lat: 17.45,
        lng: 78.39,
        title: 'Low Rated Stay',
        priceLabel: '₹2,100',
        coverImageUrl: 'https://example.com/stay.jpg',
        rating: 3.4,
        reviewCount: 5,
        propertyType: 'Homestay',
        href: '/homes/low-rated/102?tenant=t2&brand=atlastays',
      },
    ];

    render(<MultiPinMap pins={pins} />);

    // Wait for map boot effect
    await vi.waitFor(() => {
      expect(clickHandlers.length).toBeGreaterThanOrEqual(2);
    });

    // Tap first pin
    clickHandlers[0]();
    await settle();

    const card = screen.getByTestId('map-pin-preview-card');
    expect(card.textContent).toContain('Banjara Hills Villa');
    expect(screen.getByTestId('map-pin-preview-price').textContent).toBe('₹3,528');
    expect(screen.getByTestId('map-pin-preview-rating').textContent).toContain('4.8');
    expect(screen.getByTestId('map-pin-preview-link').getAttribute('href')).toBe(
      '/homes/banjara-hills-villa/101?tenant=t1&brand=atlastays',
    );

    // Dismiss
    fireEvent.click(screen.getByTestId('map-pin-preview-close'));
    expect(screen.queryByTestId('map-pin-preview-card')).toBeNull();

    // Tap second pin — sub-4★ rating must be suppressed
    clickHandlers[1]();
    await settle();
    expect(screen.getByTestId('map-pin-preview-card')).toBeTruthy();
    expect(screen.queryByTestId('map-pin-preview-rating')).toBeNull();
  });
});
