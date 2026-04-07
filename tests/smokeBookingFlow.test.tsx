import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "../src/App";

vi.mock("@fancyapps/ui", () => ({ Fancybox: { bind: vi.fn(), destroy: vi.fn() } }));

describe("booking smoke flows", () => {
  const mockMatchMedia = () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      window.localStorage.removeItem("atlasHeroSearch");
    } catch {
      /* ignore */
    }
    window.history.pushState({}, "", "/");
    mockMatchMedia();
    window.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    (window as Window & { Razorpay?: new () => unknown }).Razorpay = function RazorpayMock() {};

    const response = new Response(JSON.stringify({ bookings: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    vi.spyOn(global, "fetch").mockImplementation(async () => response.clone());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("home route loads hero search widget after lazy Home resolves", async () => {
    render(<App />);
    // Route-level lazy loading can be slow on CI; Book Now appears once home shell is interactive.
    expect(await screen.findByRole("button", { name: /book now/i }, { timeout: 30_000 })).toBeInTheDocument();
  });

  test("navbar exposes book now when present", async () => {
    render(<App />);
    const navbar = document.getElementById("navbar_container");
    expect(navbar).not.toBeNull();
    expect(within(navbar as HTMLElement).getByRole("button", { name: /book now/i })).toBeInTheDocument();
  });
});
