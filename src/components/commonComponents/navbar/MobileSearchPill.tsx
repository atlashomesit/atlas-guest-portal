import { useState } from 'react';
import { Search } from 'lucide-react';
import MobileSearchOverlay from './MobileSearchOverlay';

/**
 * DESIGN-026: Persistent mobile search affordance.
 *
 * Compact pill in the mobile header row (between logo and hamburger).
 * Tapping opens a full-screen MobileSearchOverlay with destination,
 * dates (optional), and guests fields.
 *
 * Desktop: hidden — the existing `.navbar-search-pill` (desktop-only
 * Link to /search) remains unchanged.
 */
const MobileSearchPill = () => {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="mobile-search-pill lg:hidden"
        onClick={() => setOverlayOpen(true)}
        aria-label="Search stays"
        data-testid="mobile-search-pill"
      >
        <Search size={16} strokeWidth={2.5} aria-hidden="true" />
        <span className="mobile-search-pill__label">Where to?</span>
      </button>

      {overlayOpen && (
        <MobileSearchOverlay onClose={() => setOverlayOpen(false)} />
      )}
    </>
  );
};

export default MobileSearchPill;
