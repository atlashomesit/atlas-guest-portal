import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/homepage_components/homepage_exclusiveservice/Homepage_ExclusiveService", () => ({
  default: () => <div data-testid="exclusive-service">Exclusive services baseline</div>,
}));

vi.mock("../src/components/homepage_components/homepage_whychoose/Homepage_WhyChoose", () => ({
  default: () => <div data-testid="why-choose-default">Why Choose baseline</div>,
}));

vi.mock("../src/components/homepage_components/homepage_testimonial/Homepage_Testimonial", () => ({
  default: () => <div data-testid="testimonials-default">Testimonials carousel baseline</div>,
}));

vi.mock("../src/components/commonComponents/parallax/Parallax", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="parallax">
      <h2 data-testid="parallax-title">{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

import BannerSecondary from "../src/components/home/BannerSecondary";
import ServicesSection from "../src/components/home/ServicesSection";
import WhyChooseSection from "../src/components/home/WhyChooseSection";
import TestimonialsSection from "../src/components/home/TestimonialsSection";

describe("Homepage UX wrappers (default path)", () => {
  it("renders the default secondary banner when flags are off", () => {
    const { asFragment } = render(<BannerSecondary />);

    expect(screen.getByTestId("parallax-title").textContent).toContain("Atlas Homes");
    expect(screen.queryByText(/value-block variant/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("keeps services on the production path without placeholders", () => {
    const { asFragment } = render(<ServicesSection />);

    expect(screen.getByTestId("exclusive-service")).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("shows the established Why Choose experience", () => {
    const { asFragment } = render(<WhyChooseSection />);

    expect(screen.getByTestId("why-choose-default")).toBeInTheDocument();
    expect(screen.queryByText(/accordion layout/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("uses the live testimonials carousel instead of placeholders", () => {
    const { asFragment } = render(<TestimonialsSection />);

    expect(screen.getByTestId("testimonials-default")).toBeInTheDocument();
    expect(screen.queryByText(/Source pending verification/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
