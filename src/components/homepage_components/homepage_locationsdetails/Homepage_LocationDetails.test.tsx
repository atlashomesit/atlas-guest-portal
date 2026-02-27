import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it } from "vitest";

import Homepage_LocationDetails from "./Homepage_LocationDetails";

describe("Homepage_LocationDetails", () => {
  it("renders the coming soon fallback when no location data is provided", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/property_LocationDetails/unknown" }]}>
        <Routes>
          <Route path="/property_LocationDetails/:id" element={<Homepage_LocationDetails />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Exciting Properties Arriving Soon!")).toBeInTheDocument();
  });
});
