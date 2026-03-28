import { fireEvent, render, screen } from "@testing-library/react";
import GalleryPage from "../src/pages/GalleryPage";
import { propertyData, propertyImages } from "../src/data/propertyData";
import { filterGuestImageUrls } from "../src/utils/guestImageUrl";

const findPropertyImages = (id: number) => {
  const fallbackImages = propertyData.find((property) => property.id === id)?.property_img ?? [];
  return propertyImages[String(id)] ?? fallbackImages;
};

/** Catalog uses Azure blob URLs (blocked in UI); gallery shows one placeholder tile per property when none remain. */
const expectedGalleryTilesForProperty = (id: number) => {
  const allowed = filterGuestImageUrls(findPropertyImages(id));
  return allowed.length > 0 ? allowed.length : 1;
};

describe("GalleryPage", () => {
  it("renders images from the property catalog", () => {
    const { asFragment } = render(<GalleryPage />);

    const thumbnails = screen.getAllByRole("img", { name: /photo|no photo/i });
    expect(thumbnails.length).toBeGreaterThan(0);
    expect(asFragment()).toMatchSnapshot();
  });
  it("filters down to a selected property", () => {
    render(<GalleryPage />);

    const selector = screen.getByLabelText(/filter by property/i);
    fireEvent.change(selector, { target: { value: "101" } });

    const expectedCount = expectedGalleryTilesForProperty(101);
    const visibleImages = screen.getAllByRole("img", { name: /room 101.*photo/i });

    expect(visibleImages).toHaveLength(expectedCount);
  });
});
