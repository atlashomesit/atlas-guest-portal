import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Terms from "./Terms";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    NavLink: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Link: ({ children, to }: { children: React.ReactNode; to?: string }) => <a href={to ?? "#"}>{children}</a>,
    useLocation: () => ({ pathname: "/terms" }),
  };
});

describe("Terms", () => {
  it("renders the Terms & Conditions page with key headings", () => {
    render(
      <Terms />
    );

    expect(screen.getByRole("heading", { name: /Terms of Service \| Atlas Guest Portal/i })).toBeInTheDocument();
    expect(screen.getByText(/Print-friendly view/i)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(1);
    expect(screen.getByText(/Payment data sharing/i)).toBeInTheDocument();
  });
});
