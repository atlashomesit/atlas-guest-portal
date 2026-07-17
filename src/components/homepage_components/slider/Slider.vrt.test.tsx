import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BookingProvider } from "../../../contexts/BookingContext";
import Slider from "./Slider";

vi.mock("react-router-dom", () => {
  return {
    useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "default" }),
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock("react-date-range", () => ({
  DateRange: ({ months }: { months: number }) => <div data-testid="date-range-mock">Months: {months}</div>,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-12-22T00:00:00.000Z"));
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

const renderSlider = () =>
  render(
    <BookingProvider>
      <Slider />
    </BookingProvider>,
  );

describe("Slider VRT snapshots", () => {
  it("matches desktop snapshot", () => {
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    const { container } = renderSlider();
    vi.runAllTimers();
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    expect(form?.className).toMatchInlineSnapshot(
      `"hero-form w-full rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-level-2)] border border-[var(--border-subtle)] p-4 flex flex-col gap-3"`,
    );
    const primaryCtas = Array.from(form?.querySelectorAll("button") ?? []).map((btn) => btn.textContent?.trim());
    expect(primaryCtas.slice(0, 4)).toMatchInlineSnapshot(`
      [
        "Check-in22 Dec 2025",
        "Check-out23 Dec 20251 night",
        "Guests1 guest",
        "Check availability",
      ]
    `);
  });

  it("matches tablet snapshot", () => {
    Object.defineProperty(window, "innerWidth", { value: 992, writable: true });
    const { container } = renderSlider();
    vi.runAllTimers();
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    expect(form?.className).toMatchInlineSnapshot(
      `"hero-form w-full rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-level-2)] border border-[var(--border-subtle)] p-4 flex flex-col gap-3"`,
    );
  });

  it("matches mobile snapshot", () => {
    Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
    const { container } = renderSlider();
    vi.runAllTimers();
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    expect(form?.className).toMatchInlineSnapshot(
      `"hero-form w-full rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-level-2)] border border-[var(--border-subtle)] p-4 flex flex-col gap-3"`,
    );
  });
});
