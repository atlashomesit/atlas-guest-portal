import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadRuntimeConfig } from "./loader";
import { clearRuntimeConfig, getGlobalDiscountPercent, setRuntimeConfig } from "./index";

describe("loadRuntimeConfig", () => {
  const validConfig = {
    apiBaseUrl: "https://api.example.com",
    globalDiscountPercent: 17,
    environment: "test",
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("atlas-runtime-config")) {
          return Promise.resolve(
            new Response(JSON.stringify(validConfig), { status: 200 }),
          );
        }
        return Promise.resolve(new Response("", { status: 404 }));
      }),
    );
    vi.stubGlobal("window", {
      location: { origin: "https://example.com", hostname: "example.com" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearRuntimeConfig();
  });

  it("returns config when apiBaseUrl and optional fields are valid", async () => {
    const config = await loadRuntimeConfig();
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.globalDiscountPercent).toBe(17);
    expect(config.environment).toBe("test");
  });

  it("throws when apiBaseUrl is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ globalDiscountPercent: 10 }), {
            status: 200,
          }),
        ),
      ),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow("Runtime config missing/invalid");
  });

  it("throws when apiBaseUrl is not a valid http(s) URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ apiBaseUrl: "not-a-url", globalDiscountPercent: 0 }),
            { status: 200 },
          ),
        ),
      ),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow("Runtime config missing/invalid");
  });

  it("throws when globalDiscountPercent is out of bounds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              apiBaseUrl: "https://api.example.com",
              globalDiscountPercent: 150,
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow("Runtime config missing/invalid");
  });

  it("defaults globalDiscountPercent to 0 in the centralized getter when omitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ apiBaseUrl: "https://api.example.com" }), {
            status: 200,
          }),
        ),
      ),
    );
    const config = await loadRuntimeConfig();
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.globalDiscountPercent).toBeUndefined();

    setRuntimeConfig(config);
    expect(getGlobalDiscountPercent()).toBe(0);
  });

  it("throws when fetch fails (e.g. 404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow("Runtime config missing/invalid");
  });
});
