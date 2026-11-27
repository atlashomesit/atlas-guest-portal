import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BedPrivacyFilterChips, {
  applyBedPrivacyToSearchParams,
  parseBedPrivacyFromSearch,
} from "./BedPrivacyFilterChips";

describe("BedPrivacyFilterChips (MKT-074)", () => {
  it("round-trips bed and privacy filters through URLSearchParams", () => {
    const params = applyBedPrivacyToSearchParams(new URLSearchParams("city=Goa"), {
      bedType: "twin",
      bathroomPrivacy: "private",
      roomPrivacy: "private_room",
    });
    expect(params.get("bedType")).toBe("twin");
    expect(params.get("bathroomPrivacy")).toBe("private");
    expect(params.get("roomPrivacy")).toBe("private_room");
    expect(parseBedPrivacyFromSearch(`?${params.toString()}`)).toEqual({
      bedType: "twin",
      bathroomPrivacy: "private",
      roomPrivacy: "private_room",
    });
  });

  it("renders all 7 bed and privacy filter chips", () => {
    const html = renderToStaticMarkup(
      <BedPrivacyFilterChips
        value={{ bedType: "double", bathroomPrivacy: "", roomPrivacy: "entire_place" }}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("Twin beds");
    expect(html).toContain("Double/King bed");
    expect(html).toContain("Private bathroom");
    expect(html).toContain("Shared dorm bed");
  });
});
