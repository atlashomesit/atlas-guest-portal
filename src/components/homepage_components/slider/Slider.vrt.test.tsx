import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Slider from "./Slider";

vi.mock("react-router-dom", () => {
  return {
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
    <Slider />,
  );

describe("Slider VRT snapshots", () => {
  it("matches desktop snapshot", () => {
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    const { container } = renderSlider();
    vi.runAllTimers();
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    expect(form?.className).toMatchInlineSnapshot(
      `"w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-7 flex flex-col gap-4 sm:gap-5"`,
    );
    const primaryCtas = Array.from(form?.querySelectorAll("button") ?? []).map((btn) => btn.textContent?.trim());
    expect(primaryCtas.slice(0, 4)).toMatchInlineSnapshot(`
      [
        "Check-inEarliest available date shown.",
        "Check-outEnsure your stay ends after check-in.",
        "−guestsguests+Defaulting to 2 guests; adjust anytime.",
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
      `"w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-7 flex flex-col gap-4 sm:gap-5"`,
    );
  });

  it("matches mobile snapshot", () => {
    Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
    const { container } = renderSlider();
    vi.runAllTimers();
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
    expect(form?.className).toMatchInlineSnapshot(
      `"w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-7 flex flex-col gap-4 sm:gap-5"`,
    );
  });
});
