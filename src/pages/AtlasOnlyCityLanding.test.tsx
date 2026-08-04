import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";

import AtlasOnlyCityLanding from "./AtlasOnlyCityLanding";

vi.mock("./CityLandingPage", () => ({
  default: ({ citySlug }: { citySlug: string }) => <div data-testid="city-landing">{citySlug}</div>,
}));

vi.mock("@/tenant/tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  shouldHideAtlasBranding: vi.fn(),
}));

import { getTenantContext } from "@/tenant/tenantContext";
import { shouldHideAtlasBranding } from "@/tenant/tenantOverrides";

describe("AtlasOnlyCityLanding (TASK-7194)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects white-label tenants away from Atlas SEO city guides", () => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "staybycf", name: "Stay by CF" });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(true);

    const { container } = render(
      <MemoryRouter initialEntries={["/homestays-in-hyderabad"]}>
        <AtlasOnlyCityLanding citySlug="hyderabad" />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-testid="city-landing"]')).toBeNull();
  });

  it("renders city landing for atlas marketplace surfaces", () => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "atlas", name: "Atlas Homes", isMarketplaceRoot: true });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(false);

    const { getByTestId } = render(
      <MemoryRouter>
        <AtlasOnlyCityLanding citySlug="hyderabad" />
      </MemoryRouter>,
    );

    expect(getByTestId("city-landing")).toHaveTextContent("hyderabad");
  });
});
