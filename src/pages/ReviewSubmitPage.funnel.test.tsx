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
  // Select overall rating
  const overallContainer = screen.getByTestId("overall-rating-stars");
  const starButton = within(overallContainer).getByRole("button", {
    name: `${ratingValue} star${ratingValue !== 1 ? "s" : ""}`,
  });
  fireEvent.click(starButton);

  // Fill required subratings (cleanliness, value, checkin, communication)
  for (const key of ["cleanliness", "value", "checkin", "communication"]) {
    const subContainer = screen.getByTestId(`subrating-${key}`);
    const subStar = within(subContainer).getByRole("button", { name: "5 stars" });
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

  it("does NOT render Google review CTA when a 3-star review is submitted", async () => {
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
    expect(screen.queryByTestId("review-success-google-cta")).not.toBeInTheDocument();
    expect(screen.queryByText("Share your experience on Google Maps!")).not.toBeInTheDocument();
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
