import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import SupportWidget from "./SupportWidget";
import { OPEN_SUPPORT_EVENT } from "../property/propertyHelpEvents";

vi.mock("react-icons/fi", () => ({
  FiMessageCircle: () => <svg data-testid="icon-message" />,
  FiHelpCircle: () => <svg data-testid="icon-help" />,
  FiPhone: () => <svg data-testid="icon-phone" />,
  FiPhoneCall: () => <svg data-testid="icon-phonecall" />,
  FiX: () => <svg data-testid="icon-close" />,
}));

vi.mock("react-icons/fa", () => ({
  FaWhatsapp: () => <svg data-testid="icon-whatsapp" />,
}));

describe("SupportWidget opened from the phone sticky bar (TOP10 review fix G2)", () => {
  it("positions the drawer above the sticky bar by reading the bar's published height", () => {
    render(
      <MemoryRouter initialEntries={["/homes/stub-house/9001"]}>
        <SupportWidget />
      </MemoryRouter>,
    );
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT));
    });
    const dialog = screen.getByRole("dialog", { name: /need a hand/i });
    // jsdom's CSS parser may drop calc(var()) from .style, so read the attribute React rendered.
    const style = dialog.getAttribute("style") ?? "";
    expect(style).toContain("--pp-sticky-bar-offset");
    expect(style).toMatch(/bottom:\s*calc\(/);
  });
});
