import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "../../../components/ErrorBoundary";
import { BookingProvider } from "../../../contexts/BookingContext";
import Home from "../Home";

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock("react-date-range", () => ({
  DateRange: (props: { className?: string }) => (
    <div data-testid="date-range" className={props.className}>
      Date Picker
    </div>
  ),
}));

describe("Home route", () => {
  it("renders without triggering the home-route error boundary", () => {
    render(
      <BookingProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary name="home-route">
                  <Home />
                </ErrorBoundary>
              }
            />
          </Routes>
        </MemoryRouter>
      </BookingProvider>,
    );

    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    // Home should show some main content
    expect(document.body.textContent).toMatch(/Atlas|Homestays|apartments|Hyderabad/i);
  });
});
