import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DormMaxStayNotice from "./DormMaxStayNotice";

describe("DormMaxStayNotice (HSL-036)", () => {
  it("renders plain-English rolling max dorm stay notice and warning when exceeded", () => {
    const html = renderToStaticMarkup(
      <DormMaxStayNotice maxNights={14} rollingWindowDays={30} requestedNights={16} />,
    );
    expect(html).toContain("14 nights");
    expect(html).toContain("30-day");
    expect(html).toContain("16 nights");
  });
});
