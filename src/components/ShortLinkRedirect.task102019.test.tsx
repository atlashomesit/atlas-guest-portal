import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ShortLinkRedirect from "./ShortLinkRedirect";

vi.mock("../tenant/displayBrand", () => ({
  getTenantBrandName: () => "Atlas",
}));

describe("TASK-102019: ShortLinkRedirect tenant slug resolution", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves static short link code without network lookup", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    render(
      <MemoryRouter initialEntries={["/501"]}>
        <Routes>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Taking you to Atlas Room 501/i)).toBeInTheDocument();
    expect(screen.getByText("/property_details/atlas-homes-room-501?tenant=atlas")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves tenant slug to listing storefront when public listings exist", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/public/listings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                id: 637,
                propertyName: "QA Bot Homestay",
                name: "Standard Room",
              },
            ]),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <MemoryRouter initialEntries={["/qa-bot-c59de6"]}>
        <Routes>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Taking you to Atlas/i)).toBeInTheDocument();
    expect(
      await screen.findByText("/homes/qa-bot-homestay/637?tenant=qa-bot-c59de6")
    ).toBeInTheDocument();
    expect(screen.queryByText("Link not found")).not.toBeInTheDocument();
  });

  it("resolves tenant slug to tenant home when tenant exists with no listings", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/public/listings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      }
      if (urlStr.includes("/tenants/public/fresh-host")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 99, slug: "fresh-host", name: "Fresh Host" }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <MemoryRouter initialEntries={["/fresh-host"]}>
        <Routes>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("/?tenant=fresh-host")).toBeInTheDocument();
    expect(screen.queryByText("Link not found")).not.toBeInTheDocument();
  });

  it("renders Link not found when slug is neither a short link nor an active tenant", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404 })
    );

    render(
      <MemoryRouter initialEntries={["/nonexistent-slug"]}>
        <Routes>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Link not found")).toBeInTheDocument();
  });
});
