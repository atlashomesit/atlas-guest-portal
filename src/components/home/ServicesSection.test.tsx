import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ServicesSection from "./ServicesSection";

describe("ServicesSection", () => {
  it("renders nothing: no made-up services on host sites", () => {
    const { container } = render(<ServicesSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
