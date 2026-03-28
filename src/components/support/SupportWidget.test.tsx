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
});
