import { afterEach, describe, expect, it, vi } from "vitest";

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
