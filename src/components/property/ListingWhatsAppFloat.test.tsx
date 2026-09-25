import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildListingWhatsAppUrl,
  ListingWhatsAppFloat,
} from "@/components/property/ListingWhatsAppFloat";

vi.mock("@/utils/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from "@/utils/analytics";

const LISTING = "Penthouse 501";
const BRAND = "Sunset Stays";
const PHONE_10 = "7032493290";

describe("buildListingWhatsAppUrl (TASK-102116)", () => {
  it("pre-fills the listing name and inquiry context, URL-encoded", () => {
    const url = buildListingWhatsAppUrl(PHONE_10, LISTING, BRAND);
    expect(url.startsWith("https://wa.me/")).toBe(true);
    expect(url).toContain(`?text=${encodeURIComponent(`Hi, I have a question about ${LISTING} on ${BRAND}`)}`);
  });

  it("prepends the 91 country code for a 10-digit national number", () => {
    expect(buildListingWhatsAppUrl(PHONE_10, LISTING, BRAND)).toBe(
      `https://wa.me/91${PHONE_10}?text=${encodeURIComponent(`Hi, I have a question about ${LISTING} on ${BRAND}`)}`,
    );
  });

  it("keeps an already-prefixed international number untouched", () => {
    const url = buildListingWhatsAppUrl("919812345678", LISTING, BRAND);
    expect(url.startsWith("https://wa.me/919812345678?text=")).toBe(true);
  });

  it("returns '' when no host number is available (never a recipient-less wa.me link)", () => {
    expect(buildListingWhatsAppUrl("", LISTING, BRAND)).toBe("");
    expect(buildListingWhatsAppUrl("   ", LISTING, BRAND)).toBe("");
  });
});

describe("ListingWhatsAppFloat (TASK-102116)", () => {
  it("renders a floating WhatsApp bubble linking to wa.me with the pre-filled room query", () => {
    render(<ListingWhatsAppFloat listingName={LISTING} phoneDigits={PHONE_10} brandName={BRAND} listingId={501} />);

    const bubble = screen.getByTestId("listing-whatsapp-float");
    expect(bubble).toBeInTheDocument();
    expect(bubble.tagName).toBe("A");
    expect(bubble).toHaveAttribute(
      "href",
      `https://wa.me/91${PHONE_10}?text=${encodeURIComponent(`Hi, I have a question about ${LISTING} on ${BRAND}`)}`,
    );
    expect(bubble).toHaveAttribute("target", "_blank");
    expect(bubble).toHaveAttribute("aria-label", `Chat with host on WhatsApp about ${LISTING}`);
  });

  it("degrades gracefully: renders nothing when no host number is available", () => {
    const { container } = render(
      <ListingWhatsAppFloat listingName={LISTING} phoneDigits="" brandName={BRAND} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("listing-whatsapp-float")).not.toBeInTheDocument();
  });

  it("degrades gracefully: renders nothing for a whitespace-only number", () => {
    const { container } = render(
      <ListingWhatsAppFloat listingName={LISTING} phoneDigits="   " brandName={BRAND} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never invents a phone number: no wa.me link without a supplied number", () => {
    render(<ListingWhatsAppFloat listingName={LISTING} phoneDigits="" brandName={BRAND} />);
    const anchors = document.querySelectorAll('a[href*="wa.me"]');
    expect(anchors.length).toBe(0);
  });

  it("tracks the tap with the listing context", () => {
    render(<ListingWhatsAppFloat listingName={LISTING} phoneDigits={PHONE_10} brandName={BRAND} listingId={501} />);
    fireEvent.click(screen.getByTestId("listing-whatsapp-float"));
    expect(trackEvent).toHaveBeenCalledWith(
      "whatsapp_cta_click",
      expect.objectContaining({ surface: "listing_float", listingId: 501 }),
    );
  });
});
