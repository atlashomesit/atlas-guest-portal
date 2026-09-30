import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BlogCategory from "./BlogCategory";
import BlogPostPage from "./BlogPostPage";
import BlogHome from "./BlogHome";
import { _setTenantContextForTests } from "../../tenant/tenantContext";

// Mirror the App.tsx blog route shape so the test exercises the real dispatch.
function renderBlogAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog" element={<BlogHome />} />
        <Route path="/blog/:category" element={<BlogCategory />} />
        <Route path="/blog/:category/:slug" element={<BlogPostPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("blog routing (TASK-4307)", () => {
  it("renders the full article body at the canonical /blog/<slug> (not a category list)", () => {
    renderBlogAt("/blog/essential-guest-guide");

    // Article body content — present only on the post detail, not the listing (which shows excerpts).
    expect(
      screen.getByText(/Explore the neighborhood, check in smoothly/i),
    ).toBeInTheDocument();
    // The article heading is the post title, distinct from the category-listing heading.
    expect(
      screen.getByRole("heading", { name: /Essential Guest Guide/i }),
    ).toBeInTheDocument();
  });

  it("still renders the category listing for a real category segment", () => {
    renderBlogAt("/blog/hospitality-tech");

    expect(
      screen.getByRole("heading", { name: /^Hospitality Tech & AI$/i }),
    ).toBeInTheDocument();
  });
});

describe("GUEST-007 shared blog image isolation", () => {
  beforeEach(() => {
    _setTenantContextForTests({
      slug: "garden-stays", name: "Garden Stays", brandName: "Garden Stays",
      guestCommsBrandingMode: "Neutral",
      legalContactPack: { displayName: "Garden Stays", showAtlasFooterCredit: false, isCustomDomain: true },
    });
  });

  it.each([
    ["/blog", "Blog"],
    ["/blog/guest-guides", "Guest Guides"],
    ["/blog/hospitality-tech", "Hospitality Tech & AI"],
    ["/blog/essential-guest-guide", "Essential Guest Guide to Garden Stays"],
    ["/blog/guest-guides/essential-guest-guide", "Essential Guest Guide to Garden Stays"],
  ])("renders %s without another property's photo or preview metadata", (path, heading) => {
    const { container } = renderBlogAt(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:image"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
    expect(document.querySelector('script[data-seo-json-ld]')?.textContent ?? "").not.toContain("listing-images/");
    expect(container.textContent).toContain("Garden Stays");
  });
});
