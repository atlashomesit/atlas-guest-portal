import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedEmails } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAllowedEmails", () => {
  it("parses JSON array", () => {
    vi.stubEnv("VITE_ALLOWED_EMAILS", '["a@example.com","b@example.com"]');
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("parses CSV list", () => {
    vi.stubEnv("VITE_ALLOWED_EMAILS", "a@example.com,b@example.com");
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });
});
