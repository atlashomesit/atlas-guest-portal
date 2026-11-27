import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RoomTaggedPhotoGallery from "./RoomTaggedPhotoGallery";

describe("RoomTaggedPhotoGallery (CLU-041)", () => {
  it("renders room filter tabs and bedroom bed-setup labels", () => {
    const html = renderToStaticMarkup(
      <RoomTaggedPhotoGallery
        photos={[
          {
            id: "p1",
            url: "https://cdn.example/b1.jpg",
            roomLabel: "Master Bedroom",
            bedSetupLabel: "1 King bed · Attached bath",
            caption: "Pool view balcony",
          },
          {
            id: "p2",
            url: "https://cdn.example/b2.jpg",
            roomLabel: "Bedroom 2",
            bedSetupLabel: "2 Twin beds",
          },
        ]}
      />,
    );
    expect(html).toContain("Master Bedroom");
    expect(html).toContain("1 King bed · Attached bath");
    expect(html).toContain("Bedroom 2");
    expect(html).toContain("2 Twin beds");
  });
});
