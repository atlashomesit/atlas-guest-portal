import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import SupportWidget from "./SupportWidget";

vi.mock("react-icons/fi", () => ({
  FiMessageCircle: () => <svg data-testid="icon-message" />,
  FiHelpCircle: () => <svg data-testid="icon-help" />,
  FiPhone: () => <svg data-testid="icon-phone" />,
  FiPhoneCall: () => <svg data-testid="icon-phonecall" />,
  FiX: () => <svg data-testid="icon-close" />,
}));

vi.mock("react-icons/fa", () => ({
  FaWhatsapp: () => <svg data-testid="icon-whatsapp" />,
}));

const renderWidget = () =>
  render(
    <MemoryRouter>
      <SupportWidget />
    </MemoryRouter>,
  );

describe("SupportWidget", () => {
  it("renders the minimized pill by default", () => {
    renderWidget();
    expect(screen.getByRole("button", { name: /chat with us/i })).toBeInTheDocument();
    expect(screen.queryByText(/Request callback/i)).not.toBeInTheDocument();
  });

  it("toggles open and closed", () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: /chat with us/i }));
    expect(screen.getByText(/Request callback/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/close support widget/i));
    expect(screen.getByRole("button", { name: /chat with us/i })).toBeInTheDocument();
    expect(screen.queryByText(/Request callback/i)).not.toBeInTheDocument();
  });

  it("TASK-101880: drawer exposes dialog semantics, takes focus, Escape closes and restores focus", () => {
    renderWidget();

    const trigger = screen.getByRole("button", { name: /chat with us/i });
    // Simulate the real interaction where the trigger holds focus on open,
    // so focus-restore has a meaningful target (jsdom does not focus on click).
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /need a hand/i });
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const reopenedTrigger = screen.getByRole("button", { name: /chat with us/i });
    expect(reopenedTrigger).toBeInTheDocument();
    expect(document.activeElement).toBe(reopenedTrigger);
  });
});
