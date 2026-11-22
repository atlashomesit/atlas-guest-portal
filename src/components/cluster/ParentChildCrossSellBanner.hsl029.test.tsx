import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import { ParentChildCrossSellBanner } from "./ParentChildCrossSellBanner";

afterEach(cleanup);

describe("HSL-029 ParentChildCrossSellBanner hostel whole-room wording", () => {
  const avail = {
    cause: "ChildrenBooked" as const,
    totalChildren: 2,
    unavailableChildren: 1,
    freeChildren: [{ listingId: 11, name: "6-Bed Mixed Dorm", nightlyRate: 600, currency: "INR", coverPhotoUrl: null, maxGuests: 6 }],
  };

  test("uses hostel dorm bed wording when isHostelWholeRoom is true", () => {
    render(
      <MemoryRouter>
        <ParentChildCrossSellBanner
          isParentCluster
          isUnavailable
          isHostelWholeRoom
          parentName="Hill Hostel"
          availability={avail}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cluster-cross-sell-headline").textContent).toBe(
      "Not free on these dates because some beds are booked.",
    );
    expect(screen.getByTestId("cluster-cross-sell-count").textContent).toContain("Beds are still free in the shared dorm");
  });

  test("keeps whole villa wording when isHostelWholeRoom is false", () => {
    render(
      <MemoryRouter>
        <ParentChildCrossSellBanner
          isParentCluster
          isUnavailable
          isHostelWholeRoom={false}
          parentName="Hill Villa"
          availability={avail}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cluster-cross-sell-headline").textContent).toContain("whole villa is taken");
  });
});
