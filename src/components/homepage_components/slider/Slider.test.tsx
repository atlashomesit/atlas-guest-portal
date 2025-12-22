import React from "react";
import { addDays, format } from "date-fns";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("react-router-dom", async () => {
  const actual = await import("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import Slider from "./Slider";
import * as analytics from "../../../utils/analytics";

const renderSlider = () =>
  render(
    <MemoryRouter>
      <Slider />
    </MemoryRouter>,
  );

describe("Slider hero search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-22T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
  });

  it("renders hero overlay and trust microcopy", () => {
    renderSlider();
    const overlay = screen.getByTestId("hero-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.backgroundImage).toMatch(/linear-gradient/i);
    expect(screen.getByText(/book with confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/instant confirmation • secure payments • no hidden charges/i)).toBeInTheDocument();
  });

  it("shows CTA hierarchy with primary button and secondary link", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
    const browseLink = screen.getByRole("link", { name: /browse listings/i });
    expect(browseLink.tagName.toLowerCase()).toBe("a");
  });

  it("updates summary and tracks search when a date range is selected", () => {
    renderSlider();

    const startDate = addDays(new Date(), 5);
    const endDate = addDays(startDate, 2);

    const startTestId = `hero-date-${format(startDate, "yyyy-MM-dd")}`;
    const endTestId = `hero-date-${format(endDate, "yyyy-MM-dd")}`;

    fireEvent.click(screen.getByTestId("hero-date-toggle"));
    fireEvent.click(screen.getAllByTestId(startTestId)[0]);
    fireEvent.click(screen.getAllByTestId(endTestId)[0]);

    expect(screen.getAllByText(/guests/i).length).toBeGreaterThan(0);

    const trackSpy = vi.spyOn(analytics, "trackEvent");
    const submitButton = screen.getByRole("button", { name: /check availability/i });
    fireEvent.click(submitButton);

    expect(trackSpy).toHaveBeenCalledWith(
      "availability_search",
      expect.objectContaining({ surface: "hero_form" }),
      expect.anything(),
    );
  });

  it("shows exactly three high-signal trust badges", () => {
    renderSlider();
    const trustBadges = screen.getByTestId("trust-badges");
    expect(trustBadges).toBeInTheDocument();
    expect(screen.getByText(/verified homes/i)).toBeInTheDocument();
    expect(screen.getByText(/secure razorpay payments/i)).toBeInTheDocument();
    expect(screen.getByText(/no hidden fees/i)).toBeInTheDocument();
    expect(trustBadges).not.toHaveTextContent(/flexible cancellation/i);
    expect(trustBadges.querySelectorAll(".rb-trust-badge").length).toBe(3);
  });
});
