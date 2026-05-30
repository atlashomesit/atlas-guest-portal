import { render, screen, within } from "@testing-library/react";
import AboutPage from "@/pages/AboutPage";

describe("AboutPage", () => {
  it("renders mission, team, standards, and trust content", () => {
    render(<AboutPage />);

    expect(screen.getByTestId("mission-section")).toBeInTheDocument();
    expect(screen.getByTestId("hospitality-section")).toBeInTheDocument();
    expect(screen.getByTestId("team-section")).toBeInTheDocument();
    expect(screen.getByTestId("trust-section")).toBeInTheDocument();

    const hospitalityCards = within(screen.getByTestId("hospitality-section")).getAllByRole("article");
    expect(hospitalityCards).toHaveLength(4);

    const trustBadges = within(screen.getByTestId("trust-section")).getAllByRole("article");
    expect(trustBadges).toHaveLength(4);
  });

  it("sets descriptive SEO metadata", () => {
    render(<AboutPage />);

    const descriptionMeta = document.head.querySelector("meta[name='description']");
    expect(descriptionMeta?.getAttribute("content")).toContain("Atlas Homestays");
    expect(document.title).toContain("About Atlas Homestays");
  });

  it("matches the snapshot", () => {
    const { container } = render(<AboutPage />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
