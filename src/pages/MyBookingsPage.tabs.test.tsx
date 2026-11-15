import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthContext } from "../contexts/GuestAuthContext";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

const bookings = [
  { id: 991, bookingRef: "SYN-BK-991", propertyName: "Synthetic House", listingName: "Upcoming suite", checkinDate: "2099-01-01", checkoutDate: "2099-01-03", status: "CheckedIn", totalAmount: 12000, token: "synthetic/a+b", hasUnreadMessages: true },
  { id: 992, bookingRef: "SYN-BK-992", propertyName: "Synthetic House", listingName: "Past suite", checkinDate: "2024-01-01", checkoutDate: "2024-01-03", status: "CheckedOut", totalAmount: 8500, token: "synthetic-past", listingId: 89, hasUnreadMessages: false },
];

async function mount(signedIn = true, data = bookings) {
  vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
  const auth = signedIn
    ? { isAuthenticated: true, token: "synthetic-jwt", email: "synthetic@example.com", guestId: 3001 }
    : { isAuthenticated: false, token: null, email: null, guestId: null };
  render(<MemoryRouter initialEntries={["/bookings?guestId=3001&t=synthetic-magic"]}>
    <GuestAuthContext.Provider value={{ auth, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <MyBookingsPage />
    </GuestAuthContext.Provider>
  </MemoryRouter>);
  await settle();
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("B01 My Bookings accessible local filters", () => {
  test.each([true, false])("automatic keys keep focus, selected state and panel name synchronized (signed in: %s)", async (signedIn) => {
    await mount(signedIn);
    const tabs = screen.getAllByRole("tab");
    const panel = screen.getByRole("tabpanel", { name: "Upcoming" });
    const panelId = panel.id;
    const ids = tabs.map((t) => t.id);
    const selectWithKey = (from: number, key: string, to: number) => {
      tabs[from].focus();
      expect(fireEvent.keyDown(tabs[from], { key })).toBe(false);
      expect(tabs[to]).toHaveFocus();
      expect(tabs.map((t) => t.tabIndex)).toEqual(tabs.map((_, i) => i === to ? 0 : -1));
      tabs.forEach((t, i) => expect(t).toHaveAttribute("aria-selected", String(i === to)));
      expect(screen.getByRole("tabpanel", { name: tabs[to].textContent! })).toHaveAttribute("id", panelId);
      expect(panel).toHaveAttribute("aria-labelledby", ids[to]);
    };
    tabs.forEach((t) => expect(t).toHaveAttribute("aria-controls", panelId));
    expect(panel).toHaveAttribute("tabindex", "0");
    for (let cycle = 0; cycle < 2; cycle++) {
      selectWithKey(0, "ArrowLeft", 2);
      expect(within(panel).getByText("No cancelled bookings")).toBeInTheDocument();
      selectWithKey(2, "ArrowRight", 0);
      expect(within(panel).getByText("Upcoming suite")).toBeInTheDocument();
      selectWithKey(0, "ArrowRight", 1);
      expect(within(panel).getByText("Past suite")).toBeInTheDocument();
      expect(within(panel).getByRole("link", { name: /Rate your stay/ })).toHaveAttribute("href", "/review/992?t=synthetic-past");
      expect(within(panel).getByRole("link", { name: /Book this home again/ })).toBeInTheDocument();
      selectWithKey(1, "End", 2);
      selectWithKey(2, "Home", 0);
    }
    fireEvent.click(tabs[1]);
    expect(screen.getByRole("tabpanel", { name: "Past" })).toBeInTheDocument();
    fireEvent.click(tabs[0]);
    const bookingLink = within(panel).getByRole("link", { name: /Upcoming suite/ });
    bookingLink.focus();
    expect(fireEvent.keyDown(bookingLink, { key: "ArrowRight" })).toBe(true);
    expect(bookingLink).toHaveFocus();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(fireEvent.keyDown(tabs[0], { key: "ArrowDown" })).toBe(true);
    expect(screen.getByTestId("my-bookings-in-stay-hint")).toBeInTheDocument();
    expect(screen.getByTestId("my-bookings-update-profile")).toHaveAttribute("href", "/profile?bookingId=991&t=synthetic%2Fa%2Bb");
    expect(screen.getByTestId("my-bookings-manage-preferences")).toHaveAttribute("href", "/preferences/synthetic%2Fa%2Bb");
  });

  test("unread meaning augments the complete booking name once and stays absent on unflagged cards", async () => {
    await mount();
    const link = screen.getByRole("link", { name: /Upcoming suite Unread messages Synthetic House/ });
    expect(within(link).getAllByText("Unread messages")).toHaveLength(1);
    expect(link).toHaveAccessibleName(/2099-01-01.*2099-01-03.*SYN-BK-991.*12,000/);
    expect(link).toHaveAttribute("href", "/booking/991?t=synthetic%2Fa%2Bb");
    expect(screen.getByTestId("my-bookings-unread-dot")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("my-bookings-unread-dot")).toHaveClass("w-2", "h-2", "bg-blue-500");
    expect(link.querySelectorAll("a,button,[tabindex]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("tab", { name: "Past" }));
    expect(screen.queryByText("Unread messages")).not.toBeInTheDocument();
    expect(screen.queryByTestId("my-bookings-unread-dot")).not.toBeInTheDocument();
  });

  test("all-results empty retains its existing action without an orphan tab panel", async () => {
    await mount(false, []);
    expect(screen.getByTestId("my-bookings-empty-state")).toHaveTextContent("No bookings yet");
    expect(screen.getByRole("link", { name: "Browse our homes" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });
});
