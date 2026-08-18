import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Search, Users } from 'lucide-react';

import { filterDestinations } from '../../marketplace/airbnbSearch/destinationData';
import { readRecentSearches } from '../../marketplace/airbnbSearch/recentSearches';
import { trackEvent } from '../../../utils/analytics';

/**
 * DESIGN-026: Full-screen mobile search overlay.
 *
 * Progressive disclosure:
 *  1. Destination field — auto-focused, shows recent + popular destinations
 *  2. Dates — optional accordion ("Add dates" or "Flexible")
 *  3. Guests — optional accordion ("Add guests")
 *
 * All three are optional for homestay browsing (unlike flights).
 * The overlay navigates to /search with query params on submit.
 *
 * Keyboard avoidance: uses position:fixed + overflow-y:auto so the
 * focused field scrolls into view; env(safe-area-inset-*) for notch.
 */

interface MobileSearchOverlayProps {
  onClose: () => void;
}

const MobileSearchOverlay = ({ onClose }: MobileSearchOverlayProps) => {
  const navigate = useNavigate();

  const [destination, setDestination] = useState('');
  const [showDestinations, setShowDestinations] = useState(true);
  const [step, setStep] = useState<'destination' | 'dates' | 'guests'>('destination');

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Recent + popular destinations
  const recentOptions = useMemo(
    () =>
      readRecentSearches().map((r) => ({
        label: r.destination,
        region: 'Recent search',
        kind: 'recent' as const,
      })),
    [],
  );

  const filteredDestinations = useMemo(
    () => filterDestinations(destination, recentOptions),
    [destination, recentOptions],
  );

  // Auto-focus destination input on mount
  useEffect(() => {
    // Small delay to let the overlay animate in before focusing
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key closes overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectDestination = useCallback((label: string) => {
    setDestination(label);
    setShowDestinations(false);
    setStep('dates');
  }, []);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    const dest = destination.trim();
    if (dest) params.set('destination', dest);

    trackEvent('mobile_search_submitted', {
      source: 'mobile_search_overlay',
      destination: dest || '(any)',
      hasDestination: Boolean(dest),
    });

    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`, {
      state: { fromMobileSearch: true },
    });

    onClose();
  }, [destination, navigate, onClose]);

  return (
    <div
      ref={overlayRef}
      className="mobile-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search stays"
      data-testid="mobile-search-overlay"
    >
      {/* Header */}
      <div className="mobile-search-overlay__header">
        <button
          type="button"
          className="mobile-search-overlay__back"
          onClick={onClose}
          aria-label="Close search"
          data-testid="mobile-search-overlay-close"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="mobile-search-overlay__title">Search stays</h2>
      </div>

      {/* Body — scrollable for keyboard avoidance */}
      <div className="mobile-search-overlay__body">
        {/* Destination field */}
        <div className="mobile-search-overlay__section mobile-search-overlay__section--active">
          <label
            htmlFor="mobile-search-destination"
            className="mobile-search-overlay__field-label"
          >
            <MapPin size={18} aria-hidden="true" />
            Where to?
          </label>
          <input
            ref={inputRef}
            id="mobile-search-destination"
            type="text"
            className="mobile-search-overlay__input"
            placeholder="Search destinations"
            value={destination}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDestinations && filteredDestinations.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            data-testid="mobile-search-destination-input"
            onChange={(e) => {
              setDestination(e.target.value);
              setShowDestinations(true);
            }}
            onFocus={() => setShowDestinations(true)}
          />

          {/* Destination suggestions */}
          {showDestinations && filteredDestinations.length > 0 && (
            <ul
              id={listId}
              className="mobile-search-overlay__suggestions"
              role="listbox"
              aria-label="Destination suggestions"
            >
              {filteredDestinations.map((opt) => (
                <li key={`${opt.kind}-${opt.label}`} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="mobile-search-overlay__suggestion"
                    onClick={() => selectDestination(opt.label)}
                  >
                    <span className="mobile-search-overlay__suggestion-icon" aria-hidden="true">
                      {opt.kind === 'recent' ? '🕑' : '📍'}
                    </span>
                    <span className="mobile-search-overlay__suggestion-text">
                      <span className="mobile-search-overlay__suggestion-label">{opt.label}</span>
                      <span className="mobile-search-overlay__suggestion-region">{opt.region}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dates — optional, progressive disclosure */}
        <div
          className={`mobile-search-overlay__section ${step === 'dates' ? 'mobile-search-overlay__section--active' : ''}`}
        >
          <button
            type="button"
            className="mobile-search-overlay__accordion"
            onClick={() => setStep(step === 'dates' ? 'destination' : 'dates')}
            aria-expanded={step === 'dates'}
          >
            <span className="mobile-search-overlay__field-label">
              <Calendar size={18} aria-hidden="true" />
              When?
            </span>
            <span className="mobile-search-overlay__accordion-hint">
              I'm flexible
            </span>
          </button>
          {step === 'dates' && (
            <p className="mobile-search-overlay__flexible-note">
              Dates are optional — browse available stays anytime.
              <button
                type="button"
                className="mobile-search-overlay__skip-link"
                onClick={() => setStep('guests')}
              >
                Skip to guests →
              </button>
            </p>
          )}
        </div>

        {/* Guests — optional, progressive disclosure */}
        <div
          className={`mobile-search-overlay__section ${step === 'guests' ? 'mobile-search-overlay__section--active' : ''}`}
        >
          <button
            type="button"
            className="mobile-search-overlay__accordion"
            onClick={() => setStep(step === 'guests' ? 'destination' : 'guests')}
            aria-expanded={step === 'guests'}
          >
            <span className="mobile-search-overlay__field-label">
              <Users size={18} aria-hidden="true" />
              Who?
            </span>
            <span className="mobile-search-overlay__accordion-hint">
              Add guests
            </span>
          </button>
          {step === 'guests' && (
            <p className="mobile-search-overlay__flexible-note">
              Guest count is optional — you can set it on the results page.
            </p>
          )}
        </div>
      </div>

      {/* Footer — sticky CTA */}
      <div className="mobile-search-overlay__footer">
        <button
          type="button"
          className="mobile-search-overlay__clear"
          onClick={() => {
            setDestination('');
            setStep('destination');
            setShowDestinations(true);
            inputRef.current?.focus();
          }}
        >
          Clear all
        </button>
        <button
          type="button"
          className="mobile-search-overlay__search-btn"
          onClick={handleSearch}
          data-testid="mobile-search-submit"
        >
          <Search size={18} aria-hidden="true" />
          Search
        </button>
      </div>
    </div>
  );
};

export default MobileSearchOverlay;
