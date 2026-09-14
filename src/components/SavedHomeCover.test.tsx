/**
 * TASK-10090: saved-home cover uses OptimizedImage — blob URLs go through /img,
 * ineligible URLs keep a safe fallback, alt text is preserved.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import SavedHomeCover from "./SavedHomeCover";
import { toTransformedGuestImageUrl } from "@/utils/guestImageUrl";

afterEach(() => {
  cleanup();
});

const BLOB = "https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg";
const CDN = "https://images.example.com/photo.jpg";
const LOCAL = "http://localhost:5174/uploads/test.jpg";

describe("SavedHomeCover (TASK-10090)", () => {
  test("blob covers use the /img transform, not the raw full-size URL", () => {
    render(<SavedHomeCover src={BLOB} alt="Beach house" />);
    const img = screen.getByRole("img", { name: "Beach house" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img.getAttribute("src")).toBe(toTransformedGuestImageUrl(BLOB, 768));
    expect(img.getAttribute("src")).toMatch(/^\/img\?/);
    expect(img.getAttribute("src")).not.toBe(BLOB);
    expect(img.getAttribute("srcset")).toMatch(/\/img\?/);
    expect(img.getAttribute("sizes")).toContain("100vw");
  });

  test("transform-capable CDN covers keep alt text and a width srcset", () => {
    render(<SavedHomeCover src={CDN} alt="Hill cottage" />);
    const img = screen.getByRole("img", { name: "Hill cottage" });
    expect(img).toHaveAttribute("src", CDN);
    expect(img.getAttribute("srcset")).toContain("w=480");
    expect(img.getAttribute("srcset")).toContain("auto=format");
  });

  test("localhost /uploads URLs fall back to the original src without white-screening", () => {
    render(<SavedHomeCover src={LOCAL} alt="Local listing" />);
    const img = screen.getByRole("img", { name: "Local listing" });
    expect(img).toHaveAttribute("src", LOCAL);
    expect(img.getAttribute("srcset")).toBeNull();
  });

  test("missing covers render the existing muted placeholder, not an img", () => {
    const { container } = render(<SavedHomeCover src={null} alt="Home" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("saved-home-cover-empty")).toHaveClass("h-40");
    expect(container.querySelector("img")).toBeNull();
  });
});
