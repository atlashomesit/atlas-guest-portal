import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

function _lastObserver(): MockIntersectionObserver {
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

  it("is visible from the first view with price and next step (TOP10-2026-10-27-01-C)", () => {
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
    expect(screen.getByTestId("mobile-reserve-bar")).toHaveAttribute("data-visible", "true");
    expect(screen.getByTestId("mobile-sticky-book-now")).toHaveAttribute("tabindex", "0");
  });

  it("shows the stay dates under the total (TOP10-2026-10-27-01-C)", () => {
    render(
      <PropertyMobileStickyBar
        bookable
        nightlyFallback={5000}
        nightlyIsSynthetic={false}
        summary={{
          hasCompleteDates: true,
          totalAmount: 9332,
          pricingPending: false,
          freeCancelUntil: null,
          stayLabel: "14–16 Nov · 2 guests",
        }}
        onReserveClick={() => {}}
      />,
    );
    expect(screen.getByTestId("mobile-sticky-stay")).toHaveTextContent("14–16 Nov · 2 guests");
  });

  it("merges chat into one button that opens the support drawer and hides floaters (TOP10-2026-10-27-01-D)", () => {
    const opened = vi.fn();
    window.addEventListener("atlas:open-support", opened);
    const { unmount } = renderBar();
    expect(document.body).toHaveAttribute("data-pp-sticky-chat", "true");
    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener("atlas:open-support", opened);
    unmount();
    expect(document.body).not.toHaveAttribute("data-pp-sticky-chat");
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
