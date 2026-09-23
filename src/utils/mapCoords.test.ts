import { describe, expect, it } from "vitest";
import { centroidForCity, fallbackCoordsForListing, hasMapCoords } from "./mapCoords";

describe("mapCoords (TASK-102490)", () => {
  it("resolves a Goa listing near Goa, not Hyderabad", () => {
    const pin = fallbackCoordsForListing(42, "Siolim, Goa");
    expect(pin).not.toBeNull();
    // Goa centroid (15.30, 74.12) ± jitter 0.04 — far from Hyderabad (17.39, 78.49).
    expect(Math.abs(pin!.lat - 15.299326)).toBeLessThan(0.05);
    expect(Math.abs(pin!.lng - 74.123996)).toBeLessThan(0.05);
    const hyderabadKm = Math.hypot(pin!.lat - 17.385044, pin!.lng - 78.486671);
    expect(hyderabadKm).toBeGreaterThan(1);
  });

  it("matches city case-insensitively and by alias", () => {
    expect(centroidForCity("BANGALORE")?.lat).toBeCloseTo(12.971599, 4);
    expect(centroidForCity("Coorg valley")?.lng).toBeCloseTo(75.738185, 4);
  });

  it("returns null for unknown or missing city — never a fake Hyderabad pin", () => {
    expect(fallbackCoordsForListing(7, "Bali")).toBeNull();
    expect(fallbackCoordsForListing(7, "")).toBeNull();
    expect(fallbackCoordsForListing(7, null)).toBeNull();
    expect(fallbackCoordsForListing(7)).toBeNull();
    expect(centroidForCity("Paris")).toBeNull();
  });

  it("keeps Hyderabad working for Hyderabad listings", () => {
    const pin = fallbackCoordsForListing(9, "Hyderabad");
    expect(pin).not.toBeNull();
    expect(Math.abs(pin!.lat - 17.385044)).toBeLessThan(0.05);
  });

  it("hasMapCoords still guards the exact path", () => {
    expect(hasMapCoords(17.4, 78.4)).toBe(true);
    expect(hasMapCoords(null, 78.4)).toBe(false);
    expect(hasMapCoords(NaN, 10)).toBe(false);
  });
});
