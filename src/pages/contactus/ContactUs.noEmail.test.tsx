/**
 * G2 journeys 19 + 26: a host who has not saved a contact e-mail used to get a dead "Email us" button (href "mailto:", the name
 * "Email <brand> at "), an empty "Reach us at" link and an empty Email block on the Contact page: axe `link-name` (serious), and a guest who
 * taps it gets a mail app with no address. The e-mail rows now show only when there is an address. The WhatsApp, Call, FAQs and Book now
 * links also start their accessible name with the words on screen (axe `label-content-name-mismatch`).
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const contact = vi.hoisted(() => ({ email: "" as string }));
vi.mock("../../config/contact", () => ({
  formatDisplayNumber: () => "+91-9876543210",
  getContactEmail: () => contact.email,
  getTelLink: () => "tel:+919876543210",
  getWhatsAppLink: () => "https://wa.me/919876543210",
}));
vi.mock("../../hooks/useTenantListings", () => ({ useTenantListings: () => ({ properties: [] }) }));
vi.mock("../../tenant/displayBrand", () => ({ getTenantBrandName: () => "Sea Breeze" }));

import ContactUs from "./ContactUs";

const strip = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

function renderPage() {
  return render(
    <MemoryRouter>
      <ContactUs />
    </MemoryRouter>,
  );
}

describe("ContactUs without a saved e-mail address", () => {
  it("shows no e-mail link, no Email us button and no empty Email block", () => {
    contact.email = "";
    const { container } = renderPage();
    expect(container.querySelectorAll('a[href^="mailto:"]').length).toBe(0);
    expect(screen.queryByText("Email us")).not.toBeInTheDocument();
    expect(screen.queryByText(/Prefer email/i)).not.toBeInTheDocument();
  });

  it("still shows the e-mail rows when the host has an address", () => {
    contact.email = "stay@seabreeze.example";
    const { container } = renderPage();
    const links = Array.from(container.querySelectorAll('a[href="mailto:stay@seabreeze.example"]'));
    expect(links.length).toBe(3);
    for (const a of links) expect(a.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("starts the accessible name of each labelled link with its visible words (WCAG 2.5.3)", () => {
    contact.email = "stay@seabreeze.example";
    const { container } = renderPage();
    const labelled = Array.from(container.querySelectorAll("a[aria-label]")) as HTMLAnchorElement[];
    expect(labelled.length).toBeGreaterThanOrEqual(4);
    for (const a of labelled) {
      const name = strip(a.getAttribute("aria-label") ?? "");
      const visible = strip(a.textContent ?? "");
      expect(name.includes(visible), `"${a.getAttribute("aria-label")}" must contain "${a.textContent}"`).toBe(true);
    }
  });
});
