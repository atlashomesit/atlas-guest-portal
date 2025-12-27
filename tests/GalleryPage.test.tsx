import { fireEvent, render, screen } from "@testing-library/react";
import GalleryPage from "../src/pages/GalleryPage";
import { propertyData, propertyImages } from "../src/data/propertyData";

const findPropertyImages = (id: number) => {
  const fallbackImages = propertyData.find((property) => property.id === id)?.property_img ?? [];
  return propertyImages[String(id)] ?? fallbackImages;
};

describe("GalleryPage", () => {
  it("renders images from the property catalog", () => {
    const { asFragment } = render(<GalleryPage />);

    const thumbnails = screen.getAllByRole("img", { name: /photo/i });
    expect(thumbnails.length).toBeGreaterThan(0);
    expect(asFragment()).toMatchSnapshot();
  });

  it("filters down to a selected property", () => {
    render(<GalleryPage />);

    const selector = screen.getByLabelText(/filter by property/i);
    fireEvent.change(selector, { target: { value: "101" } });

    const expectedCount = findPropertyImages(101).length;
    const visibleImages = screen.getAllByRole("img", { name: /atlas homes room 101 photo/i });

    expect(visibleImages).toHaveLength(expectedCount);
  });
});
