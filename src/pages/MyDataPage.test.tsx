import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import MyDataPage from "./MyDataPage";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));
vi.mock("@/tenant/displayBrand", () => ({
  getTenantBrandName: () => "Test Brand",
  getTenantContactEmail: () => "privacy@example.com",
}));
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
    vi.unstubAllGlobals();
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
    await settle();

    await settle();
    expect(screen.getByTestId("my-data-export")).toBeInTheDocument();
    expect(screen.getByTestId("my-data-bookings")).toHaveTextContent("Bookings (1)");
    expect(screen.getByTestId("my-data-communication-logs")).toHaveTextContent("Communication logs (1)");
    expect(screen.getByTestId("my-data-reviews")).toHaveTextContent("Reviews (1)");
    expect(screen.getByTestId("my-data-erasure")).toHaveTextContent("privacy@example.com");

    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") Object.defineProperty(el, "click", { value: click });
      return el;
    });

    fireEvent.click(screen.getByTestId("my-data-download"));
    await settle();
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });
});

// UXD-2026-10-27-05-A: accessible fields preserve the existing correction contract.
describe("MyDataPage correction labels", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  test.each([200, 503])("named fields preserve trimmed payload and draft on HTTP %i", async (status) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify(init?.method === "POST"
        ? status === 200 ? { ticketReference: "COR-27" } : { message: "Correction unavailable" }
        : payload), { status: init?.method === "POST" ? status : 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();
    const email = screen.getByRole("textbox", { name: "Your email", exact: true });
    const details = screen.getByRole("textbox", { name: "Correction details", exact: true });
    expect(screen.getByLabelText("Your email")).toBe(email);
    expect(screen.getByLabelText("Correction details")).toBe(details);
    fireEvent.change(email, { target: { value: "  ada@example.test  " } });
    await settle();
    fireEvent.change(details, { target: { value: "  Correct my surname.  " } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Submit correction request" }));
    await settle();
    if (status === 200) expect(screen.getByText("Ticket reference: COR-27")).toBeInTheDocument();
    else expect(screen.getByRole("alert")).toHaveTextContent("Correction unavailable");
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(String(writes[0][0])).toBe("https://api.test/api/public/guest-data/tok-123/correction");
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ submitterEmail: "ada@example.test", correctionText: "Correct my surname." });
    expect(email).toHaveValue("  ada@example.test  ");
    expect(details).toHaveValue("  Correct my surname.  ");
    expect(screen.getByTestId("my-data-download")).toBeEnabled();
    expect(screen.getByTestId("my-data-erasure")).toHaveTextContent("privacy@example.com");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
