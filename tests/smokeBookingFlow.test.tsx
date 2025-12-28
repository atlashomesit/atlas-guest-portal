import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
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

  const stubBrowserApis = () => {
    mockMatchMedia();
    window.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    (window as any).Razorpay = function RazorpayMock() {};
  };

  const mockFetch = () => {
    const response = new Response(JSON.stringify({ bookings: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    vi.spyOn(global, "fetch").mockImplementation(async () => response.clone());
  };

  const acceptDialogs = () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  };

  const navigateToPropertyFromSearch = async () => {
    act(() => {
      window.history.pushState({}, "", "/homes/atlas-penthouse-501/501");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(window.location.pathname).toMatch(/\/homes\//), { timeout: 5000 });
  };

  const completeReserveForm = async () => {
    await screen.findByLabelText(/Email/i, undefined, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "smoke@example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByLabelText(/I agree to the Terms/i));

    await waitFor(() => expect(screen.getByRole("button", { name: /book now/i })).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /book now/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/reserve"), { timeout: 5000 });
    await waitFor(
      () => expect(screen.getByRole("button", { name: /Confirm & contact concierge/i })).toBeEnabled(),
      { timeout: 5000 },
    );
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.pushState({}, "", "/");
    stubBrowserApis();
    mockFetch();
    acceptDialogs();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("hero CTA path reaches reserve placeholder", async () => {
    render(<App />);

    const heroWidget = await screen.findByTestId("hero-widget");
    const primaryHeroCta = within(heroWidget).getByRole("button", { name: /check availability/i });
    fireEvent.click(primaryHeroCta);

    act(() => {
      window.history.pushState({}, "", "/search");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(window.location.pathname).toBe("/search"));
    await navigateToPropertyFromSearch();
    await completeReserveForm();
  });

  test("navbar book now path reaches reserve placeholder", async () => {
    render(<App />);

    const navbar = document.getElementById("navbar_container");
    expect(navbar).not.toBeNull();
    const navBookNow = within(navbar as HTMLElement).getByRole("button", { name: /book now/i });
    fireEvent.click(navBookNow);

    act(() => {
      window.history.pushState({}, "", "/search");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(window.location.pathname).toBe("/search"));
    await navigateToPropertyFromSearch();
    await completeReserveForm();
  });
});
