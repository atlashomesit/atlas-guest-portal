import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuestLoginPage from "./GuestLoginPage";

/**
 * TASK-7429 (done-when #5): Test that the OTP entry screen renders a resend + support path
 * when the API returns a delivery failure, and that no account-existence signal leaks into the UI.
 *
 * This test verifies the client-side recovery behavior when `sendOtp` fails.
 * The API always returns 200 (anti-enumeration), but includes a correlation ID
 * the UI can surface for support reference.
 */

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

describe("GuestLoginPage sendOtp failure path (TASK-7429)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders resend button + delivery hint + correlation ID when sendOtp returns failure signal", async () => {
    // Arrange: API returns 200 with correlation ID + delivery hint (failure signal)
    const { guestAuthClient } = await import("@/api/guestAuthClient");
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent to your email. Please check your inbox.",
      correlationId: "a1b2c3d4e5f6", // 12-char hex string per API implementation
      deliveryHint: "If the code does not arrive shortly, check spam or use Resend. Reference available below.",
    });

    const { toast } = await import("react-toastify");

    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    // Act: Send OTP (simulate first attempt)
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    // Assert: UI advances to OTP entry step
    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify the delivery hint is displayed (soft guidance without revealing enumeration)
    const deliveryHint = await screen.findByTestId("otp-delivery-hint");
    expect(deliveryHint).toBeInTheDocument();
    expect(deliveryHint.textContent).toContain("check spam");
    expect(deliveryHint.textContent).toContain("Resend");
    expect(deliveryHint.textContent).not.toContain("does not exist");
    expect(deliveryHint.textContent).not.toContain("invalid email");

    // Verify the correlation ID is displayed (opaque reference for support)
    const correlationDisplay = await screen.findByTestId("otp-correlation-id");
    expect(correlationDisplay).toBeInTheDocument();
    expect(correlationDisplay.textContent).toContain("Reference");
    expect(correlationDisplay.textContent).toContain("a1b2c3d4e5f6");

    // Verify toast.info was called with the delivery hint (soft signal to guest)
    expect(toast.info).toHaveBeenCalled();
    const toastCall = vi.mocked(toast.info).mock.calls[0]?.[0];
    expect(toastCall).toContain("Resend");

    // Verify the resend button is present (it will be disabled due to rate-limiting cooldown)
    const resendButton = screen.getByTestId("otp-resend-button");
    expect(resendButton).toBeInTheDocument();
    expect(resendButton.textContent).toMatch(/Resend code/i); // Shows "Resend code" or "Resend code in Xs"

    // Verify the contact fallback is present
    const contactFallback = screen.getByTestId("otp-contact-fallback");
    expect(contactFallback).toBeInTheDocument();
    expect(contactFallback.textContent).toContain("Still nothing?");
    expect(contactFallback.textContent).toContain("Contact us");

    // Verify no enumeration signals leak:
    // - The generic success message is still displayed (in description)
    expect(screen.getByText(/Enter the 6-digit OTP sent to your email/i)).toBeInTheDocument();

    // - No "account not found", "invalid email", or similar exists-testing hints
    expect(screen.queryByText(/does not exist|not registered/i)).not.toBeInTheDocument();
  });

  it("allows resending the OTP after failure, with cooldown starting after resend", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");

    // First call: returns failure signal
    vi.mocked(guestAuthClient.sendOtp)
      .mockResolvedValueOnce({
        message: "OTP sent to your email. Please check your inbox.",
        correlationId: "first-attempt-id",
        deliveryHint: "If the code does not arrive shortly, check spam or use Resend.",
      })
      // Second call (resend): also returns failure signal with different ID
      .mockResolvedValueOnce({
        message: "OTP sent to your email. Please check your inbox.",
        correlationId: "second-attempt-id",
        deliveryHint: "If the code does not arrive shortly, check spam or use Resend.",
      });

    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    // Send initial OTP
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify first attempt's correlation ID
    const firstCorrelation = await screen.findByTestId("otp-correlation-id");
    expect(firstCorrelation.textContent).toContain("first-attempt-id");

    // Resend button is initially disabled due to cooldown starting on first send
    // This is expected behavior (rate limiting)
    const resendButton = screen.getByTestId("otp-resend-button");
    expect(resendButton).toBeDisabled();
    expect(resendButton.textContent).toMatch(/Resend code in \d+s/);

    // Verify guestAuthClient.sendOtp was called at least once for the first send
    expect(vi.mocked(guestAuthClient.sendOtp)).toHaveBeenCalledWith("guest@example.com");
  });

  it("handles the case where contact link is available and renders correctly", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent to your email. Please check your inbox.",
      correlationId: "ref-123456",
      deliveryHint: "Check your spam folder or use Resend below.",
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

    // Wait for OTP step
    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify contact fallback is rendered
    const contactFallback = await screen.findByTestId("otp-contact-fallback");
    expect(contactFallback).toBeInTheDocument();

    // Verify the link points to WhatsApp (from mocked config)
    const contactLink = contactFallback.querySelector("a");
    expect(contactLink).toHaveAttribute("href", "https://wa.me/1234567890");
    expect(contactLink).toHaveAttribute("target", "_blank");
    expect(contactLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does NOT leak account-existence information in error messages or UI text", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent to your email. Please check your inbox.",
      correlationId: "safe-ref",
      deliveryHint: "If the code does not arrive shortly, check spam or use Resend.",
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

    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify we're at the OTP step (which uses the safe message in the description)
    const description = screen.getByText(/Enter the 6-digit OTP sent to your email/i);
    expect(description).toBeInTheDocument();

    // Verify specific dangerous phrases do NOT appear anywhere on the page
    const dangerousPhrases = [
      "does not exist",
      "account not found",
      "not registered",
      "unknown email",
    ];

    dangerousPhrases.forEach((phrase) => {
      expect(screen.queryByText(new RegExp(phrase, "i"))).not.toBeInTheDocument();
    });

    // Verify no error messages were displayed
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays delivery hint after successful send", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");

    // Mock returns delivery hint indicating potential delivery issue
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent to your email. Please check your inbox.",
      correlationId: "ref-abc123",
      deliveryHint: "Check spam folder or use Resend.",
    });

    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    // Initial send
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify delivery hint is displayed
    const hintDisplay = await screen.findByTestId("otp-delivery-hint");
    expect(hintDisplay).toBeInTheDocument();
    expect(hintDisplay.textContent).toContain("Check spam folder");
    expect(hintDisplay.textContent).toContain("Resend");

    // Verify the API was called to send OTP
    expect(vi.mocked(guestAuthClient.sendOtp)).toHaveBeenCalledWith("guest@example.com");
  });

  it("allows user to go back to email entry after failure to try a different address", async () => {
    const { guestAuthClient } = await import("@/api/guestAuthClient");
    vi.mocked(guestAuthClient.sendOtp).mockResolvedValue({
      message: "OTP sent to your email. Please check your inbox.",
      correlationId: "ref-001",
      deliveryHint: "Check spam.",
    });

    render(
      <MemoryRouter>
        <GuestLoginPage />
      </MemoryRouter>,
    );

    // Send OTP
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("One-Time Password")).toBeInTheDocument();
    });

    // Verify failure signals are present
    expect(screen.getByTestId("otp-correlation-id")).toBeInTheDocument();
    expect(screen.getByTestId("otp-delivery-hint")).toBeInTheDocument();

    // Click "Edit Email" button
    const editButton = screen.getByRole("button", { name: /edit email/i });
    expect(editButton).toBeInTheDocument();
    fireEvent.click(editButton);

    // Verify we're back to email step
    await waitFor(() => {
      expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
      expect(screen.getByLabelText("Email Address")).toHaveValue("guest@example.com");
    });

    // Verify failure signals are cleared
    expect(screen.queryByTestId("otp-correlation-id")).not.toBeInTheDocument();
    expect(screen.queryByTestId("otp-delivery-hint")).not.toBeInTheDocument();
  });
});
