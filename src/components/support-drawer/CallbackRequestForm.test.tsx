/**
 * TASK-101879: callback form success/failure results must be announced (WCAG 2.1 4.1.3).
 * Error -> role="alert" wired via aria-describedby on the phone input;
 * success -> role="status" with aria-live="polite". No focus movement.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import CallbackRequestForm from "./CallbackRequestForm";
import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";

const baseProps = {
  callbackPhone: "9876543210",
  onClose: vi.fn(),
  onPhoneChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("TASK-101879: CallbackRequestForm result announcements", () => {
  it("announces the error via role=alert and links the input with aria-describedby", () => {
    const errorText = "Enter a valid 10-digit number.";
    render(
      <CallbackRequestForm
        {...baseProps}
        callbackError={errorText}
        callbackStatus="error"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(errorText);

    const input = screen.getByLabelText(
      SUPPORT_DRAWER_COPY.callbackForm.phoneInputAriaLabel,
    );
    expect(input).toHaveAttribute("aria-describedby", alert.id);
    expect(alert.id).not.toBe("");
  });

  it("announces success via role=status without moving focus", () => {
    render(
      <CallbackRequestForm
        {...baseProps}
        callbackError={null}
        callbackStatus="sent"
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      SUPPORT_DRAWER_COPY.callbackForm.successMessage,
    );
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(document.activeElement).not.toBe(status);
  });

  it("omits aria-describedby when there is no error", () => {
    render(
      <CallbackRequestForm
        {...baseProps}
        callbackError={null}
        callbackStatus="idle"
      />,
    );

    const input = screen.getByLabelText(
      SUPPORT_DRAWER_COPY.callbackForm.phoneInputAriaLabel,
    );
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
