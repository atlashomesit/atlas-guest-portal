import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import { getApiBaseUrl, getApiBaseUrlSafe, isApiBaseConfigured } from "./api";

describe("api (getApiBaseUrl from runtime config)", () => {
  beforeEach(() => clearRuntimeConfig());
  afterEach(() => clearRuntimeConfig());

  it("getApiBaseUrl throws when runtime config is not loaded", () => {
    expect(() => getApiBaseUrl()).toThrow("Runtime config not loaded");
  });

  it("getApiBaseUrl returns apiBaseUrl when runtime config is set", () => {
    setRuntimeConfig({ apiBaseUrl: "https://api.example.com" });
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("getApiBaseUrlSafe returns empty string when runtime config is not loaded", () => {
    expect(getApiBaseUrlSafe()).toBe("");
  });

  it("getApiBaseUrlSafe returns apiBaseUrl when runtime config is set", () => {
    setRuntimeConfig({ apiBaseUrl: "https://api.example.com" });
    expect(getApiBaseUrlSafe()).toBe("https://api.example.com");
  });

  it("isApiBaseConfigured is false when runtime config is not loaded", () => {
    expect(isApiBaseConfigured()).toBe(false);
  });

  it("isApiBaseConfigured is true when runtime config has apiBaseUrl", () => {
    setRuntimeConfig({ apiBaseUrl: "https://api.example.com" });
    expect(isApiBaseConfigured()).toBe(true);
  });
});
