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
  const io =
    MockIntersectionObserver.instances.find((i) => i.observed.length > 0) ??
    MockIntersectionObserver.instances[0];
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

  it("shows all fees included on per-night fallback when dates are incomplete (GUEST-020)", () => {
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
    expect(screen.getByText(/all fees included/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+ taxes & fees/i)).not.toBeInTheDocument();
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

describe("approved booking review shortcut (UXV-2026-10-18-04)", () => {
  it("focuses the ready booking form without submitting, then returns to dates as readiness changes", () => {
    const trigger = document.createElement("button"); trigger.id = "unit-booking-dates";
    const openDates = vi.fn(); trigger.addEventListener("click", openDates);
    const form = document.createElement("form"); form.dataset.testid = "guest-booking-form"; form.tabIndex = -1; form.dataset.canReviewBooking = "true";
    const reserve = document.createElement("button"); reserve.dataset.testid = "guest-booking-submit"; reserve.type = "submit"; form.append(reserve);
    form.scrollIntoView = vi.fn();
    const reserveClick = vi.fn(); reserve.addEventListener("click", reserveClick);
    const submit = vi.fn((event: Event) => event.preventDefault()); form.addEventListener("submit", submit);
    document.body.append(trigger, form);
    const ready = { hasCompleteDates: true, totalAmount: 10605, pricingPending: false, freeCancelUntil: null, canReviewBooking: true };
    const props = { bookable: true, nightlyFallback: 3500, nightlyIsSynthetic: false, onReserveClick: vi.fn() };
    const view = render(<PropertyMobileStickyBar {...props} summary={ready} />);
    fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
    expect(screen.getByTestId("mobile-sticky-book-now")).toHaveTextContent("Review booking");
    expect(form).toHaveFocus();
    expect(form.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(reserveClick).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(openDates).not.toHaveBeenCalled();
    // A child render can invalidate readiness before the summary effect reaches the bar.
    form.dataset.canReviewBooking = "false";
    fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
    expect(openDates).toHaveBeenCalledTimes(1);
    form.dataset.canReviewBooking = "true";
    reserve.disabled = true;
    fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
    expect(openDates).toHaveBeenCalledTimes(2);
    reserve.disabled = false;
    for (const summary of [
      { ...ready, hasCompleteDates: false, canReviewBooking: false, totalAmount: null },
      { ...ready, datesUnavailable: true, canReviewBooking: false },
      { ...ready, pricingPending: true, canReviewBooking: false },
      { ...ready, canReviewBooking: false },
    ]) {
      view.rerender(<PropertyMobileStickyBar {...props} summary={summary} />);
      expect(screen.getByTestId("mobile-sticky-book-now")).not.toHaveTextContent("Review booking");
      fireEvent.click(screen.getByTestId("mobile-sticky-book-now"));
    }
    expect(openDates).toHaveBeenCalledTimes(6);
    expect(reserveClick).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    view.unmount(); form.remove(); trigger.remove();
  });

  it("renders selected rate plan & meal badge and scrolls to widget on 'Change plan / details' when multiple rate plans exist (GUEST-022)", () => {
    const scroll = vi.fn();
    const oldScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    const form = document.createElement("form");
    form.dataset.testid = "guest-booking-form";
    form.dataset.bookingWidget = "true";
    form.tabIndex = -1;
    document.body.append(form);

    render(
      <PropertyMobileStickyBar
        bookable
        nightlyFallback={4500}
        nightlyIsSynthetic={false}
        summary={{
          hasCompleteDates: true,
          totalAmount: 11200,
          pricingPending: false,
          freeCancelUntil: "10 Nov",
          canReviewBooking: true,
          ratePlanLabel: "Breakfast Flexible",
          mealPlanCode: "CP",
          mealPlanLabel: "Breakfast included",
          hasMultipleRatePlans: true,
        }}
        onReserveClick={() => {}}
      />,
    );

    expect(screen.getByTestId("mobile-sticky-rate-plan")).toHaveTextContent(
      "Breakfast Flexible · Breakfast included",
    );
    const changePlanBtn = screen.getByTestId("mobile-sticky-change-plan");
    expect(changePlanBtn).toHaveTextContent("Change plan / details");
    fireEvent.click(changePlanBtn);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(form).toHaveFocus();

    form.remove();
    HTMLElement.prototype.scrollIntoView = oldScroll;
  });
});
