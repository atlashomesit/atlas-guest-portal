/** @vitest-environment jsdom */

/**
 * REV-046: `/rate/:tenantSlug/:code` is wired into the app shell as a standalone page, like the QR menu: it renders
 * the review QR page and none of the site chrome (navbar, footer, support widget, cookie banner). The page itself is
 * covered by src/pages/ReviewQrPage.test.tsx; both page modules are stubbed here so only the routing is under test.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { settle } from "../test/settle";

vi.mock("../pages/ReviewQrPage", () => ({
  default: () => <div data-testid="review-qr-route-probe">review qr page</div>,
}));

vi.mock("../pages/Policies", () => ({
  default: () => <div data-testid="policies-route-probe">policies page</div>,
}));

beforeEach(() => {
  // jsdom has no scrollTo; the app scrolls to the top on every route change.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

async function openRoute(path: string, loadLazyPage: () => Promise<unknown>) {
  window.history.pushState({}, "", path);
  render(<App />);
  // React.lazy resolves through a real dynamic import, which a drained microtask queue does not cover.
  await loadLazyPage();
  await settle();
  await settle();
}

describe("review QR route (REV-046)", () => {
  it("renders the review QR page for /rate/:tenantSlug/:code, with no navbar, footer or other site chrome", async () => {
    await openRoute("/rate/coorg-resort/ABCD2345WXYZ", () => import("../pages/ReviewQrPage"));

    expect(screen.getByTestId("review-qr-route-probe")).toBeInTheDocument();
    expect(document.getElementById("navbar_container")).toBeNull();
    expect(document.querySelector("footer")).toBeNull();
    // The main landmark loses its navbar offset, as on the QR menu.
    expect((document.getElementById("main-content") as HTMLElement).style.paddingTop).toBe("0px");
  });

  it("control: an ordinary page still gets the navbar and the footer", async () => {
    await openRoute("/policies", () => import("../pages/Policies"));

    expect(screen.getByTestId("policies-route-probe")).toBeInTheDocument();
    expect(document.getElementById("navbar_container")).not.toBeNull();
    expect(document.querySelector("footer")).not.toBeNull();
  });
});
