import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var __ATLAS_RUNTIME_CONFIG__: { apiBaseUrl?: string } | undefined;
}

describe("getApiBaseUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete (globalThis as any).__ATLAS_RUNTIME_CONFIG__;
  });

  it("uses runtime config when present", async () => {
    (globalThis as any).__ATLAS_RUNTIME_CONFIG__ = { apiBaseUrl: "https://runtime.example" };
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(getApiBaseUrl()).toBe("https://runtime.example");
  });

  it("falls back to import.meta.env / process.env", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://env.example/");
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(getApiBaseUrl()).toBe("https://env.example");
  });

  it("supports API_BASE_URL when VITE_API_BASE_URL is missing", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example/");
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(getApiBaseUrl()).toBe("https://api.example");
  });

  it("returns empty string when missing", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(getApiBaseUrl()).toBe("");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("falls back to a default API base URL based on hostname", async () => {
    vi.stubGlobal("window", { location: { hostname: "dev.atlashomestays.com" } });
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(() => getApiBaseUrl()).toThrow(/cannot point to localhost or private network/);
    expect(consoleSpy).toHaveBeenCalledWith(
      "VITE_API_BASE_URL cannot point to localhost or private network addresses in production environments",
    );
  });

  it("blocks private network base URLs when production is set", async () => {
    vi.stubEnv("PROD", "true");
    vi.stubEnv("VITE_API_BASE_URL", "http://192.168.0.10:3000/");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(() => getApiBaseUrl()).toThrow(/cannot point to localhost or private network/);
    expect(consoleSpy).toHaveBeenCalledWith(
      "VITE_API_BASE_URL cannot point to localhost or private network addresses in production environments",
    );
  });
});
