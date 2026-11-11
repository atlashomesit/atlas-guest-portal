import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SupportWidgetTrigger from "./SupportWidgetTrigger";

const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

describe("SupportWidgetTrigger accessible name (axe label-content-name-mismatch, TASK-1188)", () => {
  it("accessible name contains and starts with the visible text", () => {
    render(<SupportWidgetTrigger bottomSpacing="1rem" onOpen={() => {}} />);
    const button = screen.getByTestId("support-widget-trigger");
    const visible = normalise(button.textContent ?? "");
    const name = normalise(button.getAttribute("aria-label") ?? "");
    expect(visible).toContain("chat with us");
    // Punctuation is ignored by axe's comparison.
    const strip = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, ""); // jsdom textContent has no space between the label and helper spans
    expect(strip(name).startsWith(strip(visible))).toBe(true);
  });
});
