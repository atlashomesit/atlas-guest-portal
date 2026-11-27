import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BunkPreferenceSelector from "./BunkPreferenceSelector";

describe("BunkPreferenceSelector (HSL-044)", () => {
  it("renders lower and upper bunk options with optional lower bunk fee", () => {
    const html = renderToStaticMarkup(
      <BunkPreferenceSelector value="lower" lowerBunkFeeInr={150} onChange={() => {}} />,
    );
    expect(html).toContain("Lower bunk");
    expect(html).toContain("Upper bunk");
    expect(html).toContain("₹150");
  });
});
