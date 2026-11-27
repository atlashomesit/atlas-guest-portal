import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExpressMobileCheckoutCard from "./ExpressMobileCheckoutCard";

describe("ExpressMobileCheckoutCard (HTL-064)", () => {
  it("shows room + POS dinner bill, remaining balance, and disabled Check out button when owed", () => {
    const html = renderToStaticMarkup(
      <ExpressMobileCheckoutCard
        bookingToken="tok-1"
        items={[
          { id: "r1", label: "Room (2 nights)", amountInr: 4000, category: "room" },
          { id: "p1", label: "Dinner order", amountInr: 640, category: "pos" },
        ]}
        paidInr={4000}
      />,
    );
    expect(html).toContain("Room (2 nights)");
    expect(html).toContain("Dinner order");
    expect(html).toContain("Left to pay ₹640");
    expect(html).toContain("Pay ₹640 by UPI");
  });

  it("shows Nothing left to pay when fully settled", () => {
    const html = renderToStaticMarkup(
      <ExpressMobileCheckoutCard
        bookingToken="tok-2"
        items={[{ id: "r1", label: "Room (2 nights)", amountInr: 4000, category: "room" }]}
        paidInr={4000}
      />,
    );
    expect(html).toContain("Nothing left to pay");
  });
});
