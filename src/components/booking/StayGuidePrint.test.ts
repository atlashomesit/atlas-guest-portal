import { describe, expect, test } from "vitest";
import {
  buildReceiptHtml,
  buildStayGuideHtml,
  type StayGuidePrintArgs,
} from "./StayGuidePrint";

const baseArgs: StayGuidePrintArgs = {
  bookingId: 102057,
  guestName: "Anita Tester",
  propertyName: "Lakeview Villa",
  listingName: "Lakeview Villa — Premium Suite",
  checkinDate: "2026-10-12",
  checkoutDate: "2026-10-15",
  nights: 3,
  propertyAddress: "12 Lake View Road, Hyderabad",
  propertyPhone: "+919999999999",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  wifiVisible: true,
  wifiName: "Lakeview Guest",
  wifiPassword: "Welcome2026",
  checkinInstructions: "Self check-in. Lockbox code shared on arrival day.",
  brandName: "Atlas Stays",
  fallbackPhone: "+918000000000",
  fallbackEmail: "support@atlaspms.in",
  currency: "INR",
  totalAmount: 18499,
  gstInvoiceNumber: "ATL-INV-9001",
  guidebookCheckoutChecklistText: "Strip beds. Take out trash. Return keys.",
  guidebookTrashParkingText: "Bins behind the kitchen door. One parking spot on the right.",
  nearbyLandmarks: ["Lake Park — 5 min walk", "Cafe Lotus — 200 m"],
};

describe("StayGuidePrint — TASK-102057 receipt + stay guide", () => {
  test("receipt html carries booking id, brand, dates and total", () => {
    const html = buildReceiptHtml(baseArgs);
    expect(html).toContain("Stay Receipt");
    expect(html).toContain("Atlas Stays");
    expect(html).toContain("#102057");
    expect(html).toContain("Anita Tester");
    expect(html).toContain("2026-10-12");
    expect(html).toContain("2026-10-15");
    expect(html).toContain("3 nights");
    expect(html).toContain("12 Lake View Road, Hyderabad");
    expect(html).toContain("ATL-INV-9001");
    expect(html).toContain("₹18,499");
    expect(html).toContain("@media print");
  });

  test("receipt html escapes user-supplied property name to block injection", () => {
    const xss: StayGuidePrintArgs = {
      ...baseArgs,
      propertyName: "<script>alert('xss')</script>",
    };
    const html = buildReceiptHtml(xss);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  test("stay guide html carries WiFi, house rules, directions and host contacts", () => {
    const html = buildStayGuideHtml(baseArgs);
    expect(html).toContain("Stay Guide");
    expect(html).toContain("Lakeview Guest");
    expect(html).toContain("Welcome2026");
    expect(html).toContain("Self check-in. Lockbox code shared on arrival day.");
    expect(html).toContain("12 Lake View Road, Hyderabad");
    expect(html).toContain("maps/search/?api=1");
    expect(html).toContain("Lake Park");
    expect(html).toContain("Strip beds.");
    expect(html).toContain("Bins behind the kitchen door");
    expect(html).toContain("+919999999999");
    expect(html).toContain("support@atlaspms.in");
    expect(html).toContain("@media print");
  });

  test("stay guide hides WiFi block when wifiVisible is false", () => {
    const html = buildStayGuideHtml({ ...baseArgs, wifiVisible: false });
    expect(html).not.toContain("Lakeview Guest");
    expect(html).not.toContain("Welcome2026");
    expect(html).not.toMatch(/<h2>\s*WiFi\s*<\/h2>/i);
  });

  test("stay guide falls back to tenant email/phone when property phone missing", () => {
    const html = buildStayGuideHtml({
      ...baseArgs,
      propertyPhone: "",
      fallbackPhone: "+918000000000",
      fallbackEmail: "support@atlaspms.in",
    });
    expect(html).toContain("+918000000000");
    expect(html).toContain("support@atlaspms.in");
  });

  test("stay guide still renders when only directions are present", () => {
    const html = buildStayGuideHtml({
      ...baseArgs,
      checkinInstructions: "",
      guidebookCheckoutChecklistText: "",
      guidebookTrashParkingText: "",
      wifiVisible: false,
      wifiName: undefined,
      wifiPassword: undefined,
      nearbyLandmarks: undefined,
    });
    expect(html).toContain("12 Lake View Road, Hyderabad");
    expect(html).toContain("Stay Guide");
  });
});