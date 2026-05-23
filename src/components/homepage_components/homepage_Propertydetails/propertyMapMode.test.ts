import { describe, it, expect } from "vitest";
import { selectPropertyMapMode } from "./propertyMapMode";

describe("selectPropertyMapMode — Task 3 precedence", () => {
  const coords = { latitude: 17.45, longitude: 78.39 };
  const tenantDefault = { lat: 12.97, lng: 77.59, zoom: 12 };

  it("prefers the property's own coordinates over everything else", () => {
    const sel = selectPropertyMapMode({
      ...coords,
      mapSrc: "https://maps.example/embed",
      useMultiPin: true,
      mapLocation: tenantDefault,
    });
    expect(sel).toEqual({ kind: "coords", lat: 17.45, lng: 78.39 });
  });

  it("falls back to the custom mapSrc iframe when coords are absent", () => {
    const sel = selectPropertyMapMode({
      mapSrc: "https://maps.example/embed",
      useMultiPin: true,
      mapLocation: tenantDefault,
    });
    expect(sel.kind).toBe("iframe");
  });

  it("falls back to multi-pin when no coords and no custom mapSrc", () => {
    const sel = selectPropertyMapMode({
      mapSrc: "",
      useMultiPin: true,
      mapLocation: tenantDefault,
    });
    expect(sel.kind).toBe("multipin");
  });

  it("falls back to the tenant default last", () => {
    const sel = selectPropertyMapMode({
      mapSrc: "   ",
      useMultiPin: false,
      mapLocation: tenantDefault,
    });
    expect(sel).toEqual({ kind: "tenant", lat: 12.97, lng: 77.59 });
  });

  it("returns 'none' when nothing is available", () => {
    expect(selectPropertyMapMode({}).kind).toBe("none");
  });

  it("ignores non-finite / partial coordinates and keeps falling through", () => {
    expect(
      selectPropertyMapMode({ latitude: NaN, longitude: 10, useMultiPin: true }).kind,
    ).toBe("multipin");
    expect(
      selectPropertyMapMode({ latitude: 17.45, mapSrc: "x" }).kind,
    ).toBe("iframe"); // longitude missing -> not coords
    expect(
      selectPropertyMapMode({ mapLocation: { lat: 1 } }).kind,
    ).toBe("none"); // tenant lng missing
  });
});
