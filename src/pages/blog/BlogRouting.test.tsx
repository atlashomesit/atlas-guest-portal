import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BlogCategory from "./BlogCategory";
import BlogPostPage from "./BlogPostPage";

// Mirror the App.tsx blog route shape so the test exercises the real dispatch.
function renderBlogAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
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
