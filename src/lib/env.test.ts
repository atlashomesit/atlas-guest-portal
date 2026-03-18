import { afterEach, describe, expect, it, vi } from "vitest";
<<<<<<< HEAD

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
=======
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
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });
});
