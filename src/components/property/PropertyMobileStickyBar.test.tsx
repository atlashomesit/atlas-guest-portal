import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PropertyMobileStickyBar,
  tryOpenPropertyDateSheet,
} from "@/components/property/PropertyMobileStickyBar";

type FakeEntry = { isIntersecting: boolean; boundingClientRect: { top: number } };

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: (entries: FakeEntry[]) => void;
  observed: Element[] = [];

  constructor(callback: (entries: FakeEntry[]) => void) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.push(el);
  }

  unobserve(): void {}
  disconnect(): void {}

  trigger(entries: FakeEntry[]): void {
    this.callback(entries);
  }
}

function lastObserver(): MockIntersectionObserver {
  const io = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
  if (!io) throw new Error("expected an IntersectionObserver to be created");
  return io;
}

function renderBar(onReserveClick: () => void = () => {}) {
  return render(
    <PropertyMobileStickyBar
      bookable
      nightlyFallback={5000}
      nightlyIsSynthetic={false}
      summary={null}
      onReserveClick={onReserveClick}
    />,
  );
}

describe("PropertyMobileStickyBar", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("shows all fees included on live total without free-cancel deadline (TASK-7790)", () => {
    render(
      <PropertyMobileStickyBar
        bookable
        nightlyFallback={5000}
        nightlyIsSynthetic={false}
        summary={{
          hasCompleteDates: true,
          totalAmount: 12500,
          pricingPending: false,
          freeCancelUntil: null,
        }}
        onReserveClick={() => {}}
      />,
    );

    expect(screen.getByTestId("mobile-sticky-total")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-sticky-fees-included")).toHaveTextContent("all fees included");
    expect(screen.queryByText(/\+ taxes & fees/i)).not.toBeInTheDocument();
  });

  it("keeps + taxes & fees on per-night fallback when dates are incomplete", () => {
    render(
      <PropertyMobileStickyBar
        bookable
        nightlyFallback={5000}
        nightlyIsSynthetic={false}
        summary={null}
        onReserveClick={() => {}}
      />,
    );

    expect(screen.queryByTestId("mobile-sticky-total")).not.toBeInTheDocument();
    expect(screen.getByText(/\/ night/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ taxes & fees/i)).toBeInTheDocument();
    expect(screen.queryByText(/all fees included/i)).not.toBeInTheDocument();
  });

  it("stays hidden near the top, appears after scrolling past the hero, hides again on top (TASK-102075)", () => {
    render(
      <>
        <div data-testid="property-photo-gallery">hero</div>
        <PropertyMobileStickyBar
          bookable
          nightlyFallback={5000}
          nightlyIsSynthetic={false}
          summary={null}
          onReserveClick={() => {}}
        />
      </>,
    );

    const bar = screen.getByTestId("mobile-reserve-bar");
    // Hero visible at first paint -> bar hidden.
    expect(bar).toHaveAttribute("data-visible", "false");
    // The hero gallery card is what gets observed.
    expect(lastObserver().observed[0].getAttribute("data-testid")).toBe("property-photo-gallery");

    // Scrolled past the hero -> bar appears smoothly.
    act(() => {
      lastObserver().trigger([{ isIntersecting: false, boundingClientRect: { top: -320 } }]);
    });
    expect(bar).toHaveAttribute("data-visible", "true");

    // Back near the top -> bar hides again.
    act(() => {
      lastObserver().trigger([{ isIntersecting: true, boundingClientRect: { top: 0 } }]);
    });
    expect(bar).toHaveAttribute("data-visible", "false");
  });

  it("does not reveal the bar for a booking form sitting below the fold (TASK-102075)", () => {
    render(
      <>
        <div data-testid="guest-booking-form">booking card</div>
        <PropertyMobileStickyBar
          bookable
          nightlyFallback={5000}
          nightlyIsSynthetic={false}
          summary={null}
          onReserveClick={() => {}}
        />
      </>,
    );

    const bar = screen.getByTestId("mobile-reserve-bar");
    // Form below the viewport on first paint (top > 0, not intersecting) -> still hidden.
    act(() => {
      lastObserver().trigger([{ isIntersecting: false, boundingClientRect: { top: 900 } }]);
    });
    expect(bar).toHaveAttribute("data-visible", "false");
  });

  it("opens the existing date-picker sheet on Reserve instead of scrolling (TASK-102075)", () => {
    const onReserveClick = vi.fn();
    const trigger = document.createElement("button");
    trigger.id = "unit-booking-dates";
    const triggerClick = vi.fn();
    trigger.addEventListener("click", triggerClick);
    document.body.appendChild(trigger);

    try {
      expect(tryOpenPropertyDateSheet()).toBe(true);
      expect(triggerClick).toHaveBeenCalledTimes(1);

      renderBar(onReserveClick);
      fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
      expect(triggerClick).toHaveBeenCalledTimes(2);
      // Sheet opened -> no scroll fallback.
      expect(onReserveClick).not.toHaveBeenCalled();
    } finally {
      trigger.remove();
    }
  });

  it("falls back to scrolling to the form when no sheet trigger exists (TASK-102075)", () => {
    expect(document.querySelector("#unit-booking-dates")).toBeNull();
    const onReserveClick = vi.fn();
    renderBar(onReserveClick);
    fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
    expect(onReserveClick).toHaveBeenCalledTimes(1);
  });
});
