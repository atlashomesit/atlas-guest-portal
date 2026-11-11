import { render, screen, within } from "@testing-library/react";
import AboutPage from "@/pages/AboutPage";
import { MARKETPLACE_BRAND_BASELINE } from "@/tenant/displayBrand";
import { lucideOwnedMarkup, withStableIcons } from "@/test/stableIconMarkup";

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
    expect(descriptionMeta?.getAttribute("content")).toContain(MARKETPLACE_BRAND_BASELINE);
    expect(document.title).toContain(`About ${MARKETPLACE_BRAND_BASELINE}`);
  });

  it("matches the snapshot", () => {
    const { container } = render(<AboutPage />);
    // TASK-103194: this snapshot flipped ten times in five weeks (2026-09-04 to 2026-10-10) on lucide-react's own markup:
    // glyph paths and alias class names that differ between lucide versions and between stale and fresh installs, never
    // on our code. It stores each icon as the stable marker from src/test/stableIconMarkup.ts, and asserts nothing
    // lucide owns is left in it.
    const stable = withStableIcons(container.firstChild as Element);
    expect(lucideOwnedMarkup(stable.outerHTML)).toEqual([]);
    expect(stable).toMatchSnapshot();
  });
});
