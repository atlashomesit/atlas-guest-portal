import { afterEach, describe, expect, it } from "vitest";
import {
  clearRuntimeConfig,
  getApiBaseUrl,
  getGlobalDiscountPercent,
  getGoogleMapsApiKey,
  getRuntimeConfig,
  setRuntimeConfig,
} from "./index";

describe("runtime-config singleton", () => {
  beforeEach(() => {
    clearRuntimeConfig();
  });
  afterEach(() => {
    clearRuntimeConfig();
  });

  describe("getRuntimeConfig", () => {
    it("throws when config has not been set", () => {
      expect(() => getRuntimeConfig()).toThrow("Runtime config not loaded");
    });

    it("returns the config after setRuntimeConfig", () => {
      const config = {
        apiBaseUrl: "https://api.test",
        globalDiscountPercent: 10,
      };
      setRuntimeConfig(config);
      expect(getRuntimeConfig()).toEqual(config);
    });
  });

  describe("getApiBaseUrl", () => {
    it("throws when config has not been set", () => {
      expect(() => getApiBaseUrl()).toThrow("Runtime config not loaded");
    });

    it("returns apiBaseUrl after setRuntimeConfig", () => {
      setRuntimeConfig({ apiBaseUrl: "https://api.test" });
      expect(getApiBaseUrl()).toBe("https://api.test");
    });
  });

  describe("getGlobalDiscountPercent", () => {
    it("throws when config has not been set", () => {
      expect(() => getGlobalDiscountPercent()).toThrow("Runtime config not loaded");
    });

    it("returns globalDiscountPercent when set", () => {
      setRuntimeConfig({ apiBaseUrl: "https://api.test", globalDiscountPercent: 25 });
      expect(getGlobalDiscountPercent()).toBe(25);
    });

    it("returns 0 when globalDiscountPercent is omitted", () => {
      setRuntimeConfig({ apiBaseUrl: "https://api.test" });
      expect(getGlobalDiscountPercent()).toBe(0);
    });
  });

  describe("getGoogleMapsApiKey", () => {
    it("returns undefined when config has not been set (throws from getRuntimeConfig)", () => {
      expect(() => getGoogleMapsApiKey()).toThrow("Runtime config not loaded");
    });

    it("returns googleMapsApiKey when set", () => {
      setRuntimeConfig({
        apiBaseUrl: "https://api.test",
        googleMapsApiKey: "test-key",
      });
      expect(getGoogleMapsApiKey()).toBe("test-key");
    });

    it("returns undefined when googleMapsApiKey is omitted", () => {
      setRuntimeConfig({ apiBaseUrl: "https://api.test" });
      expect(getGoogleMapsApiKey()).toBeUndefined();
    });
  });
});
