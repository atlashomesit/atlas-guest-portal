import { describe, it, expect, vi, afterEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var __ATLAS_RUNTIME_CONFIG__: { googleMapsApiKey?: string } | undefined;
}

describe("getGoogleMapsApiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (globalThis as any).__ATLAS_RUNTIME_CONFIG__;
  });

  it("uses runtime config when present", async () => {
    (globalThis as any).__ATLAS_RUNTIME_CONFIG__ = { googleMapsApiKey: "runtime-key" };
    const { getGoogleMapsApiKey } = await import("./getGoogleMapsApiKey");
    expect(getGoogleMapsApiKey()).toBe("runtime-key");
  });

  it("falls back to env when runtime config is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "env-key");
    const { getGoogleMapsApiKey } = await import("./getGoogleMapsApiKey");
    expect(getGoogleMapsApiKey()).toBe("env-key");
  });

  it("returns undefined and logs a warning when missing", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getGoogleMapsApiKey } = await import("./getGoogleMapsApiKey");
    expect(getGoogleMapsApiKey()).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
