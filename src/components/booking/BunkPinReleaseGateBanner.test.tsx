import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BunkPinReleaseGateBanner from "./BunkPinReleaseGateBanner";

describe("BunkPinReleaseGateBanner (HSL-042)", () => {
  it("hides bunk label and door PIN until checked in with zero balance", () => {
    const locked = renderToStaticMarkup(
      <BunkPinReleaseGateBanner isCheckedIn={false} balanceDueInr={500} bunkLabel="Bunk 4B" doorPin="9482" />,
    );
    expect(locked).toContain("Bunk label &amp; door PIN locked until check-in");
    expect(locked).not.toContain("9482");

    const unlocked = renderToStaticMarkup(
      <BunkPinReleaseGateBanner isCheckedIn={true} balanceDueInr={0} bunkLabel="Bunk 4B" doorPin="9482" />,
    );
    expect(unlocked).toContain("Bunk 4B");
    expect(unlocked).toContain("9482");
  });
});
