/** @vitest-environment jsdom */

/**
 * MKT-034: `/destinations` and `/explore` render the city directory, and a naked city slug (`/coorg`) redirects to its guide
 * `/homestays-in-coorg` on the marketplace surface. Both are registered BEFORE the `/:shortCode` catch-all, which used to
 * answer all of them with "link not found". Page modules are stubbed so only the routing is under test.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { settle } from "../test/settle";
import { CITY_LANDING_SLUGS } from "../content/cities/cityLandingSlugs";
import { shortLinkKeys } from "../config/shortLinks";

const surface = vi.hoisted(() => ({ marketplace: true }));

vi.mock("../tenant/tenantResolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tenant/tenantResolver")>();
  return {
    ...actual,
    isMarketplaceMode: () => surface.marketplace,
    isAtlastaysMarketplaceSurface: () => surface.marketplace,
  };
});

vi.mock("../pages/DestinationsPage", () => ({
  default: () => <div data-testid="destinations-route-probe">destinations</div>,
}));

vi.mock("../pages/AtlasOnlyCityLanding", () => ({
  default: ({ citySlug }: { citySlug: string }) => <div data-testid="city-guide-route-probe">{citySlug}</div>,
}));

vi.mock("../components/ShortLinkRedirect", () => ({
  default: ({ code }: { code?: string }) => <div data-testid="short-link-route-probe">{code ?? "from-url-param"}</div>,
}));

vi.mock("../pages/MarketplaceHomepage", () => ({ default: () => <div data-testid="marketplace-home-probe">home</div> }));

beforeEach(() => {
  surface.marketplace = true;
  // jsdom has no scrollTo; the app scrolls to the top on every route change.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

async function openRoute(path: string) {
  window.history.pushState({}, "", path);
  render(<App />);
  // React.lazy resolves through a real dynamic import, which a drained microtask queue does not cover.
  await import("../pages/DestinationsPage");
  await import("../pages/AtlasOnlyCityLanding");
  await import("../components/CityVanityRedirect");
  await import("../components/ShortLinkRedirect");
  await settle();
  await settle();
  // wall-clock: the first render in this file also resolves the app shell's own lazy chunks through real dynamic imports, which no mocked promise drain covers
  await waitFor(() => expect(screen.queryByTestId("lazy-route-fallback")).toBeNull(), { timeout: 10_000 });
}

describe("MKT-034: city directory routes", () => {
  it("renders the directory for /destinations", async () => {
    await openRoute("/destinations");
    expect(screen.getByTestId("destinations-route-probe")).toBeInTheDocument();
    expect(screen.queryByTestId("short-link-route-probe")).toBeNull();
  });

  it("renders the same directory for the /explore alias", async () => {
    await openRoute("/explore");
    expect(screen.getByTestId("destinations-route-probe")).toBeInTheDocument();
    expect(screen.queryByTestId("short-link-route-probe")).toBeNull();
  });
});

describe("MKT-034: naked city slugs redirect to the city guide on the marketplace surface", () => {
  it.each([...CITY_LANDING_SLUGS])("/%s -> /homestays-in-%s", async (slug) => {
    await openRoute(`/${slug}`);
    expect(window.location.pathname).toBe(`/homestays-in-${slug}`);
    expect(screen.getByTestId("city-guide-route-probe")).toHaveTextContent(slug);
    expect(screen.queryByTestId("short-link-route-probe")).toBeNull();
  });

  it("keeps the query string, so campaign attribution survives the redirect", async () => {
    await openRoute("/coorg?utm_source=insta&utm_campaign=monsoon");
    expect(window.location.pathname).toBe("/homestays-in-coorg");
    expect(window.location.search).toBe("?utm_source=insta&utm_campaign=monsoon");
  });
});

describe("MKT-034: nothing else changes", () => {
  it("off the marketplace surface, /coorg still goes to the short-link / tenant-slug resolver, handed that slug", async () => {
    surface.marketplace = false;
    await openRoute("/coorg");
    expect(window.location.pathname).toBe("/coorg");
    expect(screen.getByTestId("short-link-route-probe")).toHaveTextContent("coorg");
    expect(screen.queryByTestId("city-guide-route-probe")).toBeNull();
  });

  it("an unknown slug still falls through to the /:shortCode resolver", async () => {
    await openRoute("/some-tenant-slug");
    expect(window.location.pathname).toBe("/some-tenant-slug");
    expect(screen.getByTestId("short-link-route-probe")).toHaveTextContent("from-url-param");
  });

  it("a static short link (/101) still falls through to the /:shortCode resolver", async () => {
    await openRoute("/101");
    expect(window.location.pathname).toBe("/101");
    expect(screen.getByTestId("short-link-route-probe")).toBeInTheDocument();
  });

  it("no static short link shares a slug with a city, so the city routes can never shadow one", () => {
    const cities = new Set<string>(CITY_LANDING_SLUGS);
    expect(shortLinkKeys.filter((key) => cities.has(key.toLowerCase()))).toEqual([]);
  });
});
