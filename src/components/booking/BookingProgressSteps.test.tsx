/**
 * TASK-102109 — BookingProgressSteps: active/completed/upcoming states and
 * click-back on completed steps.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { BookingProgressSteps } from "./BookingProgressSteps";

describe("BookingProgressSteps (TASK-102109)", () => {
  it("marks the current step with aria-current and lists all four stages", () => {
    render(<BookingProgressSteps currentStep={3} />);

    expect(screen.getByTestId("booking-progress-steps")).toBeInTheDocument();
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByTestId(`booking-progress-step-${n}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("booking-progress-step-3")).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByTestId("booking-progress-step-3").firstChild).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByTestId("booking-progress-step-1")).toHaveAttribute(
      "data-state",
      "completed",
    );
    expect(screen.getByTestId("booking-progress-step-4")).toHaveAttribute(
      "data-state",
      "upcoming",
    );
  });

  it("completed steps are clickable buttons that fire onStepClick; upcoming steps are not", () => {
    const onStepClick = vi.fn();
    render(<BookingProgressSteps currentStep={3} onStepClick={onStepClick} />);

    fireEvent.click(screen.getByRole("button", { name: /back to step 1/i }));
    expect(onStepClick).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: /back to step 2/i }));
    expect(onStepClick).toHaveBeenCalledWith(2);

    // Upcoming step 4 is plain text, never a button.
    expect(
      screen.getByTestId("booking-progress-step-4").querySelector("button"),
    ).toBeNull();
  });

  it("renders completed steps as plain text when no onStepClick is supplied", () => {
    render(<BookingProgressSteps currentStep={2} />);

    expect(
      screen.getByTestId("booking-progress-step-1").querySelector("button"),
    ).toBeNull();
    expect(screen.getByTestId("booking-progress-step-1")).toHaveAttribute(
      "data-state",
      "completed",
    );
  });
});
