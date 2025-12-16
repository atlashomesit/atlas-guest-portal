import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Terms from "./Terms";

describe("Terms", () => {
  it("renders the Terms & Conditions page with key headings", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/terms" }]}> 
        <Routes>
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Terms of Service \| Atlas Guest Portal/i })).toBeInTheDocument();
    expect(screen.getByText(/Print-friendly view/i)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(1);
    expect(screen.getByText(/Payment data sharing/i)).toBeInTheDocument();
  });
});
