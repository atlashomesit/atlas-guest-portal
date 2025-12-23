import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

import Navbar from "./Navbar";
import { trackEvent } from "../../../utils/analytics";

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );

describe("Navbar CTA", () => {
  it("routes Book Now to the on-site Our Homes anchor", () => {
    renderNavbar();

    const bookNow = screen.getByRole("link", { name: /book now/i });
    expect(bookNow).toHaveAttribute("href", "/#our-homes");
  });

  it("emits a tracking event when Book Now is clicked", () => {
    renderNavbar();

    const bookNow = screen.getByRole("link", { name: /book now/i });
    bookNow.click();

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      { source: "header" },
      { route: "/#our-homes" },
    );
  });

  it("keeps WhatsApp as the secondary help link", () => {
    renderNavbar();

    const helpLink = screen.getByRole("link", { name: /need help/i });
    expect(helpLink).toHaveAttribute("href");
    expect(helpLink.getAttribute("href")).toContain("wa.me");
  });
});
