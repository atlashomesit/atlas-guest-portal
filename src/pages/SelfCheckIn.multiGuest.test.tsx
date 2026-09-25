import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import SelfCheckIn from "./SelfCheckIn";

vi.mock("../components/SEO", () => ({ default: () => null }));

const details = {
  bookingRef: "ATL2026-001234",
  listingName: "Atlas Stay",
  propertyAddress: "123 Beach Road",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  checkinInstructions: "Use door code",
  wifiName: "Atlas_Guest",
  wifiPassword: "secretpassword",
  houseRulesText: "No loud music after 10 PM",
  emergencyContactPhone: "+91 98765 43210",
  doorCode: "1234#",
  idUploadRequired: true,
  houseRulesSignedAt: null,
  guestCount: 2,
  guestName: "Alice Smith",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/checkin"]}>
      <SelfCheckIn />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelfCheckIn mandatory guest count & multi-guest ID verification", () => {
  test("enforces Number of guests as mandatory before continuing to ID step", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(details), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    renderPage();

    // Authenticate
    fireEvent.change(screen.getByLabelText("Booking reference"), {
      target: { value: "ATL2026-001234" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Smith" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // On summary step
    await waitFor(() => expect(screen.getByText("Atlas Stay")).toBeInTheDocument());

    const guestCountInput = screen.getByLabelText(/number of guests \*/i);
    expect(guestCountInput).toBeInTheDocument();
    expect(guestCountInput).toHaveAttribute("required");

    // Clear guest count to test required validation
    fireEvent.change(guestCountInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Should display error and remain on summary step
    expect(await screen.findByText(/please enter the number of guests/i)).toBeInTheDocument();
    expect(screen.queryByText(/government id verification/i)).not.toBeInTheDocument();
  });

  test("collects and verifies 2 guest IDs when guest count is 2", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(details), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    renderPage();

    // Authenticate
    fireEvent.change(screen.getByLabelText("Booking reference"), {
      target: { value: "ATL2026-001234" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Smith" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText("Atlas Stay")).toBeInTheDocument());

    // Enter guest count = 2 and continue
    const guestCountInput = screen.getByLabelText(/number of guests \*/i);
    fireEvent.change(guestCountInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Verify ID step rendered with 2 guest cards
    await waitFor(() => expect(screen.getByText(/government id verification/i)).toBeInTheDocument());
    expect(screen.getByTestId("guest-card-0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /guest 1 \(primary guest\)/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /guest 2/i })).toBeInTheDocument();

    // Fill Guest 1 details
    fireEvent.change(screen.getByLabelText("Full name (as on ID) *"), {
      target: { value: "Alice Smith" },
    });
    fireEvent.change(screen.getByLabelText("ID type"), {
      target: { value: "Aadhaar" },
    });
    fireEvent.change(screen.getByLabelText("ID number"), {
      target: { value: "123456789012" },
    });

    // Verify Guest 1 via DigiLocker
    const digilockerBtn = screen.getByTestId("aadhaar-vc-scan-button");
    fireEvent.click(digilockerBtn);
    expect(await screen.findByText(/aadhaar verified via digilocker/i)).toBeInTheDocument();

    // Fill Guest 2 details
    const guest2Card = screen.getByTestId("guest-card-1");
    const guest2Name = guest2Card.querySelector("#checkin-guest-name-1") as HTMLInputElement;
    const guest2IdType = guest2Card.querySelector("#checkin-id-type-1") as HTMLSelectElement;
    const guest2IdNumber = guest2Card.querySelector("#checkin-id-number-1") as HTMLInputElement;

    fireEvent.change(guest2Name, { target: { value: "Bob Smith" } });
    fireEvent.change(guest2IdType, { target: { value: "Passport" } });
    fireEvent.change(guest2IdNumber, { target: { value: "Z9876543" } });

    // Switch Guest 2 to Phone OTP tab
    const phoneOtpTab = screen.getByRole("button", { name: /phone otp/i });
    fireEvent.click(phoneOtpTab);

    // Enter phone and send OTP
    const guest2Phone = guest2Card.querySelector("#checkin-phone-1") as HTMLInputElement;
    fireEvent.change(guest2Phone, { target: { value: "9876543210" } });
    const sendOtpBtn = screen.getByRole("button", { name: /send otp/i });
    fireEvent.click(sendOtpBtn);

    expect(await screen.findByText(/otp sent to 9876543210/i)).toBeInTheDocument();

    // Enter 6-digit OTP and verify
    const guest2Otp = guest2Card.querySelector("#checkin-otp-1") as HTMLInputElement;
    fireEvent.change(guest2Otp, { target: { value: "123456" } });
    const verifyOtpBtn = screen.getByRole("button", { name: /verify otp/i });
    fireEvent.click(verifyOtpBtn);

    expect(await screen.findByText(/passport verified via otp/i)).toBeInTheDocument();

    // Click Continue to proceed to house rules
    fireEvent.click(screen.getByRole("button", { name: /continue →/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /house rules/i })).toBeInTheDocument());
  });

  test("supports pasting 6-digit OTP and automatically advances to next step on verification", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...details, guestCount: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    renderPage();

    // Authenticate
    fireEvent.change(screen.getByLabelText("Booking reference"), {
      target: { value: "ATL2026-001234" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Smith" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText("Atlas Stay")).toBeInTheDocument());

    // Continue from summary step
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // On ID step
    await waitFor(() => expect(screen.getByText(/government id verification/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Full name (as on ID) *"), {
      target: { value: "Alice Smith" },
    });
    fireEvent.change(screen.getByLabelText("ID type"), {
      target: { value: "Aadhaar" },
    });
    fireEvent.change(screen.getByLabelText("ID number"), {
      target: { value: "123456789012" },
    });

    // Select Phone OTP
    const phoneOtpTab = screen.getByRole("button", { name: /phone otp/i });
    fireEvent.click(phoneOtpTab);

    // Enter phone and send OTP
    const phoneInput = screen.getByLabelText(/phone number connected to id/i);
    fireEvent.change(phoneInput, { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

    expect(await screen.findByText(/otp sent to 9876543210/i)).toBeInTheDocument();

    // Paste 6-digit OTP
    const otpInput = screen.getByLabelText(/enter or paste 6-digit otp/i);
    fireEvent.paste(otpInput, {
      clipboardData: {
        getData: (format: string) => (format === "text" ? "998877" : ""),
      },
    });
    expect((otpInput as HTMLInputElement).value).toBe("998877");

    // Click verify OTP
    fireEvent.click(screen.getByRole("button", { name: /verify otp/i }));

    // Auto-advances to house rules
    await waitFor(
      () => expect(screen.getByRole("heading", { name: /house rules/i })).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });
});

