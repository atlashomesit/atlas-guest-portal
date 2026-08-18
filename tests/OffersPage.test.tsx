import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import OffersPage from "../src/pages/OffersPage";

// TASK-4462: OffersPage must surface an explicit error/retry state when the
// listings fetch fails, instead of silently hiding the deal sections.

const refetchMock = vi.fn(async () => {});

vi.mock("../src/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    listings: [],
    properties: [],
    state: "error" as const,
    fetchErrorMessage: "Network request failed",
    refetch: refetchMock,
  }),
}));

vi.mock("@/api/client", () => ({
  buildApiUrl: (path: string) => `https://api.test${path}`,
  getApiHeaders: () => ({ "X-Tenant-Slug": "atlas" }),
}));

describe("OffersPage — listings fetch error state (TASK-4462)", () => {
  beforeEach(() => {
    refetchMock.mockClear();
    // TASK-8016: OffersPage also validates DIRECT5 on mount — keep that inactive here.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an explicit error message with the hook's error detail", () => {
    render(<OffersPage />);

    const alert = screen.getByTestId("offers-deals-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent(/we couldn't load current deals/i);
    expect(alert).toHaveTextContent("Network request failed");
  });

  it("does not render empty deal sections in the error state", () => {
    render(<OffersPage />);

    expect(screen.queryByText(/extended-stay discounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading current deals/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last-minute deals/i)).not.toBeInTheDocument();
  });

  it("retries the fetch when 'Try again' is clicked", () => {
    render(<OffersPage />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
