import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTenantBrandName } from "./displayBrand";
import { applyTenantBranding } from "./tenantBranding";
import type { TenantInfo } from "./tenantContext";

vi.mock("./tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("./tenantOverrides", () => ({
  getTenantOverrides: () => ({}),
}));

import { getTenantContext } from "./tenantContext";

const millionaireTenant = {
  slug: "millionairesmansion",
  name: "",
  brandName: "mahesh wagh",
  brandNameLong: "",
  guestCommsBrandingMode: "Neutral",
  legalContactPack: {
    displayName: "Millionaresmansion",
    legalName: "Millionaresmansion",
    showAtlasFooterCredit: false,
    isCustomDomain: false,
  },
} as TenantInfo;

describe("TASK-7431 brand slots", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue(millionaireTenant as ReturnType<typeof getTenantContext>);
    document.title = "";
    document.head.querySelectorAll('meta[name="apple-mobile-web-app-title"]').forEach((n) => n.remove());
  });

  it("resolves business name for header/title/services/host-note slots", () => {
    expect(getTenantBrandName()).toBe("Millionaresmansion");

    applyTenantBranding(millionaireTenant);
    expect(document.title).toBe("Millionaresmansion");

    // Minimal stand-ins for the four guest-facing slots that must share the helper.
    render(
      <MemoryRouter>
        <header data-testid="header-brand">{getTenantBrandName()}</header>
        <h1 data-testid="hero-brand">{getTenantBrandName()}</h1>
        <p data-testid="host-note">— The {getTenantBrandName()} host team</p>
        <p data-testid="services">the finest hospitality with {getTenantBrandName()}&apos;s curated services</p>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("header-brand")).toHaveTextContent("Millionaresmansion");
    expect(screen.getByTestId("hero-brand")).toHaveTextContent("Millionaresmansion");
    expect(screen.getByTestId("host-note")).toHaveTextContent("Millionaresmansion");
    expect(screen.getByTestId("services")).toHaveTextContent("Millionaresmansion");
    expect(document.body.textContent).not.toMatch(/mahesh wagh/i);
  });
});
