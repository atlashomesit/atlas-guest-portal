/**
 * GUEST-063: OffersPage says 'best rates' only when the add-on fee is known to be 0 (and not marketplace root);
 * where the 3% add-on applies or fee is unknown, it uses 'Book direct with the host'.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  fee: vi.fn<() => number | null>(() => 3),
  ctx: vi.fn<() => { slug: string; name: string; isMarketplaceRoot?: boolean } | null>(() => ({
    slug: "atlas",
    name: "Atlas Homestays",
  })),
}));

vi.mock("@/hooks/useTenantProcessingFee", () => ({
  useTenantProcessingFee: () => mocks.fee(),
}));
vi.mock("@/tenant/tenantContext", () => ({
  getTenantContext: () => mocks.ctx(),
}));
vi.mock("@/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    properties: [],
    state: "success",
    fetchErrorMessage: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAdvertisedPromoActive", () => ({
  useAdvertisedPromoActive: () => "inactive",
}));
vi.mock("@/hooks/useAbSuggest", () => ({
  useAbSuggest: () => ({ status: "none" }),
}));

import OffersPage from "./OffersPage";

describe("OffersPage best-rates copy gate (GUEST-063)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows neutral 'Book direct with the host' when the 3% add-on applies", () => {
    mocks.fee.mockReturnValue(3);
    mocks.ctx.mockReturnValue({ slug: "atlas", name: "Atlas Homestays" });
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("offers-hero-subtitle")).toHaveTextContent("Book direct with the host");
    expect(screen.queryByText(/unlock the best rates/i)).toBeNull();
  });

  it("shows neutral 'Book direct with the host' when fee is unknown (null)", () => {
    mocks.fee.mockReturnValue(null);
    mocks.ctx.mockReturnValue({ slug: "atlas", name: "Atlas Homestays" });
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("offers-hero-subtitle")).toHaveTextContent("Book direct with the host");
  });

  it("shows 'best rates' only when the add-on fee is known to be 0 on a non-marketplace tenant", () => {
    mocks.fee.mockReturnValue(0);
    mocks.ctx.mockReturnValue({ slug: "host-a", name: "Host A", isMarketplaceRoot: false });
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("offers-hero-subtitle")).toHaveTextContent(
      "Book direct and unlock the best rates — no OTA fees, no middlemen.",
    );
  });

  it("shows neutral 'Book direct with the host' on marketplace root even if tenant fee reads 0", () => {
    mocks.fee.mockReturnValue(0);
    mocks.ctx.mockReturnValue({ slug: "atlas", name: "Atlas", isMarketplaceRoot: true });
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("offers-hero-subtitle")).toHaveTextContent("Book direct with the host");
  });
});
