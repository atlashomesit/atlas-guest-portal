import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import GalleryPage from "../src/pages/GalleryPage";
import { propertyData } from "../src/data/propertyData";
import { filterGuestImageUrls } from "../src/utils/guestImageUrl";

vi.mock("../src/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    listings: [],
    properties: propertyData.map((p) => ({
      id: p.id,
      listingId: p.listingId,
      property_name: p.property_name,
      property_location: p.property_location,
      property_img: p.property_img ?? [],
    })),
    state: "success" as const,
    refetch: async () => {},
  }),
}));

const findPropertyImages = (id: number) => {
  return propertyData.find((property) => property.id === id)?.property_img ?? [];
};

/** Total gallery tiles: allowlisted listing URLs per property, or one fallback tile when empty. */
const expectedGalleryTileCount = () =>
  propertyData.reduce((sum, property) => {
    const images = filterGuestImageUrls(property.property_img ?? []);
    return sum + (images.length > 0 ? images.length : 1);
  }, 0);

/** Tile count for one property after guest URL filtering (matches GalleryPage). */
const expectedGalleryTilesForProperty = (id: number) => {
  const allowed = filterGuestImageUrls(findPropertyImages(id));
  return allowed.length > 0 ? allowed.length : 1;
};

describe("GalleryPage", () => {
  it("renders images from the property catalog", () => {
    render(<GalleryPage />);

    const thumbnails = screen.getAllByRole("img", { name: /photo|no photo/i });
    const total = expectedGalleryTileCount();
    expect(thumbnails.length).toBeGreaterThan(0);
    expect(thumbnails).toHaveLength(total);

    const allHomes = screen.getByRole("button", { name: /all homes/i });
    expect(allHomes).toHaveTextContent(`(${total})`);
  }, 30_000);

  it("filters down to a selected property", () => {
    render(<GalleryPage />);

    const selector = screen.getByLabelText(/filter by property/i);
    fireEvent.change(selector, { target: { value: "101" } });

    const expectedCount = expectedGalleryTilesForProperty(101);
    const visibleImages = screen.getAllByRole("img", { name: /room 101.*photo/i });

    expect(visibleImages).toHaveLength(expectedCount);
  });
});
