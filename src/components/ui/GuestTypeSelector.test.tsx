import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { GuestTypeSelector, type GuestCounts } from "./GuestTypeSelector";

const INITIAL: GuestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };

function Harness() {
  const [value, setValue] = useState<GuestCounts>(INITIAL);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GuestTypeSelector
      value={value}
      onChange={setValue}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      onClose={() => setIsOpen(false)}
    />
  );
}

describe("GuestTypeSelector", () => {
  it("increments the adult guest count from the open dropdown", () => {
    render(<Harness />);

    const trigger = screen.getByTestId("hero-guest-toggle");
    expect(trigger).toHaveTextContent(/1 guest/i);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /increase adults/i }));

    expect(trigger).toHaveTextContent(/2 guests/i);
  });

  it("keeps the stepper dialog in the open trigger's stacking context", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("hero-guest-toggle"));

    const dropdown = screen.getByTestId("hero-guest-dropdown");
    expect(dropdown).toBeInTheDocument();
    expect(dropdown.className).toMatch(/pointer-events-auto/);
    expect(dropdown.className).toMatch(/z-\[80\]/);
    expect(screen.getByTestId("hero-guest-toggle").parentElement?.className).toMatch(/z-\[70\]/);
  });
});
