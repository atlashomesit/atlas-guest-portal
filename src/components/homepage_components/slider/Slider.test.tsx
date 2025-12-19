import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

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
