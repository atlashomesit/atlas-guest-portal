import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import MyDataPage from "./MyDataPage";

vi.mock("../components/SEO", () => ({ default: () => null }));
vi.mock("@/tenant/displayBrand", () => ({ getTenantBrandName: () => "Test Brand" }));
vi.mock("@/api/client", () => ({
  buildApiUrl: (path: string) => `https://api.test${path}`,
  getApiHeaders: () => ({}),
}));

const payload = {
  guest: { name: "Ada", email: "ada@example.com", phone: "+919999999999" },
  bookings: [{ id: 11, checkinDate: "2026-08-01", checkoutDate: "2026-08-03", bookingStatus: "CheckedOut" }],
  communicationLogs: [{ channel: "whatsapp", eventType: "booking.confirmed", createdAtUtc: "2026-08-01T10:00:00Z" }],
  reviews: [{ id: 7, rating: 5, title: "Great stay" }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/my-data/tok-123"]}>
      <Routes>
        <Route path="/my-data/:guestToken" element={<MyDataPage />} />
        <Route path="/privacy" element={<div>Privacy</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MyDataPage — TASK-7204 DPDP export categories", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders all four export categories, download, and erasure guidance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    renderPage();

    await waitFor(() => expect(screen.getByTestId("my-data-export")).toBeInTheDocument());
    expect(screen.getByTestId("my-data-bookings")).toHaveTextContent("Bookings (1)");
    expect(screen.getByTestId("my-data-communication-logs")).toHaveTextContent("Communication logs (1)");
    expect(screen.getByTestId("my-data-reviews")).toHaveTextContent("Reviews (1)");
    expect(screen.getByTestId("my-data-erasure")).toHaveTextContent("privacy@atlastays.com");

    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") Object.defineProperty(el, "click", { value: click });
      return el;
    });

    fireEvent.click(screen.getByTestId("my-data-download"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });
});
