import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PriceDropAlertControl } from "../PriceDropAlertModal";
import { settle } from "../../test/settle";

describe("PriceDropAlertControl — GUEST-088 price-drop alert toggle & opt-in modal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("requires DPDP opt-in consent, saves email alert, and allows removing it", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "srv-42" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PriceDropAlertControl
        listingId={101}
        listingName="Coorg Estate Villa"
        nightlyRateInr={4500}
        maxGuests={4}
      />,
    );

    const toggle = screen.getByTestId("price-alert-toggle-101");
    expect(toggle.textContent).toContain("Track price");

    fireEvent.click(toggle);
    expect(screen.getByTestId("price-alert-modal-101")).toBeTruthy();

    fireEvent.change(screen.getByTestId("price-alert-email-input"), {
      target: { value: "guest@example.com" },
    });

    // Submitting without consent shows error
    fireEvent.click(screen.getByTestId("price-alert-submit-btn"));
    expect(screen.getByTestId("price-alert-error").textContent).toContain("opt-in consent");

    // Check consent and submit
    fireEvent.click(screen.getByTestId("price-alert-consent-checkbox"));
    fireEvent.click(screen.getByTestId("price-alert-submit-btn"));
    await settle();

    expect(screen.getByTestId("price-alert-toggle-101").textContent).toContain("Tracking price");

    // Re-open shows active summary and allows removing
    fireEvent.click(screen.getByTestId("price-alert-toggle-101"));
    expect(screen.getByTestId("price-alert-active-summary").textContent).toContain("guest@example.com");

    fireEvent.click(screen.getByTestId("price-alert-remove-btn"));
    await settle();

    expect(screen.getByTestId("price-alert-toggle-101").textContent).toContain("Track price");
  });

  test("supports WhatsApp channel opt-in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    render(
      <PriceDropAlertControl
        listingId={202}
        listingName="Goa Beach Loft"
        nightlyRateInr={6000}
      />,
    );

    fireEvent.click(screen.getByTestId("price-alert-toggle-202"));
    fireEvent.click(screen.getByTestId("price-alert-channel-whatsapp"));
    fireEvent.change(screen.getByTestId("price-alert-phone-input"), {
      target: { value: "+91 9876543210" },
    });
    fireEvent.click(screen.getByTestId("price-alert-consent-checkbox"));
    fireEvent.click(screen.getByTestId("price-alert-submit-btn"));
    await settle();

    expect(screen.getByTestId("price-alert-toggle-202").textContent).toContain("Tracking price");
  });
});
