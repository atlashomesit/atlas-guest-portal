import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReviewsWidgetEmbedPage, { filterQualifyingReviews } from "./ReviewsWidgetEmbedPage";

describe("REV-058 ReviewsWidgetEmbedPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("excludes <4 star and hidden reviews and renders >=4 star reviews in carousel layout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, rating: 5, reviewerName: "Asha Rao", comment: "Spotless villa!", source: "Airbnb", isHidden: false },
        { id: 2, rating: 3, reviewerName: "Low Rating", comment: "Should be hidden", source: "Google", isHidden: false },
        { id: 3, rating: 5, reviewerName: "Hidden Guest", comment: "Moderated out", source: "Direct", isHidden: true },
        { id: 4, rating: 4, reviewerName: "Vikram Patel", comment: "Great host", source: "Direct", isHidden: false },
      ],
    } as Response);

    render(
      <MemoryRouter initialEntries={["/embed/demo/reviews"]}>
        <Routes>
          <Route path="/embed/:embedKey/reviews" element={<ReviewsWidgetEmbedPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("rev058-embed-carousel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("rev058-review-card-1")).toHaveTextContent("Asha");
    expect(screen.getByTestId("rev058-review-card-4")).toHaveTextContent("Vikram");
    expect(screen.queryByTestId("rev058-review-card-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rev058-review-card-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("rev058-embed-summary")).toHaveTextContent("4.5 ★ · 2 reviews");
  });

  it("renders compact badge layout and stays silent on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    const { container } = render(
      <MemoryRouter initialEntries={["/embed/demo/reviews?layout=badge"]}>
        <Routes>
          <Route path="/embed/:embedKey/reviews" element={<ReviewsWidgetEmbedPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
    expect(filterQualifyingReviews([{ id: 1, rating: 3.9 }, { id: 2, rating: 4.0, isHidden: true }])).toHaveLength(0);
  });
});
