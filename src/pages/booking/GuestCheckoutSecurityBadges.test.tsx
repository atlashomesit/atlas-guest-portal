/**
 * TASK-102074: checkout order-summary trust badges render on direct checkout ONLY when an
 * online payment rail exists. On the TASK-8048 WhatsApp-handoff branch (no gateway) the
 * SSL/RBI/instant-confirmation claims would be false, so they must never appear there.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn(), TerminalCheckoutOutcomeEvents: {} }));

const mockTenant = vi.hoisted(() => ({ ctx: undefined as Record<string, unknown> | undefined }));
vi.mock("@/tenant/tenantContext", () => ({
  getTenantContext: () => mockTenant.ctx,
}));

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

async function renderPage() {
  render(
    <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  // wait for hold rehydration → form render
  await waitFor(() => expect(document.getElementById("gd-details-form")).toBeInTheDocument());
}

beforeEach(() => {
  window.sessionStorage.clear();
  seedActiveHold();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  mockTenant.ctx = undefined;
  vi.restoreAllMocks();
});

const BADGES = ["256-Bit SSL Encrypted", "RBI-Regulated Gateway", "Instant Booking Confirmation"];

describe("TASK-102074: checkout order-summary trust badges", () => {
  it("renders security badges on an online-rail tenant (desktop aside + mobile in-form)", async () => {
    mockTenant.ctx = {
      slug: "atlas",
      name: "Atlastays",
      paymentProvider: "RAZORPAY",
      bookingMode: "ONLINE",
    };

    await renderPage();

    const badges = screen.getAllByTestId("guest-checkout-security-badges");
    expect(badges.length).toBe(2); // desktop aside + mobile in-form region
    for (const badge of badges) {
      for (const claim of BADGES) {
        expect(badge).toHaveTextContent(claim);
      }
    }
    // Online CTA present, WhatsApp handoff absent.
    expect(screen.getByTestId("guest-booking-submit")).toBeInTheDocument();
    expect(screen.getByTestId("guest-booking-submit-mobile")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-booking-whatsapp-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guest-booking-whatsapp-cta-mobile")).not.toBeInTheDocument();
  });

  it("does not render security badges on the WhatsApp-handoff branch", async () => {
    mockTenant.ctx = {
      slug: "qa-offline",
      name: "Offline Host",
      paymentProvider: null,
      bookingMode: "WHATSAPP",
    };

    await renderPage();

    expect(screen.queryByTestId("guest-checkout-security-badges")).not.toBeInTheDocument();
    expect(screen.queryByText("Secure checkout")).not.toBeInTheDocument();
    // WhatsApp CTA present, no Pay button, no security claims.
    expect(screen.getByTestId("guest-booking-whatsapp-cta")).toBeInTheDocument();
    expect(screen.getByTestId("guest-booking-whatsapp-cta-mobile")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-booking-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guest-booking-submit-mobile")).not.toBeInTheDocument();
    for (const claim of BADGES) {
      expect(screen.queryByText(claim)).not.toBeInTheDocument();
    }
  });
});