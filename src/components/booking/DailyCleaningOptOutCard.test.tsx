import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DailyCleaningOptOutCard from "./DailyCleaningOptOutCard";

describe("DailyCleaningOptOutCard (BNB-035)", () => {
  it("renders daily, fresh towels only, and skip cleaning options", () => {
    const html = renderToStaticMarkup(<DailyCleaningOptOutCard bookingToken="tok-123" />);
    expect(html).toContain("Standard daily cleaning");
    expect(html).toContain("Fresh towels only");
    expect(html).toContain("Skip cleaning");
  });
});
