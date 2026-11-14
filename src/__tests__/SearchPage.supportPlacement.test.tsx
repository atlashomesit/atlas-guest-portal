import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyProvider } from "../contexts/CurrencyContext";
import SearchPage from "../pages/SearchPage";
import SupportWidget from "../components/support/SupportWidget";
import { SupportTriggerSlotProvider } from "../components/support-drawer/SupportTriggerSlot";
import { settle } from "../test/settle";

const listings = vi.hoisted(() => vi.fn());
vi.mock("../api/listingClient", async (original) => ({
  ...await original<typeof import("../api/listingClient")>(),
  fetchPublicListings: listings,
}));
vi.mock("../tenant/tenantOverrides", async (original) => {
  const actual = await original<typeof import("../tenant/tenantOverrides")>();
  return { ...actual, getTenantOverrides: (slug?: string | null) => ({ ...actual.getTenantOverrides(slug), onlyApiListings: true }) };
});

function Shell() {
  const [empty, setEmpty] = useState(false);
  return <><SearchPage onEmptyStateChange={setEmpty} /><SupportWidget placement={empty ? "inline" : "search"} /></>;
}
function mount(url = "/search") {
  return render(<MemoryRouter initialEntries={[url]}><CurrencyProvider><SupportTriggerSlotProvider><Shell /></SupportTriggerSlotProvider></CurrencyProvider></MemoryRouter>);
}
const trigger = () => screen.getByTestId("support-widget-trigger");
afterEach(() => vi.restoreAllMocks());

describe("B03 actual Search state/launcher integration", () => {
  it("keeps support during loading, then confirmed empty uses original inline destination without a second target", async () => {
    let resolve!: (value: unknown[]) => void;
    listings.mockReturnValue(new Promise((r) => { resolve = r; }));
    mount();
    expect(trigger().parentElement).toBe(screen.getByTestId("search-support-slot"));
    expect(screen.getAllByTestId("support-widget-trigger")).toHaveLength(1);
    await act(async () => { resolve([]); });
    await settle();
    expect(screen.getByTestId("search-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("search-support-slot")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("data-placement", "inline");
    expect(screen.getAllByTestId("support-widget-trigger")).toHaveLength(1);
  });

  it("failed load retains the Search slot and retry recovers without duplicating support", async () => {
    listings.mockRejectedValueOnce(new Error("synthetic unavailable"));
    listings.mockResolvedValue([{ id: 991, name: "Synthetic Home", maxGuests: 4, baseNightlyRate: 3500 }]);
    mount();
    await settle();
    expect(screen.getByTestId("search-load-error")).toBeInTheDocument();
    expect(trigger().parentElement).toBe(screen.getByTestId("search-support-slot"));
    expect(screen.queryByTestId("search-empty-state")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await settle();
    expect(screen.getByTestId("guest-search-results")).toBeInTheDocument();
    expect(screen.getAllByTestId("support-widget-trigger")).toHaveLength(1);
    expect(trigger().parentElement).toBe(screen.getByTestId("search-support-slot"));
  });
});
