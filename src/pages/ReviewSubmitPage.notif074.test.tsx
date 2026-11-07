/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewSubmitPage from "./ReviewSubmitPage";
import { resolveReviewLinkParams } from "./reviewLinkParams";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

vi.mock("../api/client", () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
}));

const eligibility = {
  bookingId: 1042,
  guestName: "Priya",
  propertyName: "Aurelia",
  listingName: "Aurelia Loft",
  listingId: 456,
  checkedOut: true,
  alreadyReviewed: false,
  checkoutDate: "2026-11-05",
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/review/:bookingId" element={<ReviewSubmitPage />} />
      </Routes>
    </MemoryRouter>,
  );

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/reviews/check/1042")) {
        return new Response(JSON.stringify(eligibility), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/api/public/review-funnel/456")) {
        return new Response(JSON.stringify({ hasGoogleReviewLink: false }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
  return calls;
}

describe("NOTIF-074: review link from the WhatsApp button", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads the access code from the query string or from an encoded tail", () => {
    expect(resolveReviewLinkParams("1042", "abc")).toEqual({ bookingId: "1042", token: "abc" });
    expect(resolveReviewLinkParams("1042?t=abc", null)).toEqual({ bookingId: "1042", token: "abc" });
    expect(resolveReviewLinkParams("1042&t=abc", null)).toEqual({ bookingId: "1042", token: "abc" });
    expect(resolveReviewLinkParams("1042", null)).toEqual({ bookingId: "1042", token: null });
    expect(resolveReviewLinkParams("review", "abc")).toEqual({ bookingId: null, token: "abc" });
  });

  it("opens the review form when the button suffix arrives as written (?t= in the query)", async () => {
    const calls = stubFetch();
    renderAt("/review/1042?t=0f8fad5bd9cb469fa16570867728950e");
    await settle();

    expect(calls.some((u) => u.includes("/api/reviews/check/1042?t=0f8fad5bd9cb469fa16570867728950e"))).toBe(true);
    expect(screen.getByText("How was your stay?")).toBeInTheDocument();
  });

  it("opens the review form when WhatsApp percent-encodes the ? and = of the suffix", async () => {
    const calls = stubFetch();
    renderAt("/review/1042%3Ft%3D0f8fad5bd9cb469fa16570867728950e");
    await settle();

    expect(calls.some((u) => u.includes("/api/reviews/check/1042?t=0f8fad5bd9cb469fa16570867728950e"))).toBe(true);
    expect(screen.getByText("How was your stay?")).toBeInTheDocument();
  });

  it("a link with no access code is not a dead end: it says what is missing and links to My bookings", async () => {
    const calls = stubFetch();
    renderAt("/review/1042");
    await settle();

    expect(calls).toHaveLength(0);
    expect(screen.getByText("This review link is incomplete")).toBeInTheDocument();
    expect(screen.getByTestId("review-link-missing-code")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My bookings" })).toHaveAttribute("href", "/my-bookings");
    expect(screen.queryByText(/Invalid review link/)).not.toBeInTheDocument();
  });
});
