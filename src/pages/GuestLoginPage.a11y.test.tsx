import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuestLoginPage from "./GuestLoginPage";

vi.mock("@/api/guestAuthClient", () => ({
  guestAuthClient: {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  },
}));

vi.mock("@/contexts/GuestAuthContext", () => ({
  useGuestAuth: () => ({
    login: vi.fn(),
  }),
}));

vi.mock("@/config/contact", () => ({
  getTelLink: () => "tel:+911234567890",
  getWhatsAppLink: () => "https://wa.me/1234567890",
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("GuestLoginPage a11y (TASK-7435)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("associates the email input with the visible label, not the placeholder", () => {
    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    const email = screen.getByLabelText("Email Address");
    expect(email).toHaveAttribute("id", "guest-login-email");
    expect(email).toHaveAttribute("placeholder", "your@email.com");
    expect(email).toHaveAccessibleName("Email Address");
  });

  it("associates the OTP input with the visible label after the email step", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent",
      correlationId: "corr-1",
    });

    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    const otp = await screen.findByLabelText("One-Time Password");
    expect(otp).toHaveAttribute("id", "guest-login-otp");
    expect(otp).toHaveAttribute("placeholder", "000000");
    expect(otp).toHaveAccessibleName("One-Time Password");
  });
});
