import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PropertyMobileStickyBar } from "@/components/property/PropertyMobileStickyBar";

describe("PropertyMobileStickyBar", () => {
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
});
