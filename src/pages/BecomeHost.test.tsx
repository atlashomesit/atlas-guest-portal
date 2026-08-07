import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// TASK-7490: BecomeHost's "Import from Airbnb" prefill was broken end-to-end — the request body
// used {url, text} while the backend's AirbnbPrefillRequestDto (Atlas.Api/DTOs/OnboardingDtos.cs)
// declares AirbnbUrl/PastedText (camelCase over the wire), so both always arrived null server-side;
// and the response handler read city/pincode/address/roomCount, none of which
// AirbnbPrefillResponseDto returns. These tests exercise the real component against a RAW response
// body shaped exactly like the real API (title/locationText/propertyType/amenities/photoUrls/
// houseRules/maxGuests/description/source/warnings) rather than an idealized one, so a future
// regression back to the old field names/shape fails loudly here instead of silently in prod.

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "react-toastify";
import BecomeHost from "./BecomeHost";

const AIRBNB_URL = "https://www.airbnb.com/rooms/12345";

/** Real AirbnbPrefillResponseDto shape (Atlas.Api/DTOs/OnboardingDtos.cs) with a usable propertyType. */
function realApiResponseWithPropertyType() {
  return {
    title: "Cozy Villa in Lonavala",
    locationText: "Lonavala, Maharashtra",
    propertyType: "Villa",
    amenities: ["WiFi", "Pool"],
    photoUrls: [],
    houseRules: [],
    maxGuests: 4,
    description: "A lovely villa near the lake.",
    source: "airbnb",
    warnings: [],
  };
}

/** Real AirbnbPrefillResponseDto shape where extraction found nothing structured to prefill. */
function realApiResponseWithNoUsableFields() {
  return {
    title: "Unstructured listing text pasted by host",
    locationText: "",
    propertyType: null,
    amenities: [],
    photoUrls: [],
    houseRules: [],
    maxGuests: null,
    description: "",
    source: "text",
    warnings: ["Could not detect a structured property type"],
  };
}

function fillStep1AndStep2() {
  fireEvent.change(screen.getByTestId("host-onboard-name"), { target: { value: "Priya Sharma" } });
  fireEvent.change(screen.getByTestId("host-onboard-email"), { target: { value: "priya@example.com" } });
  fireEvent.change(screen.getByTestId("host-onboard-phone"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByTestId("host-onboard-password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByTestId("host-onboard-continue"));

  fireEvent.change(screen.getByLabelText("Property type"), { target: { value: "Villa" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Lonavala" } });
  fireEvent.change(screen.getByLabelText("Pincode"), { target: { value: "410401" } });
  fireEvent.change(screen.getByLabelText("Full address"), { target: { value: "123 Lake View Road" } });
  fireEvent.click(screen.getByTestId("host-onboard-continue"));
}

function renderAtImportStep() {
  render(
    <MemoryRouter>
      <BecomeHost />
    </MemoryRouter>,
  );
  fillStep1AndStep2();
}

describe("BecomeHost — Airbnb prefill (TASK-7490)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("POSTs airbnbUrl/pastedText — the backend's actual DTO field names — never the old {url, text} shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(realApiResponseWithPropertyType()),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAtImportStep();
    fireEvent.change(screen.getByLabelText("Airbnb listing URL"), { target: { value: AIRBNB_URL } });
    fireEvent.click(screen.getByRole("button", { name: "Import listing" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/onboarding/airbnb/prefill");
    const sentBody = JSON.parse((init as RequestInit).body as string);
    // The old (broken) shape was {url, text}; the fix must send airbnbUrl/pastedText instead.
    expect(sentBody).toEqual({ airbnbUrl: AIRBNB_URL });
    expect(sentBody).not.toHaveProperty("url");
    expect(sentBody).not.toHaveProperty("text");
  });

  it("reads only propertyType from a raw real-API response — city/pincode/address/roomCount don't exist in it and must not be read", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(realApiResponseWithPropertyType()),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAtImportStep();
    fireEvent.change(screen.getByLabelText("Airbnb listing URL"), { target: { value: AIRBNB_URL } });
    fireEvent.click(screen.getByRole("button", { name: "Import listing" }));

    // "propertyType" is rendered (via `key.replace(/([A-Z])/g, " $1")`) as the literal text
    // "property Type" inside the "Imported fields" box.
    await waitFor(() => expect(screen.getByText("property Type")).toBeInTheDocument());
    expect(screen.getByText("Villa", { selector: "span" })).toBeInTheDocument();

    // None of the fields the real API never returns were read into the prefilled set.
    expect(screen.queryByText("city")).toBeNull();
    expect(screen.queryByText("pincode")).toBeNull();
    expect(screen.queryByText("address")).toBeNull();
    expect(screen.queryByText("room Count")).toBeNull();

    expect(toast.success).toHaveBeenCalledWith("Listing details imported!");
  });

  it("does not fire a false-success toast (or show an empty prefill box) when the response has no usable fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(realApiResponseWithNoUsableFields()),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAtImportStep();
    fireEvent.change(screen.getByLabelText("Airbnb listing URL"), { target: { value: AIRBNB_URL } });
    const importButton = screen.getByRole("button", { name: "Import listing" });
    fireEvent.click(importButton);

    // Wait for the async handler to settle (button leaves its "Importing..." loading state).
    await waitFor(() => expect(screen.getByRole("button", { name: "Import listing" })).not.toBeDisabled());

    // TASK-7490: a 200 response that extracted nothing must not claim success.
    expect(toast.success).not.toHaveBeenCalled();
    // No propertyType (or any other) row was extracted, so the field list must be empty.
    expect(screen.queryByText("property Type")).toBeNull();
  });
});
