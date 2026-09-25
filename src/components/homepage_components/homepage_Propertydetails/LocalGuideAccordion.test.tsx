import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import LocalGuideAccordion, {
  categorizeNearPlace,
  groupNearPlaces,
  parseNearPlace,
} from "./LocalGuideAccordion";

const SAMPLE_PLACES = [
  "Inorbit Mall (3 km)",
  "Cyber Towers (2 km)",
  "Hitech City Metro (2.5 km)",
  "Durgam Cheruvu Lake",
];

describe("LocalGuideAccordion (TASK-102117)", () => {
  it("renders the local guide section with categorized recommendations", () => {
    render(<LocalGuideAccordion places={SAMPLE_PLACES} />);

    const section = screen.getByTestId("property-local-guide-section");
    expect(section).toHaveTextContent(/explore the neighborhood/i);
    // Keyword-bucketed categories from the real source strings.
    expect(section).toHaveTextContent(/shopping/i);
    expect(section).toHaveTextContent(/getting around/i);
  });

  it("displays the travel distance exactly as listed (e.g. '3 km away')", () => {
    render(<LocalGuideAccordion places={SAMPLE_PLACES} />);

    // Single-open accordion: walk the categories until the spot is visible.
    const toggles = screen.getAllByTestId(/local-guide-category-/);
    let found = false;
    for (const toggle of toggles) {
      if (toggle.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(toggle);
      }
      const panel = document.getElementById(
        toggle.getAttribute("aria-controls") ?? "",
      );
      if (panel && within(panel).queryByText("Inorbit Mall")) {
        expect(within(panel).getByText("3 km away")).toBeDefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("never invents a distance for entries that carry none", () => {
    render(<LocalGuideAccordion places={["Durgam Cheruvu Lake"]} />);

    const spot = screen.getByTestId("local-guide-spot");
    expect(within(spot).getByText("Durgam Cheruvu Lake")).toBeDefined();
    // No "away" copy anywhere — the distance is unknown, not zero.
    expect(spot.textContent ?? "").not.toMatch(/away/i);
  });

  it("behaves as an accordion: first category open, toggles expand/collapse", () => {
    render(<LocalGuideAccordion places={SAMPLE_PLACES} />);

    const first = screen.getByTestId("local-guide-category-0");
    const second = screen.getByTestId("local-guide-category-1");
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("omits the whole section when the property has no nearby-places data", () => {
    const { container: empty } = render(<LocalGuideAccordion places={[]} />);
    expect(empty.firstChild).toBeNull();

    const { container: undef } = render(<LocalGuideAccordion places={undefined} />);
    expect(undef.firstChild).toBeNull();

    const { container: blanks } = render(
      <LocalGuideAccordion places={["   ", ""]} />,
    );
    expect(blanks.firstChild).toBeNull();

    expect(screen.queryByTestId("property-local-guide-section")).toBeNull();
  });
});

describe("parseNearPlace (TASK-102117)", () => {
  it("splits 'Name (distance)' into name and distance", () => {
    expect(parseNearPlace("Inorbit Mall (3 km)")).toMatchObject({
      name: "Inorbit Mall",
      distance: "3 km",
    });
    expect(parseNearPlace("Baga Beach · 1.2 km away")).toMatchObject({
      // No trailing parens → treated as a plain name, distance unknown.
      name: "Baga Beach · 1.2 km away",
      distance: null,
    });
  });

  it("returns distance null when the entry carries no hint", () => {
    expect(parseNearPlace("Durgam Cheruvu Lake")).toMatchObject({
      name: "Durgam Cheruvu Lake",
      distance: null,
    });
  });
});

describe("categorizeNearPlace / groupNearPlaces (TASK-102117)", () => {
  it("buckets known keywords and falls back to 'Also nearby'", () => {
    expect(categorizeNearPlace("Inorbit Mall")).toBe("Shopping");
    expect(categorizeNearPlace("Hitech City Metro")).toBe("Getting around");
    expect(categorizeNearPlace("Durgam Cheruvu Lake")).toBe("Nature & leisure");
    expect(categorizeNearPlace("Some Random Villa")).toBe("Also nearby");
  });

  it("groups in stable category order, preserving source order within groups", () => {
    const groups = groupNearPlaces(SAMPLE_PLACES);
    expect(groups.length).toBeGreaterThan(1);
    const shopping = groups.find((group) => group.category === "Shopping");
    expect(shopping?.spots.map((spot) => spot.name)).toEqual(["Inorbit Mall"]);
  });
});
