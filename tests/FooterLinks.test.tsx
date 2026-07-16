import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Footer from "@/components/commonComponents/footer/Footer";

describe("Footer links", () => {
  it("exposes the human sitemap page via an internal link", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const sitemap = screen.getByRole("link", { name: /sitemap/i });
    expect(sitemap).toHaveAttribute("href", "/sitemap");
  });
});
