// TASK-4439: focus management regression tests for the shared Modal
// (WCAG 2.4.3 focus order / 2.1.2 no keyboard trap-with-no-exit).
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./Modal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Test dialog"
        actions={
          <button type="button" onClick={() => setOpen(false)}>
            Confirm
          </button>
        }
      >
        <button type="button">Inner action</button>
      </Modal>
    </div>
  );
}

function openModal() {
  const trigger = screen.getByText("Open dialog");
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe("Modal focus management (TASK-4439)", () => {
  it("moves focus inside the dialog on open", () => {
    render(<Harness />);
    openModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    // First focusable element is the header close button.
    expect(document.activeElement).toBe(screen.getByLabelText("Close modal"));
  });

  it("wraps Tab from the last focusable back to the first", () => {
    render(<Harness />);
    openModal();

    const closeButton = screen.getByLabelText("Close modal");
    const confirmButton = screen.getByText("Confirm");

    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("wraps Shift+Tab from the first focusable back to the last", () => {
    render(<Harness />);
    openModal();

    const closeButton = screen.getByLabelText("Close modal");
    const confirmButton = screen.getByText("Confirm");

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
  });

  it("returns focus to the trigger on close", () => {
    render(<Harness />);
    const trigger = openModal();
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
