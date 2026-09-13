import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AccessibilitySection from "./AccessibilitySection";
import { ACCESSIBILITY_UNKNOWN_COPY } from "../../utils/amenityCodes";

describe("AccessibilitySection (TASK-10086)", () => {
  it("lists declared features and adds no verification badge or claim", () => {
    render(<AccessibilitySection codes={["step_free_entrance", "wifi", "ELEVATOR"]} />);

    const section = screen.getByTestId("property-accessibility-section");
    expect(section).toHaveTextContent(/step-free entrance/i);
    expect(section).toHaveTextContent(/lift\/elevator access/i);
    // No positive certification: the honest "not verified" disclaimer is allowed.
    expect(section).not.toHaveTextContent(/verified (stay|accessible|accessibility)/i);
    expect(section).not.toHaveTextContent(/certified/i);
    expect(section).not.toHaveTextContent(/fully accessible/i);
    expect(section).not.toHaveTextContent(new RegExp(ACCESSIBILITY_UNKNOWN_COPY, "i"));
  });

  it("renders the exact unknown-state copy and never labels unknown as accessible", () => {
    render(<AccessibilitySection codes={["wifi"]} />);

    const section = screen.getByTestId("property-accessibility-section");
    expect(section).toHaveTextContent(ACCESSIBILITY_UNKNOWN_COPY);
    expect(section.textContent ?? "").not.toMatch(/accessible(?! parking)/i);
  });

  it("renders the unknown-state copy when no codes exist at all", () => {
    render(<AccessibilitySection codes={[]} />);

    expect(screen.getByTestId("property-accessibility-section")).toHaveTextContent(
      ACCESSIBILITY_UNKNOWN_COPY,
    );
  });
});
