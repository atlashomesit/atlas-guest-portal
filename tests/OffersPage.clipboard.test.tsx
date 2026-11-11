import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OffersPage from "../src/pages/OffersPage";

vi.mock("../src/hooks/useTenantListings", () => ({
  useTenantListings: () => ({ properties: [], state: "success", refetch: vi.fn() }),
}));
vi.mock("../src/hooks/useAdvertisedPromoActive", () => ({ useAdvertisedPromoActive: () => "active" }));
vi.mock("../src/hooks/useAbSuggest", () => ({ useAbSuggest: () => ({ status: "idle" }) }));

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const writeText = vi.fn();
const scrollIntoView = vi.fn();
const copyButton = () => screen.getByRole("button", { name: /^DIRECT5 (Copy|Copied!) promo code$/ });
const clickCopy = async () => { await act(async () => { fireEvent.click(copyButton()); }); };

describe("approved DIRECT5 clipboard recovery (UXD-2026-11-03-05-A)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset();
    scrollIntoView.mockReset();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

  it("reports denied copying truthfully and selects the exact readonly code for manual copying", async () => {
    writeText.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    render(<OffersPage />);
    await clickCopy();
    expect(writeText).toHaveBeenCalledWith("DIRECT5");
    expect(copyButton()).not.toHaveTextContent("Copied!");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not copy the code. Select it below and copy it manually.");
    const input = screen.getByRole("textbox", { name: "Promo code to copy" }) as HTMLInputElement;
    expect(input).toHaveValue("DIRECT5");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7]);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
    input.blur();
    input.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "Select code" }));
    expect(input).toHaveFocus();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7]);
    expect(copyButton()).not.toHaveTextContent("Copied!");
  });

  it("offers manual copying when the Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<OffersPage />);
    await clickCopy();
    expect(screen.getByRole("textbox", { name: "Promo code to copy" })).toHaveValue("DIRECT5");
    expect(copyButton()).not.toHaveTextContent("Copied!");
  });

  it("waits for success, removes the failed fallback on retry, and resets Copied after two seconds", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<OffersPage />);
    await clickCopy();
    let finishCopy!: () => void;
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => { finishCopy = resolve; }));
    await clickCopy();
    expect(copyButton()).not.toHaveTextContent("Copied!");
    await act(async () => { finishCopy(); });
    expect(copyButton()).toHaveTextContent("Copied!");
    expect(screen.queryByRole("textbox", { name: "Promo code to copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1999); });
    expect(copyButton()).toHaveTextContent("Copied!");
    act(() => { vi.advanceTimersByTime(1); });
    expect(copyButton()).not.toHaveTextContent("Copied!");
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("keeps a new failure visible after an earlier successful copy and preserves the promo checker draft", async () => {
    writeText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    render(<OffersPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Promo code", exact: true }), { target: { value: "SUMMER25" } });
    await clickCopy();
    act(() => { vi.advanceTimersByTime(1000); });
    await clickCopy();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(copyButton()).not.toHaveTextContent("Copied!");
    expect(screen.getByRole("textbox", { name: "Promo code to copy" })).toHaveValue("DIRECT5");
    expect(screen.getByRole("textbox", { name: "Promo code", exact: true })).toHaveValue("SUMMER25");
  });
  it("cancels the pending success reset when the offer unmounts", async () => {
    writeText.mockResolvedValue(undefined);
    const { unmount } = render(<OffersPage />);
    const existingTimers = vi.getTimerCount();
    await clickCopy();
    expect(copyButton()).toHaveTextContent("Copied!");
    expect(vi.getTimerCount()).toBe(existingTimers + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(existingTimers);
  });

});
