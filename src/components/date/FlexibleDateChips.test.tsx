import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FlexibleDateChips,
  FLEXIBLE_DATE_OPTIONS,
  formatShortDateWindow,
} from "./FlexibleDateChips";

describe("FlexibleDateChips (GUEST-095)", () => {
  it("renders all 4 flexibility options and selects the clicked mode", () => {
    const onChange = vi.fn();
    render(<FlexibleDateChips value="exact" onChange={onChange} />);

    for (const opt of FLEXIBLE_DATE_OPTIONS) {
      expect(screen.getByTestId(`flex-date-chip-${opt.value}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("flex-date-chip-exact")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("flex-date-chip-plus_minus_3"));
    expect(onChange).toHaveBeenCalledWith("plus_minus_3");

    fireEvent.click(screen.getByTestId("flex-date-chip-any_weekend"));
    expect(onChange).toHaveBeenCalledWith("any_weekend");
  });

  it("formats same-month and cross-month date windows cleanly", () => {
    expect(formatShortDateWindow("2026-12-12", "2026-12-14")).toBe("12–14 Dec");
    expect(formatShortDateWindow("2026-12-30", "2027-01-02")).toBe("30 Dec – 2 Jan");
  });
});
