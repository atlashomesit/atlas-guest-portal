import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import type { GuestListingHistoryItem } from "../utils/guestHistory";

// Controlled history — the strip reads via getRecentlyViewed().
const mockItems: GuestListingHistoryItem[] = [];
vi.mock("../utils/guestHistory", () => ({
  getRecentlyViewed: () => mockItems,
  removeRecentlyViewed: vi.fn(),
}));

// Render OptimizedImage as a plain <img> so we can assert on its src.
vi.mock("./ui/OptimizedImage", () => ({
  default: ({ src, alt }: { src: string; alt?: string }) => <img data-testid="rv-img" src={src} alt={alt} />,
}));

import RecentlyViewedStrip from "./RecentlyViewedStrip";

const ALLOWED = "https://atlashomestorage.blob.core.windows.net/listing-images/hero.jpg";
const BLOCKED = "https://someprivatetenant.blob.core.windows.net/private/1.jpg";

function setItems(items: GuestListingHistoryItem[]) {
  mockItems.length = 0;
  mockItems.push(...items);
}

const renderStrip = () =>
  render(
    <MemoryRouter>
      <RecentlyViewedStrip />
    </MemoryRouter>,
  );

describe("RecentlyViewedStrip (TASK-4289)", () => {
  beforeEach(() => setItems([]));

  it("renders the canonical listing image", () => {
    setItems([
      { listingId: 1, path: "/homes/a/1", name: "Studio 101", coverPhotoUrl: ALLOWED, viewedAtUtc: "2026-07-01T00:00:00Z" },
    ]);
    renderStrip();
    const imgs = screen.getAllByTestId("rv-img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", ALLOWED);
  });

  it("falls back to the placeholder for a blocked or empty cover URL (no broken img)", () => {
    setItems([
      { listingId: 2, path: "/homes/a/2", name: "Blocked", coverPhotoUrl: BLOCKED, viewedAtUtc: "2026-07-01T00:00:00Z" },
      { listingId: 3, path: "/homes/a/3", name: "Empty", coverPhotoUrl: "", viewedAtUtc: "2026-07-01T00:00:00Z" },
    ]);
    renderStrip();
    // Neither a blocked nor an empty URL should ever reach the <img> src.
    expect(screen.queryAllByTestId("rv-img")).toHaveLength(0);
    expect(screen.getByTestId("recently-viewed-strip")).toBeInTheDocument();
  });

  it("shows the image only for valid covers in a mixed list", () => {
    setItems([
      { listingId: 4, path: "/homes/a/4", name: "Good", coverPhotoUrl: ALLOWED, viewedAtUtc: "2026-07-01T00:00:00Z" },
      { listingId: 5, path: "/homes/a/5", name: "Bad", coverPhotoUrl: BLOCKED, viewedAtUtc: "2026-07-01T00:00:00Z" },
    ]);
    renderStrip();
    const imgs = screen.getAllByTestId("rv-img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", ALLOWED);
  });
});
