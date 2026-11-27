import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DormGroupEnquiryBanner, { buildGroupEnquiryUrl } from "./DormGroupEnquiryBanner";

describe("DormGroupEnquiryBanner (HSL-035)", () => {
  it("renders group enquiry CTA when requested beds exceed max online limit", () => {
    const html = renderToStaticMarkup(
      <DormGroupEnquiryBanner
        requestedBeds={8}
        maxOnlineBeds={6}
        propertyName="Zostel Goa Demo"
        checkIn="2026-12-10"
        checkOut="2026-12-13"
      />,
    );
    expect(html).toContain("Booking 8 dorm beds?");
    expect(html).toContain("up to 6 beds");
    expect(html).toContain("Send prefilled group enquiry");
    expect(buildGroupEnquiryUrl("/contact", { beds: 8, propertyName: "Zostel Goa Demo" })).toContain("beds=8");
  });

  it("renders nothing when within online bed limit", () => {
    const html = renderToStaticMarkup(
      <DormGroupEnquiryBanner requestedBeds={4} maxOnlineBeds={6} propertyName="Zostel Goa Demo" />,
    );
    expect(html).toBe("");
  });
});
