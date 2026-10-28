/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewSubmitPage from "./ReviewSubmitPage";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

vi.mock("../api/client", () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
}));

const mockEligibility = {
  bookingId: 101,
  guestName: "Alice Smith",
  propertyName: "Sunset Villa",
  listingName: "Master Villa",
  listingId: 456,
  checkedOut: true,
  alreadyReviewed: false,
  checkoutDate: "2026-10-01",
};

const renderPage = (path = "/review/101?t=valid-token") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/review/:bookingId" element={<ReviewSubmitPage />} />
      </Routes>
    </MemoryRouter>,
  );

async function fillAndSubmitReview(ratingValue: number) {
  // Select overall rating (UXD-2026-10-23-08-A names each star "<group>: N of 5 stars")
  const overallContainer = screen.getByTestId("overall-rating-stars");
  const starButton = within(overallContainer).getByRole("button", {
    name: `Overall rating: ${ratingValue} of 5 stars`,
  });
  fireEvent.click(starButton);

  // Fill required subratings (cleanliness, value, checkin, communication)
  for (const key of ["cleanliness", "value", "checkin", "communication"]) {
    const subContainer = screen.getByTestId(`subrating-${key}`);
    const subStar = within(subContainer).getByRole("button", { name: /: 5 of 5 stars$/ });
    fireEvent.click(subStar);
  }

  // Fill review body (must be >= 20 chars)
  const bodyTextarea = screen.getByLabelText(/Your experience/i);
  fireEvent.change(bodyTextarea, {
    target: { value: "We had an absolutely wonderful stay at Sunset Villa! Highly recommended." },
  });

  // Submit form
  const submitButton = screen.getByRole("button", { name: /Submit Review/i });
  fireEvent.click(submitButton);

  await settle();
}

describe("ReviewSubmitPage — Google Review Funnel (REV-021)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders Google review CTA card and link when 5-star review is submitted and hasGoogleReviewLink is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reviews/check/101")) {
          return new Response(JSON.stringify(mockEligibility), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/public/review-funnel/456")) {
          return new Response(
            JSON.stringify({
              hasGoogleReviewLink: true,
              googleReviewUrl: "https://maps.google.com/review?id=456",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url.includes("/api/reviews")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    renderPage();
    await settle();

    expect(screen.getByText("How was your stay?")).toBeInTheDocument();

    await fillAndSubmitReview(5);

    expect(screen.getByText("Thank you for your review!")).toBeInTheDocument();
    expect(screen.getByText("Share your experience on Google Maps!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your review helps fellow travelers discover Sunset Villa. Would you take 10 seconds to share your review on Google?",
      ),
    ).toBeInTheDocument();

    const cta = screen.getByTestId("review-success-google-cta");
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "https://maps.google.com/review?id=456");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
    expect(cta).toHaveTextContent("Post on Google Reviews");
  });

  it("renders Google review CTA when 4-star review is submitted and hasGoogleReviewLink is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reviews/check/101")) {
          return new Response(JSON.stringify(mockEligibility), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/public/review-funnel/456")) {
          return new Response(
            JSON.stringify({
              hasGoogleReviewLink: true,
              googleReviewUrl: "https://maps.google.com/review?id=456",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url.includes("/api/reviews")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    renderPage();
    await settle();

    await fillAndSubmitReview(4);

    expect(screen.getByText("Thank you for your review!")).toBeInTheDocument();
    expect(screen.getByTestId("review-success-google-cta")).toBeInTheDocument();
  });

  it("3-star review: the big Google card stays for 4-5 stars only, but the guest still gets a Google link (REV-046)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reviews/check/101")) {
          return new Response(JSON.stringify(mockEligibility), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/public/review-funnel/456")) {
          return new Response(
            JSON.stringify({
              hasGoogleReviewLink: true,
              googleReviewUrl: "https://maps.google.com/review?id=456",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url.includes("/api/reviews")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    renderPage();
    await settle();

    await fillAndSubmitReview(3);

    expect(screen.getByText("Thank you for your review!")).toBeInTheDocument();
    // No promotional Google card for a 3-star review ...
    expect(screen.queryByTestId("review-success-google-cta")).not.toBeInTheDocument();
    expect(screen.queryByText("Share your experience on Google Maps!")).not.toBeInTheDocument();
    // ... but never a screen with no route to Google: the owner is told, and the link is right there.
    expect(
      screen.getByText("Sorry your stay wasn't perfect. The owner has your feedback and will contact you."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/means a lot/)).not.toBeInTheDocument();
    const link = screen.getByTestId("review-success-google-link");
    expect(link).toHaveTextContent("Prefer to post publicly? Review us on Google");
    expect(link).toHaveAttribute("href", "https://maps.google.com/review?id=456");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does NOT render Google review CTA when hasGoogleReviewLink is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reviews/check/101")) {
          return new Response(JSON.stringify(mockEligibility), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/api/public/review-funnel/456")) {
          return new Response(
            JSON.stringify({
              hasGoogleReviewLink: false,
              googleReviewUrl: null,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url.includes("/api/reviews")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    renderPage();
    await settle();

    await fillAndSubmitReview(5);

    expect(screen.getByText("Thank you for your review!")).toBeInTheDocument();
    expect(screen.queryByTestId("review-success-google-cta")).not.toBeInTheDocument();
    expect(screen.queryByText("Share your experience on Google Maps!")).not.toBeInTheDocument();
  });
});

/**
 * REV-046 (founder ruling 2026-10-28): catch first, Google open to every guest. A 1-3 star guest on the post-stay
 * review page sees a readable Google link while rating (before submitting), and again on the thank-you screen.
 * 4-5 stars keep the big Google card exactly as REV-021 built it.
 */
describe("ReviewSubmitPage — low ratings keep a route to Google (REV-046)", () => {
  const GOOGLE_URL = "https://maps.google.com/review?id=456";

  const stubApi = (funnel: { hasGoogleReviewLink: boolean; googleReviewUrl: string | null }) => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const ok = (body: unknown) =>
          new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        if (url.includes("/api/reviews/check/101")) return ok(mockEligibility);
        if (url.includes("/api/public/review-funnel/456")) return ok(funnel);
        if (url.includes("/api/reviews")) return ok({ success: true });
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
    return calls;
  };

  const pickOverall = (value: number) => {
    const group = screen.getByTestId("overall-rating-stars");
    fireEvent.click(within(group).getByRole("button", { name: `Overall rating: ${value} of 5 stars` }));
  };

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([1, 2, 3])(
    "%i stars selected: a readable Google link is on the form before anything is submitted",
    async (value) => {
      const calls = stubApi({ hasGoogleReviewLink: true, googleReviewUrl: GOOGLE_URL });
      renderPage();
      await settle();

      expect(screen.queryByTestId("review-low-google-link")).not.toBeInTheDocument();
      pickOverall(value);

      const link = screen.getByTestId("review-low-google-link");
      expect(link).toBeVisible();
      expect(link).toHaveTextContent("Prefer to post publicly? Review us on Google");
      expect(link).toHaveAttribute("href", GOOGLE_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.closest("details")).toBeNull();
      expect(link.closest("[hidden]")).toBeNull();
      expect(link.closest("[aria-hidden='true']")).toBeNull();

      // Nothing has been submitted: the link is not behind sending.
      expect(calls.some((url) => url.endsWith("/api/reviews"))).toBe(false);
      expect(screen.getByRole("button", { name: /Submit Review/i })).toBeInTheDocument();
      expect(screen.queryByTestId("review-success-google-link")).not.toBeInTheDocument();
    },
  );

  it.each([4, 5])("%i stars selected: no low-rating link (the big card comes after submitting, as before)", async (value) => {
    stubApi({ hasGoogleReviewLink: true, googleReviewUrl: GOOGLE_URL });
    renderPage();
    await settle();

    pickOverall(value);

    expect(screen.queryByTestId("review-low-google-link")).not.toBeInTheDocument();
  });

  it("follows the star: the link goes when the guest moves up to 4 stars and returns for 3", async () => {
    stubApi({ hasGoogleReviewLink: true, googleReviewUrl: GOOGLE_URL });
    renderPage();
    await settle();

    pickOverall(2);
    expect(screen.getByTestId("review-low-google-link")).toBeInTheDocument();
    pickOverall(4);
    expect(screen.queryByTestId("review-low-google-link")).not.toBeInTheDocument();
    pickOverall(3);
    expect(screen.getByTestId("review-low-google-link")).toBeInTheDocument();
  });

  it("shows no link while the host has not saved a Google review link", async () => {
    stubApi({ hasGoogleReviewLink: false, googleReviewUrl: null });
    renderPage();
    await settle();

    pickOverall(1);

    expect(screen.queryByTestId("review-low-google-link")).not.toBeInTheDocument();
  });

  it.each([1, 2])(
    "after submitting %i stars: the owner is told and the same Google link stays on the thank-you screen",
    async (value) => {
      stubApi({ hasGoogleReviewLink: true, googleReviewUrl: GOOGLE_URL });
      renderPage();
      await settle();

      await fillAndSubmitReview(value);

      expect(screen.getByText("Thank you for your review!")).toBeInTheDocument();
      expect(
        screen.getByText("Sorry your stay wasn't perfect. The owner has your feedback and will contact you."),
      ).toBeInTheDocument();
      const link = screen.getByTestId("review-success-google-link");
      expect(link).toBeVisible();
      expect(link).toHaveTextContent("Prefer to post publicly? Review us on Google");
      expect(link).toHaveAttribute("href", GOOGLE_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(screen.queryByTestId("review-success-google-cta")).not.toBeInTheDocument();
      expect(screen.queryByTestId("review-low-google-link")).not.toBeInTheDocument();
    },
  );

  it("after submitting a low rating with no Google link saved: the sentence, no link", async () => {
    stubApi({ hasGoogleReviewLink: false, googleReviewUrl: null });
    renderPage();
    await settle();

    await fillAndSubmitReview(2);

    expect(
      screen.getByText("Sorry your stay wasn't perfect. The owner has your feedback and will contact you."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("review-success-google-link")).not.toBeInTheDocument();
  });

  it("after submitting 4 or 5 stars: the big card as before, and none of the low-rating wording", async () => {
    stubApi({ hasGoogleReviewLink: true, googleReviewUrl: GOOGLE_URL });
    renderPage();
    await settle();

    await fillAndSubmitReview(5);

    expect(screen.getByTestId("review-success-google-cta")).toHaveAttribute("href", GOOGLE_URL);
    expect(screen.queryByTestId("review-success-google-link")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sorry your stay wasn't perfect/)).not.toBeInTheDocument();
    expect(screen.getByText(/means a lot/)).toBeInTheDocument();
  });
});
