import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CheckinAliasRedirect,
  CheckinBookingRefAliasRedirect,
  GuestPortalAliasRedirect,
} from '@/App';
import { GuestAuthContext } from '@/contexts/GuestAuthContext';
import { UpiPaymentPanel } from '@/components/checkout/UpiPaymentPanel';
import { resolveGallerySegment } from '@/pages/GalleryPage';
import { mapGuestPriceBreakdown } from '@/api/pricingClient';
import { directPriceDisplay } from '@/utils/directBookingPrice';
import DirectSavingRow from '@/components/pricing/DirectSavingRow';
import MarketplaceListingCard from '@/components/MarketplaceListingCard';

function LocationDisplay({ testId }: { testId: string }) {
  const loc = useLocation();
  return <div data-testid={testId}>{`${loc.pathname}${loc.search}`}</div>;
}

describe('Wave 2 Guest Portal Routing, UPI SVG QR Fallback, Touch Targets, Gallery & Deals', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('GUEST-044: Client-side dynamic SVG QR fallback on UpiPaymentPanel', () => {
    const baseOrder = {
      paymentProvider: 'UPI_QR' as const,
      upiVpa: 'host@okaxis',
      upiUri: 'upi://pay?pa=host%40okaxis&pn=Comfort%20Cove&am=4500&cu=INR',
      qrCodeUrl: '',
    };

    it('renders client-side <QRCodeSVG> encoding order.upiUri when order.qrCodeUrl is blank', () => {
      render(
        <UpiPaymentPanel
          order={baseOrder}
          amountInr={4500}
          payeeName="Comfort Cove"
          countdown="09:42"
          holdActive
          isMobile={false}
          onIHavePaid={vi.fn()}
          busy={false}
          error={null}
        />,
      );

      const qrContainer = screen.getByTestId('upi-pay-qr');
      expect(qrContainer).toBeInTheDocument();
      const svg = screen.getByTestId('upi-pay-qr-svg');
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('width')).toBe('192');
      expect(svg.getAttribute('height')).toBe('192');
      expect(screen.getByTestId('upi-pay-i-have-paid')).toBeInTheDocument();
    });

    it('falls back to client-side <QRCodeSVG> when static order.qrCodeUrl image triggers onError', () => {
      render(
        <UpiPaymentPanel
          order={{ ...baseOrder, qrCodeUrl: 'https://cdn.example.com/broken-qr.png' }}
          amountInr={4500}
          payeeName="Comfort Cove"
          countdown="09:42"
          holdActive
          isMobile={false}
          onIHavePaid={vi.fn()}
          busy={false}
          error={null}
        />,
      );

      const img = screen.getByTestId('upi-pay-qr');
      expect(img.tagName.toLowerCase()).toBe('img');

      fireEvent.error(img);

      const svg = screen.getByTestId('upi-pay-qr-svg');
      expect(svg.tagName.toLowerCase()).toBe('svg');
    });
  });

  describe('GUEST-043 & GUEST-052: /portal, /guest/portal, /checkin, and /checkin/:bookingRef route aliases', () => {
    it('redirects /portal and /guest/portal to /check-in when unauthenticated and /my-bookings when authenticated', () => {
      const unauthValue = {
        auth: { isAuthenticated: false, token: null, email: null, guestId: null },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      };
      const { unmount } = render(
        <GuestAuthContext.Provider value={unauthValue}>
          <MemoryRouter initialEntries={['/guest/portal?t=abc']}>
            <Routes>
              <Route path="/guest/portal" element={<GuestPortalAliasRedirect />} />
              <Route path="/portal" element={<GuestPortalAliasRedirect />} />
              <Route path="/check-in" element={<LocationDisplay testId="landed-route" />} />
              <Route path="/my-bookings" element={<LocationDisplay testId="landed-route" />} />
            </Routes>
          </MemoryRouter>
        </GuestAuthContext.Provider>,
      );
      expect(screen.getByTestId('landed-route').textContent).toBe('/check-in?t=abc');
      unmount();

      const authValue = {
        auth: { isAuthenticated: true, token: 'jwt-1', email: 'guest@example.com', guestId: 10 },
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      };
      render(
        <GuestAuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={['/portal']}>
            <Routes>
              <Route path="/portal" element={<GuestPortalAliasRedirect />} />
              <Route path="/check-in" element={<LocationDisplay testId="landed-route" />} />
              <Route path="/my-bookings" element={<LocationDisplay testId="landed-route" />} />
            </Routes>
          </MemoryRouter>
        </GuestAuthContext.Provider>,
      );
      expect(screen.getByTestId('landed-route').textContent).toBe('/my-bookings');
    });

    it('redirects /checkin and /checkin/:bookingRef to /check-in and /check-in/:bookingRef preserving query params', () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={['/checkin?t=magic99']}>
          <Routes>
            <Route path="/checkin" element={<CheckinAliasRedirect />} />
            <Route path="/check-in" element={<LocationDisplay testId="checkin-landed" />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByTestId('checkin-landed').textContent).toBe('/check-in?t=magic99');
      unmount();

      render(
        <MemoryRouter initialEntries={['/checkin/ATL-102?t=tok123']}>
          <Routes>
            <Route path="/checkin/:bookingRef" element={<CheckinBookingRefAliasRedirect />} />
            <Route path="/check-in/:bookingRef" element={<LocationDisplay testId="checkin-ref-landed" />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByTestId('checkin-ref-landed').textContent).toBe('/check-in/ATL-102?t=tok123');
    });
  });

  describe('GUEST-045: Mobile guest-counter +/- buttons meet 44x44px touch target minimum', () => {
    it('defines width/height/min-width/min-height of 44px on .bw-counter-btn in coarse pointer and mobile viewports', () => {
      const cssPath = path.resolve(__dirname, '../components/availability/AtlasBookingCalendar.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('@media (max-width: 760px)');
      expect(css).toContain('@media (pointer: coarse)');
      const matches44 = css.match(/\.bw-counter-btn\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/g) ?? [];
      expect(matches44.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GUEST-050: GalleryPage classifies segments by listing metadata rather than numeric IDs', () => {
    it('classifies by accommodationType / category / property_name and never by numeric ID thresholds (500/300/200)', () => {
      // Even with id=501 (previously hardcoded to Penthouses), classifies as Villas from metadata
      expect(
        resolveGallerySegment(
          { id: 501, property_name: 'Sunset Pool Villa', accommodationType: 'Villa' },
          5,
        ),
      ).toBe('Villas');

      expect(
        resolveGallerySegment(
          { id: 12, property_name: 'Skyline Penthouse', category: 'penthouse' },
          5,
        ),
      ).toBe('Suites & Penthouses');

      expect(
        resolveGallerySegment(
          { id: 305, property_name: 'Backpacker Bunk', accommodationType: 'HostelDorm' },
          5,
        ),
      ).toBe('Hostel & Dorms');

      // Fewer than 3 properties => groups directly by real property name
      expect(
        resolveGallerySegment(
          { id: 502, property_name: 'Cedar Crest Chalet', accommodationType: 'Villa' },
          2,
        ),
      ).toBe('Cedar Crest Chalet');
    });
  });

  describe('TASK-1040117 / DYN-005: Merchandising deal badge & strike-through original rate', () => {
    it('maps server promotion fields in mapGuestPriceBreakdown and renders badges/strike-through ONLY when genuine discount exists', () => {
      const discountedDto = mapGuestPriceBreakdown({
        listingId: 101,
        currency: 'INR',
        baseAmount: 10000,
        discountAmount: 1500,
        finalAmount: 8755,
        convenienceFeePercent: 3,
        convenienceFeeAmount: 255,
        originalNightlyRate: 5000,
        discountedNightlyRate: 4250,
        appliedPromotionLabel: 'Last-Minute 15% off',
      });

      expect(discountedDto?.originalNightlyRate).toBe(5000);
      expect(discountedDto?.discountedNightlyRate).toBe(4250);
      expect(discountedDto?.appliedPromotionLabel).toBe('Last-Minute 15% off');

      const display = directPriceDisplay({
        baseAmount: 8500,
        discountAmount: 0,
        finalAmount: 8755,
        nights: 2,
        paymentFeeCharged: true,
        paymentFeeAmount: 255,
        originalNightlyRate: discountedDto?.originalNightlyRate,
        discountedNightlyRate: discountedDto?.discountedNightlyRate,
        appliedPromotionLabel: discountedDto?.appliedPromotionLabel,
      });

      expect(display).toEqual({
        standardNightly: 5000,
        realNightly: 4250,
        savingsPercent: 15,
        total: 8755,
        nights: 2,
        appliedPromotionLabel: 'Last-Minute 15% off',
      });

      const { unmount } = render(
        <DirectSavingRow display={display} formatAmount={(n) => `₹${n.toLocaleString('en-IN')}`} />,
      );
      expect(screen.getByTestId('merchandising-deal-badge').textContent).toBe('Last-Minute 15% off');
      expect(screen.getByTestId('bw-standard-nightly').textContent).toContain('₹5,000');
      unmount();

      // MarketplaceListingCard with genuine discount vs undiscounted
      const { rerender } = render(
        <MarketplaceListingCard
          id={101}
          name="Ocean Breeze Suite"
          pricePerNight={4250}
          originalNightlyRate={5000}
          appliedPromotionLabel="Last-Minute 15% off"
        />,
      );
      expect(screen.getByTestId('marketplace-card-deal-badge').textContent).toBe('Last-Minute 15% off');
      expect(screen.getByTestId('marketplace-card-original-rate').textContent).toBe('₹5,000');

      rerender(
        <MarketplaceListingCard
          id={101}
          name="Ocean Breeze Suite"
          pricePerNight={5000}
        />,
      );
      expect(screen.queryByTestId('marketplace-card-deal-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('marketplace-card-original-rate')).not.toBeInTheDocument();
    });
  });
});
