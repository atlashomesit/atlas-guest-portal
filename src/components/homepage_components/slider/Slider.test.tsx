import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    MemoryRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
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
    expect(screen.getByText(/instant confirmation • razorpay secure • no hidden charges/i)).toBeInTheDocument();
  });

  it("shows CTA hierarchy with primary button and secondary link", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
    const browseLink = screen.getByRole("link", { name: /browse listings/i });
    expect(browseLink.tagName.toLowerCase()).toBe("a");
  });

  it("shows validation when check-out is not after check-in", async () => {
    renderSlider();

    const checkInInput = screen.getByLabelText(/check-in/i);
    const checkOutInput = screen.getByLabelText(/check-out/i);

    fireEvent.change(checkInInput, { target: { value: "2025-01-10" } });
    fireEvent.change(checkOutInput, { target: { value: "2025-01-09" } });

    const form = checkInInput.closest("form");
    form?.setAttribute("novalidate", "true");

    if (!form) throw new Error("Form not found");
    const trackSpy = vi.spyOn(analytics, "trackEvent");
    fireEvent.submit(form);

    expect(trackSpy).not.toHaveBeenCalledWith(
      "availability_search",
      expect.anything(),
      expect.anything(),
    );
  });
});
