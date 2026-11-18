/** TASK-1040186: white-label tenants must never see the bundled Atlas Homes catalog. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const ctx = vi.hoisted(() => ({ slug: "qa-fixture-lockoff" as string | undefined }));
vi.mock("@/tenant/tenantContext", () => ({ getTenantContext: () => (ctx.slug ? { slug: ctx.slug } : null) }));
vi.mock("@/tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  getTenantListingAddress: vi.fn(() => undefined),
  getTenantPublicListingIdAllowlist: vi.fn(() => new Set<number>()),
}));
vi.mock("@/api/listingClient", () => ({
  fetchPublicListings: vi.fn(() => Promise.reject(new Error("boom"))),
}));

type HookModule = typeof import("./useTenantListings");
let mod: HookModule;

describe("useTenantListings fallback catalog (TASK-1040186)", () => {
  beforeEach(async () => {
    // setup.ts already imported the real hook module; re-import so the tenant mock applies.
    vi.resetModules();
    mod = await import("./useTenantListings");
  });

  it("white-label tenant gets 0 fallback listings on mount and after fetch rejection", async () => {
    ctx.slug = "qa-fixture-lockoff";
    const { result } = renderHook(() => mod.useTenantListings());
    expect(result.current.listings).toHaveLength(0);
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.listings).toHaveLength(0);
    expect(JSON.stringify(result.current.properties)).not.toMatch(/Penthouse 501|7032493290/);
  });

  it("atlas storefront keeps the bundled catalog", () => {
    ctx.slug = "atlas";
    const { result } = renderHook(() => mod.useTenantListings());
    expect(result.current.listings.length).toBeGreaterThan(0);
  });
});
