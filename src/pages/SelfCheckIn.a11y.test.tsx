/**
 * TASK-4438: SelfCheckIn form a11y — every input must have a programmatically
 * associated label (WCAG 1.3.1 / 4.1.2) and validation errors must be linked
 * to their inputs via aria-describedby (WCAG 3.3.2).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import SelfCheckIn from "./SelfCheckIn";

vi.mock("../components/SEO", () => ({ default: () => null }));

const details = {
  bookingRef: "ATL2026-001234",
  listingName: "Atlas Stay",
  propertyAddress: "Somewhere",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  checkinInstructions: "",
  wifiName: "",
  wifiPassword: "",
  houseRulesText: "",
  emergencyContactPhone: "",
  doorCode: "",
  idUploadRequired: true,
  houseRulesSignedAt: null,
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

describe("SelfCheckIn auth step a11y", () => {
  test("booking reference and last name inputs have accessible names and required state", () => {
    renderPage();

    const ref = screen.getByLabelText("Booking reference");
    const lastName = screen.getByLabelText("Last name");
    expect(ref).toHaveAccessibleName("Booking reference");
    expect(lastName).toHaveAccessibleName("Last name");
    expect(ref).toHaveAttribute("aria-required", "true");
    expect(lastName).toHaveAttribute("aria-required", "true");
  });

  test("validation error is announced and linked to the inputs via aria-describedby", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/booking reference and last name/i);

    const ref = screen.getByLabelText("Booking reference");
    const lastName = screen.getByLabelText("Last name");
    expect(ref).toHaveAttribute("aria-invalid", "true");
    expect(lastName).toHaveAttribute("aria-invalid", "true");
    expect(ref).toHaveAccessibleDescription(/booking reference and last name/i);
    expect(lastName).toHaveAccessibleDescription(/booking reference and last name/i);
  });
});

describe("SelfCheckIn ID step a11y", () => {
  test("ID type, ID number and ID photo inputs have associated labels", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(details), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText("Booking reference"), {
      target: { value: "ATL2026-001234" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // summary step → ID step
    await waitFor(() => expect(screen.getByText("Atlas Stay")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const idType = await screen.findByLabelText("ID type");
    expect(idType).toHaveAccessibleName("ID type");
    expect(screen.getByLabelText("ID number")).toHaveAccessibleName("ID number");
    const idPhoto = screen.getByLabelText(/id photo/i);
    expect(idPhoto).toHaveAccessibleName(/id photo/i);
    expect(idPhoto).toHaveAccessibleDescription(/JPG, PNG, or PDF/i);
  });
});
