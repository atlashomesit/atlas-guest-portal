import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PreArrivalRoomPreferencesCard from "./PreArrivalRoomPreferencesCard";

describe("PreArrivalRoomPreferencesCard (BNB-036)", () => {
  it("renders bed setup, extra pillows, baby crib, and ground-floor controls", () => {
    const html = renderToStaticMarkup(<PreArrivalRoomPreferencesCard />);
    expect(html).toContain("Preferred bed setup");
    expect(html).toContain("Extra pillows");
    expect(html).toContain("Baby crib / cot");
    expect(html).toContain("Ground-floor / step-free access");
  });
});
