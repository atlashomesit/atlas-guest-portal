import React from "react";
import { addDays, format } from "date-fns";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("react-router-dom", () => {
  const searchParams = new URLSearchParams();

  return {
    __esModule: true,
    Link: ({ to, children, ...props }: { to: string | { pathname?: string }; children: React.ReactNode }) => (
      <a href={typeof to === "string" ? to : to?.pathname ?? "/"} {...props}>
        {children}
      </a>
    ),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => <div data-router>{children}</div>,
    useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "default" }),
    useNavigate: () => navigateMock,
    useSearchParams: () => [searchParams, vi.fn()],
  };
});

vi.mock("react-date-range", () => ({
  DateRange: ({
    onChange,
    ranges,
    disabledDay,
  }: {
    onChange: (payload: unknown) => void;
    ranges?: Array<{ startDate: Date; endDate: Date }>;
    disabledDay?: (date: Date) => boolean;
  }) => {
    const base = ranges?.[0]?.startDate ?? new Date();
    const next = ranges?.[0]?.endDate ?? addDays(base, 1);
    const days = [addDays(base, -1), base, next, addDays(base, 3), addDays(base, 4)];

    return (
      <div role="grid">
        {days.map((day) => {
          const isDisabled = disabledDay?.(day) ?? false;

          return (
            <button
              key={format(day, "yyyy-MM-dd")}
              data-testid={`hero-date-${format(day, "yyyy-MM-dd")}`}
              type="button"
              aria-disabled={isDisabled}
              disabled={isDisabled}
              className={isDisabled ? "disabled-day" : ""}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (isDisabled) return;

                const useSameDay = event.shiftKey;

                onChange({
                  selection: { startDate: day, endDate: useSameDay ? day : addDays(day, 1) },
                });
              }}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    );
  },
}));
vi.mock("../../../contexts/BookingContext", () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    updateBooking: vi.fn(),
    setProperty: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
    setPendingScrollTarget: vi.fn(),
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import Slider from "./Slider";
import * as analytics from "../../../utils/analytics";
import { BookingProvider } from "../../../contexts/BookingContext";
import { getTenantContext } from "../../../tenant/tenantContext";

vi.mock("../../../tenant/tenantContext", async () => {
  const actual = await vi.importActual<typeof import("../../../tenant/tenantContext")>(
    "../../../tenant/tenantContext",
  );
  return {
    ...actual,
    getTenantContext: vi.fn(() => ({
      name: "Atlas Homestays",
      slug: "atlas",
      isMarketplaceRoot: true,
    })),
  };
});

const renderSlider = () =>
  render(
    <MemoryRouter>
      <BookingProvider>
        <Slider />
      </BookingProvider>
    </MemoryRouter>,
  );

const _renderSliderAtWidth = (width: number) => {
  const viewportSpy = vi.spyOn(window, "innerWidth", "get");
  viewportSpy.mockReturnValue(width);
  const utils = renderSlider();
  return { ...utils, viewportSpy };
};

describe("Slider hero search", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getTenantContext).mockReturnValue({
      name: "Atlas Homestays",
      slug: "atlas",
      isMarketplaceRoot: true,
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-12-22T00:00:00.000Z"));
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    analytics.resetAnalyticsTransport();
    vi.runAllTimers();
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
  });

  it("renders hero overlay and trust microcopy", () => {
    renderSlider();
    const overlay = screen.getByTestId("hero-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.backgroundImage).toMatch(/linear-gradient|linear-gradient-overlay/i);
    expect(screen.getByRole("heading", { name: /Thoughtfully curated stays/i })).toBeInTheDocument();
    expect(screen.getByText(/Verified homes/i)).toBeInTheDocument();
  });

  it("shows Check availability CTA button (Browse all apartments link removed — Home v2 Gap 3)", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
    // "Browse all apartments" link removed per Home v2 Gap 3 — duplicate of trust strip
    expect(screen.queryByRole("link", { name: /browse all apartments/i })).toBeNull();
  });

  it("blocks past dates from being selected", () => {
    renderSlider();
    fireEvent.click(screen.getAllByTestId("hero-date-toggle")[0]);

    const yesterdayTestId = `hero-date-${format(addDays(new Date(), -1), "yyyy-MM-dd")}`;
    const pastDateButton = screen.getByTestId(yesterdayTestId) as HTMLButtonElement;

    expect(pastDateButton).toBeDisabled();
    fireEvent.click(pastDateButton);

    expect(screen.getByRole("status")).toHaveTextContent(/hero form ready/i);
  });

  it("shows the inline trust strip without inventing free-cancellation hour counts (TASK-7201)", () => {
    renderSlider();
    // Home v2: trust badges section replaced with inline strip inside the hero.
    // TASK-7201: hero has no listing context — link to /policies instead of 48h/24h claims.
    const trustStrip = screen.getByRole("list", { name: /booking guarantees/i });
    expect(trustStrip).toBeInTheDocument();
    expect(within(trustStrip).getByText(/instant confirmation/i)).toBeInTheDocument();
    expect(within(trustStrip).getByText(/verified homes/i)).toBeInTheDocument();
    expect(within(trustStrip).getByRole("link", { name: /see cancellation policy/i })).toHaveAttribute(
      "href",
      "/policies",
    );
    expect(within(trustStrip).queryByText(/free cancellation/i)).toBeNull();
    expect(within(trustStrip).queryByText(/48h|24h/i)).toBeNull();
  });

  it("does not hardcode Hyderabad/KPHB copy on white-label tenants (TASK-7194)", () => {
    vi.mocked(getTenantContext).mockReturnValue({
      name: "Stay by City Focus",
      slug: "staybycf",
      isMarketplaceRoot: false,
    });
    renderSlider();
    expect(screen.queryByText(/Hyderabad/i)).toBeNull();
    expect(screen.queryByText(/KPHB/i)).toBeNull();
    expect(screen.getByRole("heading", { name: /Thoughtfully curated stays/i })).toBeInTheDocument();
  });

  describe("TASK-4911: Check availability CTA surfaces inline validation instead of silently no-op-ing", () => {
    it("clicking Check availability after check-out is cleared shows an inline message and does not navigate", () => {
      renderSlider();
      fireEvent.click(screen.getAllByTestId("hero-date-toggle")[0]);

      // Default dates are today/tomorrow (both filled). Clicking a NEW future day while a full
      // range is already selected starts a fresh check-in selection and clears check-out
      // (AtlasDateRangePicker's RANGE_SELECTED → CHECK_IN_SELECTED transition) — reproducing the
      // "check-out left empty" repro state without needing a two-click calendar interaction.
      const futureDateTestId = `hero-date-${format(addDays(new Date(), 3), "yyyy-MM-dd")}`;
      fireEvent.click(screen.getByTestId(futureDateTestId));

      const submit = screen.getAllByTestId("hero-search-submit")[0];
      // TASK-4911: must stay clickable — an html-disabled button is the original silent no-op bug.
      expect(submit).toBeEnabled();

      fireEvent.click(submit);

      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((el) => /add a check-out date to continue/i.test(el.textContent ?? ""))).toBe(true);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("focuses the check-out field when Check availability is clicked with check-out missing", () => {
      renderSlider();
      fireEvent.click(screen.getAllByTestId("hero-date-toggle")[0]);

      const futureDateTestId = `hero-date-${format(addDays(new Date(), 3), "yyyy-MM-dd")}`;
      fireEvent.click(screen.getByTestId(futureDateTestId));

      const submit = screen.getAllByTestId("hero-search-submit")[0];
      fireEvent.click(submit);

      const checkoutToggle = screen.getAllByTestId("hero-date-toggle-checkout")[0];
      expect(document.activeElement).toBe(checkoutToggle);
    });
  });
});
