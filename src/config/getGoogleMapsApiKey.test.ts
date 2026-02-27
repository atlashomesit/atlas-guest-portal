import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import { getGoogleMapsApiKey } from "./getGoogleMapsApiKey";

describe("getGoogleMapsApiKey", () => {
  beforeEach(() => {
    setRuntimeConfig({ apiBaseUrl: "https://api.test" });
  });

  afterEach(() => {
    clearRuntimeConfig();
    vi.restoreAllMocks();
  });

  it("returns googleMapsApiKey when set in runtime config", () => {
    setRuntimeConfig({
      apiBaseUrl: "https://api.test",
      googleMapsApiKey: "runtime-key",
    });
    expect(getGoogleMapsApiKey()).toBe("runtime-key");
  });

  it("returns undefined and logs a warning when googleMapsApiKey is not set", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getGoogleMapsApiKey()).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
