import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
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

describe('getApiBase', () => {
  it('blocks localhost in prod', async () => {
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_API_BASE', 'http://localhost:3000');
    vi.resetModules();
    const { getApiBase } = await import('../utils/env');
    expect(() => getApiBase()).toThrow();
  });
});
