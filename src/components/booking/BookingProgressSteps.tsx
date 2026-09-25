/**
 * TASK-102109 — numbered step progress indicator for the direct booking funnel.
 *
 * Steps: 1. Dates & Guests -> 2. Guest Info -> 3. Review -> 4. Payment.
 * The active step carries `aria-current="step"`; completed steps render as
 * buttons (when `onStepClick` is supplied) so guests can jump back to edit;
 * upcoming steps are plain text and never interactive.
 */
import React from "react";

export const BOOKING_STEPS = ["Dates & Guests", "Guest Info", "Review", "Payment"] as const;

interface BookingProgressStepsProps {
  /** 1-based index of the current step. Clamped to 1..4. */
  currentStep: number;
  /** Fired when a completed (past) step is clicked. Omitted = steps not clickable. */
  onStepClick?: (step: number) => void;
}

export const BookingProgressSteps: React.FC<BookingProgressStepsProps> = ({
  currentStep,
  onStepClick,
}) => {
  const active = Math.min(Math.max(Math.floor(currentStep) || 1, 1), BOOKING_STEPS.length);

  return (
    <nav aria-label="Booking progress" data-testid="booking-progress-steps">
      <ol className="flex flex-wrap items-center gap-2">
        {BOOKING_STEPS.map((label, index) => {
          const step = index + 1;
          const isCompleted = step < active;
          const isActive = step === active;
          const clickable = isCompleted && typeof onStepClick === "function";
          return (
            <li
              key={label}
              data-testid={`booking-progress-step-${step}`}
              data-state={isActive ? "active" : isCompleted ? "completed" : "upcoming"}
              className="flex items-center gap-2"
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step)}
                  aria-label={`Back to step ${step}: ${label}`}
                  className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-sm font-semibold text-cta-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                >
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-cta-primary text-xs font-bold text-[var(--text-on-cta)]"
                  >
                    {step}
                  </span>
                  <span>{label}</span>
                </button>
              ) : (
                <span
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    isActive
                      ? "bg-cta-primary text-[var(--text-on-cta)]"
                      : "bg-bg-muted text-text-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isActive ? "bg-[var(--text-on-cta)] text-cta-primary" : "bg-bg-surface text-text-muted"
                    }`}
                  >
                    {step}
                  </span>
                  <span>{label}</span>
                </span>
              )}
              {step < BOOKING_STEPS.length && (
                <span aria-hidden className="text-text-muted">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default BookingProgressSteps;
