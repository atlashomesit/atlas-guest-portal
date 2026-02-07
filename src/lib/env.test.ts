import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
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
  it("trims trailing slashes", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.test/");
    const { getApiBaseUrlSafe } = await import("../config/api");
    expect(getApiBaseUrlSafe()).toBe("https://api.test");
  });

  it("logs and clears localhost config in production", async () => {
    vi.stubEnv("PROD", "true");
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000/");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getApiBaseUrlSafe } = await import("../config/api");
    expect(getApiBaseUrlSafe()).toBe("");
    expect(errorSpy).toHaveBeenCalledWith("VITE_API_BASE_URL cannot point to localhost in production environments");
  });
});
