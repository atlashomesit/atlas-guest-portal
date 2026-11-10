/**
 * GUEST-065 / G2 journey 25: the phone Pay bar on the checkout page is fixed to the bottom edge. The privacy banner
 * (CookieConsentBanner) sits at `bottom: var(--pp-sticky-bar-offset, 0px)`, a height the listing page's Reserve bar
 * publishes. The checkout page's bar published nothing, so on a 393 px screen the banner covered the Pay button and a
 * first-time guest could not tap it until the banner was answered (measured 2026-11-10: banner 725-852 px, Pay 787-840 px).
 */
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import { STICKY_BAR_OFFSET_VAR } from "@/components/property/propertyHelpEvents";
import GuestDetailsPage from "./GuestDetailsPage";
import { settle } from "../../test/settle";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

function seedActiveHold() {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      holdId: 42,
      holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      holdPropertySlug: "atlas-prop",
      holdUnitSlug: "atlas-unit",
      holdListingName: "Atlas Unit",
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      guests: 2,
    }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  document.body.style.removeProperty(STICKY_BAR_OFFSET_VAR);
  seedActiveHold();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  document.body.style.removeProperty(STICKY_BAR_OFFSET_VAR);
  vi.restoreAllMocks();
});

describe("GuestDetailsPage phone Pay bar publishes its height for the privacy banner", () => {
  test("body carries the Pay bar's live height while the page is open and it is cleared on leaving", async () => {
    const original = window.HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("gd-mobile-bar")) {
        return { x: 0, y: 700, top: 700, bottom: 777, left: 0, right: 393, width: 393, height: 77, toJSON: () => ({}) } as DOMRect;
      }
      return original.call(this);
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );
    await settle();
    expect(document.querySelector(".gd-mobile-bar")).toBeInTheDocument();

    expect(document.body.style.getPropertyValue(STICKY_BAR_OFFSET_VAR)).toBe("77px");

    unmount();
    expect(document.body.style.getPropertyValue(STICKY_BAR_OFFSET_VAR)).toBe("");
  });
});
