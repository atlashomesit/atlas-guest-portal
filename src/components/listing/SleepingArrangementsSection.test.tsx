import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SleepingArrangementsSection } from "./SleepingArrangementsSection";

describe("SleepingArrangementsSection (GUEST-097)", () => {
  it("hides cleanly when bedroomsConfig is null or empty", () => {
    const { container: c1 } = render(<SleepingArrangementsSection bedroomsConfig={null} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<SleepingArrangementsSection bedroomsConfig={[]} />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders multi-bedroom and common-area cards with human-readable bed lists and photo", () => {
    render(
      <SleepingArrangementsSection
        bedroomsConfig={[
          {
            bedroomNumber: 1,
            beds: [{ bedType: "king", count: 1 }],
            photoUrl: "https://example.com/bedroom1.jpg",
          },
          {
            label: "Living room",
            beds: [
              { bedType: "sofa_bed", count: 1 },
              { bedType: "single", count: 2 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByTestId("sleeping-arrangements-section")).toBeInTheDocument();
    expect(screen.getByText("Where you'll sleep")).toBeInTheDocument();

    const card0 = screen.getByTestId("sleeping-room-card-0");
    expect(card0).toHaveTextContent("Bedroom 1");
    expect(card0).toHaveTextContent("1 king bed");
    expect(card0.querySelector("img")).toHaveAttribute("src", "https://example.com/bedroom1.jpg");

    const card1 = screen.getByTestId("sleeping-room-card-1");
    expect(card1).toHaveTextContent("Living room");
    expect(card1).toHaveTextContent("1 sofa bed, 2 single beds");
  });

  it("parses JSON string bedroomsConfig cleanly", () => {
    render(
      <SleepingArrangementsSection
        bedroomsConfig={JSON.stringify([
          { bedroomNumber: 1, beds: [{ bedType: "queen", count: 1 }] },
        ])}
      />,
    );
    expect(screen.getByTestId("sleeping-room-card-0")).toHaveTextContent("1 queen bed");
  });
});
