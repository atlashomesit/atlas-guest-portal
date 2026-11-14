import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SupportWidget from "./SupportWidget";
import { SupportTriggerSlot, SupportTriggerSlotProvider } from "../support-drawer/SupportTriggerSlot";

function Composition() {
  const [slot, setSlot] = useState(true);
  const [placement, setPlacement] = useState<"search" | "inline" | "floating">("search");
  const navigate = useNavigate();
  return <>
    <div className="search-support-group">
      <div>Filters <button>Remove a long selected amenity</button></div>
      <label>Guests<input aria-label="Guests" defaultValue="2" /></label>
      {slot && <SupportTriggerSlot />}
    </div>
    <button onClick={() => setSlot((v) => !v)}>Toggle shell</button>
    <button onClick={() => setPlacement("inline")}>Confirmed empty</button>
    <button onClick={() => setPlacement("search")}>Search ready</button>
    <button onClick={() => { setPlacement("floating"); navigate("/homes/synthetic/991"); }}>Property</button>
    <SupportWidget placement={placement} />
  </>;
}

function mount() {
  return render(<MemoryRouter initialEntries={["/search?guests=2"]}>
    <SupportTriggerSlotProvider><Composition /></SupportTriggerSlotProvider>
  </MemoryRouter>);
}

const trigger = () => screen.getByRole("button", { name: /chat with us/i });
const open = () => { trigger().focus(); fireEvent.click(trigger()); return screen.getByRole("dialog", { name: /need a hand/i }); };

describe("B03 shared Search launcher composition", () => {
  it("uses one target after primary controls and keeps the same focused trigger across viewport rerenders", () => {
    mount();
    const button = trigger();
    expect(screen.getAllByTestId("support-widget-trigger")).toHaveLength(1);
    expect(within(screen.getByTestId("search-support-slot")).getByRole("button")).toBe(button);
    expect(screen.getByLabelText("Guests").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    button.focus();
    act(() => { window.dispatchEvent(new Event("resize")); });
    expect(trigger()).toBe(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("data-placement", "search");
    expect(button).not.toHaveStyle({ position: "fixed" });
  });

  it("keeps exactly one normal-flow fallback when the shell disappears and restores support focus only when owned", () => {
    mount();
    trigger().focus();
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(screen.getAllByTestId("support-widget-trigger")).toHaveLength(1);
    expect(trigger().closest(".search-support-fallback")).not.toBeNull();
    expect(trigger()).toHaveFocus();
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(within(screen.getByTestId("search-support-slot")).getByRole("button")).toHaveFocus();
    const guests = screen.getByLabelText("Guests");
    guests.focus();
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(guests).toHaveFocus();
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(guests).toHaveFocus();
  });

  it("preserves open drawer, callback draft and one owner through shell, empty and route transitions", () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("button", { name: /request callback/i }));
    const phone = screen.getByRole("textbox", { name: "Callback phone" });
    fireEvent.change(phone, { target: { value: "9876543210" } });
    const bottom = screen.getByRole("dialog").getAttribute("style");
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Callback phone" })).toHaveValue("9876543210");
    expect(screen.getByRole("dialog").getAttribute("style")).toBe(bottom);
    fireEvent.click(screen.getByText("Confirmed empty"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByText("Property"));
    expect(screen.getByRole("textbox", { name: "Callback phone" })).toHaveValue("9876543210");
    fireEvent.click(screen.getByText("Search ready"));
    fireEvent.click(screen.getByText("Toggle shell"));
    expect(screen.queryByTestId("support-widget-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("search-support-slot")).toBeEmptyDOMElement();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger().parentElement).toBe(screen.getByTestId("search-support-slot"));
  });

  it("keeps callback validation/error state and drawer offset independent of trigger placement", () => {
    mount();
    open();
    fireEvent.click(screen.getByRole("button", { name: /request callback/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Callback phone" }), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit number.");
    const style = screen.getByRole("dialog").getAttribute("style");
    expect(style).toContain("--pp-sticky-bar-offset");
    fireEvent.click(screen.getByText("Confirmed empty"));
    fireEvent.click(screen.getByText("Search ready"));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit number.");
    expect(screen.getByRole("textbox", { name: "Callback phone" })).toHaveValue("123");
    expect(screen.getByRole("dialog").getAttribute("style")).toBe(style);
    fireEvent.click(screen.getByLabelText(/close support widget/i));
    expect(trigger()).toHaveFocus();
  });
});
