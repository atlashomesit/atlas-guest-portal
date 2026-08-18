import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OffersPage from "../src/pages/OffersPage";
import DirectDiscountBanner from "../src/components/DirectDiscountBanner";

const refetchMock = vi.fn(async () => {});

vi.mock("../src/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    listings: [],
    properties: [],
    state: "success" as const,
    fetchErrorMessage: null,
    refetch: refetchMock,
  }),
}));

vi.mock("@/api/client", () => ({
  buildApiUrl: (path: string) => `https://api.test${path}`,
  getApiHeaders: () => ({ "X-Tenant-Slug": "atlas" }),
}));

describe("TASK-8016 advertised promo choke-point", () => {
  beforeEach(() => {
    refetchMock.mockClear();
    try {
      sessionStorage.removeItem("directDiscountBannerDismissed");
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("OffersPage hides DIRECT5 card when validate returns valid:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ valid: false, message: "Promo code not found or inactive." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<OffersPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("offers-direct5-card")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/copy DIRECT5 promo code/i)).not.toBeInTheDocument();
  });

  it("OffersPage shows DIRECT5 card when validate returns valid:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ valid: true, message: "ok", discountType: "Percent", discountValue: 5 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(<OffersPage />);

    await waitFor(() => {
      expect(screen.getByTestId("offers-direct5-card")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/copy DIRECT5 promo code/i)).toBeInTheDocument();
  });

  it("DirectDiscountBanner renders nothing when validate returns valid:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ valid: false, message: "Promo code not found or inactive." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<DirectDiscountBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId("direct-discount-banner")).not.toBeInTheDocument();
    });
  });
});
