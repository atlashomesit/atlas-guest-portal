/**
 * Brand mark from Theem images — the actual Stay by City Focus logo artwork,
 * cropped to content with a transparent background (384x358 PNG) so it sits
 * cleanly on the cream navbar. Original raster stays at .jpeg; the old vector
 * recreation (.svg) is retired.
 */
export const LOGO_URL = "/images/stay-bycityfocus-logo.png";

/** Decorative property-card / gallery designs (theme mockup style) */
export const PROPERTY_DESIGN_IMAGES = [
  "/images/stay-design-coral.svg",
  "/images/stay-design-lavender.svg",
  "/images/stay-design-peach.svg",
] as const;

export const getPropertyDesignImage = (seed: string | number = 0): string => {
  const n = typeof seed === "number" ? seed : Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return PROPERTY_DESIGN_IMAGES[Math.abs(n) % PROPERTY_DESIGN_IMAGES.length];
};

export const BRANDING = {
  logoUrl: LOGO_URL,
};
