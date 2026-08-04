import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SitemapPage from "./SitemapPage";
import { shouldHideAtlasBranding } from "../tenant/tenantOverrides";

vi.mock("../tenant/displayBrand", () => ({
  getTenantBrandName: () => "Atlastays",
  MARKETPLACE_BRAND_BASELINE: "Atlastays",
}));

vi.mock("../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(() => ({ slug: "atlas", isMarketplaceRoot: true })),
}));

vi.mock("../tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  shouldHideAtlasBranding: vi.fn(() => false),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to?: string }) => <a href={to ?? "#"}>{children}</a>,
  };
});

describe("SitemapPage", () => {
  it("renders a human-readable list of internal page links", () => {
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(false);
    render(<SitemapPage />);

    expect(screen.getByRole("heading", { name: /^Sitemap$/i })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    expect(screen.getByRole("link", { name: /Homestays in Hyderabad/i })).toHaveAttribute(
      "href",
      "/homestays-in-hyderabad",
    );

    const allLinks = screen.getAllByRole("link");
    expect(allLinks.every((link) => !link.getAttribute("href")?.endsWith(".xml"))).toBe(true);
  });

  it("omits Atlas city guides on white-label tenants (TASK-7194)", () => {
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(true);
    render(<SitemapPage />);

    expect(screen.queryByRole("link", { name: /Homestays in Hyderabad/i })).not.toBeInTheDocument();
  });
});
