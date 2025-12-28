import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var __ATLAS_RUNTIME_CONFIG__: { apiBaseUrl?: string } | undefined;
}

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    vi.stubEnv("PROD", "false");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it("throws when missing", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(() => getApiBaseUrl()).toThrow(/API base URL is not configured/);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("blocks localhost base URLs when production is set", async () => {
    vi.stubEnv("PROD", "true");
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000/");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(process.env.PROD).toBe("1");
    const { getApiBaseUrl } = await import("./getApiBaseUrl");
    expect(() => getApiBaseUrl()).toThrow(/cannot point to localhost/);
    expect(consoleSpy).toHaveBeenCalledWith("VITE_API_BASE_URL cannot point to localhost in production environments");
  });
});
