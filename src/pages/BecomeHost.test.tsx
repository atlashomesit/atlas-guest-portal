import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
import { settle } from "../test/settle";

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

    await settle();
    expect(fetchMock).toHaveBeenCalled();

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
    await settle();
    expect(screen.getByText("property Type")).toBeInTheDocument();
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
    await settle();
    expect(screen.getByRole("button", { name: "Import listing" })).not.toBeDisabled();

    // TASK-7490: a 200 response that extracted nothing must not claim success.
    expect(toast.success).not.toHaveBeenCalled();
    // No propertyType (or any other) row was extracted, so the field list must be empty.
    expect(screen.queryByText("property Type")).toBeNull();
    // Done-when 3: empty prefill says so, and API warnings are surfaced.
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Could not extract listing details"),
    );
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Could not detect a structured property type"),
    );
  });

  it("surfaces API warnings alongside a successful propertyType prefill", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...realApiResponseWithPropertyType(),
          warnings: ["Photos were skipped — paste the listing text for richer import"],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAtImportStep();
    fireEvent.change(screen.getByLabelText("Airbnb listing URL"), { target: { value: AIRBNB_URL } });
    fireEvent.click(screen.getByRole("button", { name: "Import listing" }));

    await settle();
    expect(toast.success).toHaveBeenCalledWith("Listing details imported!");
    expect(toast.info).toHaveBeenCalledWith(
      "Photos were skipped — paste the listing text for richer import",
    );
  });
});

// 2026-11-17: this public signup page used to show three named host testimonials with growth
// figures (occupancy "from 40% to 85%", "revenue increased 60%"). Nothing on record showed they
// were real hosts who had agreed to be quoted, so they were removed. A quote may come back only
// from a real, consenting host with figures that can be sourced; these names and claims must not.
describe("BecomeHost — no invented host testimonials", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("shows no testimonial section, invented host names or invented growth figures", () => {
    render(
      <MemoryRouter>
        <BecomeHost />
      </MemoryRouter>,
    );

    const page = screen.getByTestId("become-host-page");
    expect(screen.queryByRole("heading", { name: /hear from our hosts/i })).toBeNull();

    const pageText = page.textContent ?? "";
    for (const invented of [
      "Priya Sharma",
      "Rajesh Kumar",
      "Ananya Patel",
      "40% to 85%",
      "revenue increased 60%",
    ]) {
      expect(pageText).not.toContain(invented);
    }
  });
});

// 2026-11-17: the page also carried an earnings estimator. It stated what "properties in your area
// earn" as one fixed rupee range, and turned a room-count slider into "estimated monthly earnings"
// said to be "based on average occupancy". Both were constants in this file, with no area and no
// data behind them, so the block was removed. Earnings figures may come back only from real,
// sourced numbers or from the host's own inputs.
describe("BecomeHost — no unsourced earnings figures", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("shows no earnings estimator and makes no earnings claim", () => {
    render(
      <MemoryRouter>
        <BecomeHost />
      </MemoryRouter>,
    );

    const page = screen.getByTestId("become-host-page");
    expect(screen.queryByRole("heading", { name: /how much could you earn/i })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();

    const pageText = page.textContent ?? "";
    for (const claim of [
      "Properties in your area earn",
      "₹45,000",
      "1,20,000",
      "Estimated monthly earnings",
      "Based on average occupancy",
    ]) {
      expect(pageText).not.toContain(claim);
    }
  });
});

// 2026-11-17: every product claim on this page was checked against the API and the admin portal.
// Three were false:
//   - "List Your Property — It's Free": a new host gets a 7-day free trial, then pays for a plan
//     (atlas-api Options/BillingOptions.cs DefaultTrialDurationDays, founder ruling 2026-10-07).
//   - "we'll have your property listed within 24 hours": the host publishes the listing themself,
//     and a trial account's booking site and marketplace listing stay private until a paid plan
//     (atlas-api Services/Billing/SubscriberLifecycle.cs, Services/Marketplace/MarketplaceEligibility.cs).
//   - "24/7 guest support": nobody answers guests round the clock; the AI receptionist is not on sale.
// Seven held only in part:
//   - "Multi-platform listing" and "Airbnb, Booking.com, MMT & more": the channel manager is real,
//     but it is a paid add-on and is not part of the trial.
//   - "Zero setup fee": true for packages only; own-number WhatsApp has a one-time setup fee.
//   - "Dynamic AI pricing tools": suggestions come from fixed rules, not an AI model
//     (atlas-api Services/Pricing/SmartPriceCalculator.cs).
//   - "Unified dashboard & payouts": one screen shows earnings and payouts; payouts are not pooled.
//   - "Guided photo upload & tips" under "Professional photography": a photo step in setup, no tips.
//   - "Data-driven SEO tools": an SEO title and description per listing; nothing reads search data.
// These tests keep the reworded claims in place and the retired ones out.
describe("BecomeHost — product claims match what the product does", () => {
  afterEach(() => {
    localStorage.clear();
  });

  function renderPageText(): string {
    render(
      <MemoryRouter>
        <BecomeHost />
      </MemoryRouter>,
    );
    return screen.getByTestId("become-host-page").textContent ?? "";
  }

  it("offers the 7-day free trial in the ruled words, and never calls listing free", () => {
    const pageText = renderPageText();

    const cta = screen.getByRole("link", { name: "Start your 7-day free trial" });
    expect(cta).toHaveAttribute("href", "#host-signup-form");
    expect(pageText).toContain("First 7 days free. No credit card. No setup fee on packages.");

    expect(pageText).not.toMatch(/it['’]s free/i);
  });

  it("says a setup fee is waived on packages only, not everywhere", () => {
    const pageText = renderPageText();

    expect(pageText).toContain("No setup fee on packages");
    expect(pageText).not.toMatch(/zero setup fee/i);
  });

  it("does not promise a listing within a set time, and says what makes a listing go live", () => {
    const pageText = renderPageText();

    expect(pageText).not.toMatch(/within \d+ hours|listed within/i);
    expect(screen.getByTestId("host-signup-go-live-note")).toHaveTextContent(
      "Your listing goes live for guests once you publish it and start a paid plan.",
    );
  });

  it("does not promise round-the-clock guest support or AI pricing", () => {
    const pageText = renderPageText();

    expect(pageText).not.toMatch(/24\/7 (guest )?support/i);
    expect(pageText).toContain("Automated guest messages");

    // Case-sensitive on purpose: "AI" as a word, not the "Ai" in Airbnb.
    expect(pageText).not.toMatch(/\bAI\b/);
    expect(pageText).not.toMatch(/data-driven/i);
    expect(pageText).toContain("Auto-pricing & pricing rules");
  });

  it("marks channel distribution as a paid add-on wherever it is named", () => {
    const pageText = renderPageText();

    expect(pageText).toContain("Multi-platform listing (paid add-on)");
    expect(pageText).toContain("Airbnb, Booking.com, MakeMyTrip & more (paid add-on)");
    // Neither claim may appear without its "(paid add-on)" qualifier.
    expect(pageText).not.toMatch(/Multi-platform listing(?! \(paid add-on\))/);
    expect(pageText).not.toMatch(/& more(?! \(paid add-on\))/);
  });

  it("describes payouts, photos and SEO as the screens that exist, not as services", () => {
    const pageText = renderPageText();

    expect(pageText).toContain("One dashboard for earnings & payouts");
    expect(pageText).toContain("Photo upload step in setup");
    expect(pageText).toContain("SEO title & description for each listing");
    expect(pageText).not.toMatch(/professional photography|unified dashboard & payouts|photo upload & tips/i);
  });
});
