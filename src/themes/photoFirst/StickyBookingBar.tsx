/**
 * TASK-4925 / ADR-0081 D8 — "photoFirst" layout's sticky booking bar.
 *
 * Founder-specified visual direction: "a sticky booking bar (persistent call-to-action while
 * scrolling) rather than the default's inline/hero booking widget placement." This is the one
 * genuinely new interaction pattern in the launch lineup — every other layout places the real
 * `SearchAvailabilityWidget` inline in (or just below) the hero; here it is pinned to the
 * bottom of the viewport instead, so the booking entry point stays reachable no matter how far
 * a guest scrolls through the full-bleed photography.
 *
 * Composes the existing shared `SearchAvailabilityWidget` verbatim — no forked booking/
 * payment/listing-fetch logic (AGENTS.md "Theme ≠ integration" HARD RULE; this task's own
 * stop-and-ask). `id="search-form"` matches the anchor id every other layout's hero widget
 * already uses (`Home.tsx`'s "scroll to search" effect targets this id), so the shared
 * scroll-to-booking behavior works unchanged for this layout too.
 *
 * AA contrast note (epic §3.11/AC15, this task's stop-and-ask): the bar's background is a
 * SOLID (opaque) surface — `--bg-card`/`--bg-primary`, never the underlying photography — so
 * its text contrast is deterministic and never depends on which photo a host uploads.
 */
import { SearchAvailabilityWidget } from '../../components/availability/SearchAvailabilityWidget';
import './StickyBookingBar.css';

const StickyBookingBar = () => {
    return (
        <div
            className="photofirst-sticky-bar"
            data-testid="photofirst-sticky-booking-bar"
            role="region"
            aria-label="Check availability"
        >
            <div id="search-form" className="photofirst-sticky-bar-inner">
                <SearchAvailabilityWidget />
            </div>
        </div>
    );
};

export default StickyBookingBar;
