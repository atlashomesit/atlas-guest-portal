import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import { getApiBaseUrlSafe } from "./env";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  clearRuntimeConfig();
});

describe("getAllowedEmails", () => {
  it("parses JSON array", async () => {
    vi.stubEnv("VITE_ALLOWED_EMAILS", '["a@example.com","b@example.com"]');
    vi.resetModules();
    const { getAllowedEmails } = await import("./env");
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("parses CSV list", async () => {
    vi.stubEnv("VITE_ALLOWED_EMAILS", "a@example.com,b@example.com");
    vi.resetModules();
    const { getAllowedEmails } = await import("./env");
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });
});

describe("getApiBaseUrlSafe", () => {
  it("returns apiBaseUrl from runtime config", () => {
    setRuntimeConfig({ apiBaseUrl: "https://api.test" });
    expect(getApiBaseUrlSafe()).toBe("https://api.test");
  });

  it("returns empty string when runtime config is not loaded", () => {
    clearRuntimeConfig();
    expect(getApiBaseUrlSafe()).toBe("");
  });
});
