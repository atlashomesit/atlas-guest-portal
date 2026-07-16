import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SitemapPage from "./SitemapPage";

vi.mock("../tenant/displayBrand", () => ({
  getTenantBrandName: () => "Atlastays",
  MARKETPLACE_BRAND_BASELINE: "Atlastays",
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
    render(<SitemapPage />);

    expect(screen.getByRole("heading", { name: /^Sitemap$/i })).toBeInTheDocument();

    // Core static pages
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    // City landing pages
    expect(screen.getByRole("link", { name: /Homestays in Hyderabad/i })).toHaveAttribute(
      "href",
      "/homestays-in-hyderabad"
    );

    // Must link to the human page, not the raw XML crawler sitemap.
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.every((link) => !link.getAttribute("href")?.endsWith(".xml"))).toBe(true);
  });
});
