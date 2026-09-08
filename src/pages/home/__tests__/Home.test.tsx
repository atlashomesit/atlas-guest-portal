import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { BookingProvider } from "../../../contexts/BookingContext";
import Home from "../Home";

vi.mock("../../../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(() => ({ slug: "atlas", isMarketplaceRoot: true })),
}));

vi.mock("../../../components/homepage_components/slider/Slider", () => ({
  __esModule: true,
  default: () => <div>Hero Slider</div>,
}));

vi.mock("../../../components/homepage_components/homepage_locations/HomePage_Locations", () => ({
  __esModule: true,
  default: () => <div>Home Locations</div>,
}));

vi.mock("../../../components/home/ServicesSection", () => ({
  __esModule: true,
  default: () => <div>Discover Our Exclusive Services</div>,
}));

vi.mock("../../../components/home/TestimonialsSection", () => ({
  __esModule: true,
  default: () => <div>Hear What Our Happy Guests Are Saying</div>,
}));

// TASK-101855 ROOT CAUSE. Home.tsx puts FOUR React.lazy children under ONE
// <Suspense fallback={null}> (3cee54b3 / TASK-7822): ServicesSection, FaqHighlights,
// TestimonialsSection and FooterCtaStrip. A Suspense boundary renders NOTHING until EVERY
// lazy child in it has resolved -- so the two assertions below, on components this file
// stubs to instant <div>s, were in fact gated on vitest transforming and importing the REAL
// FaqHighlights module. That unrelated import was ~90% of the wait.
//
// Measured on this box, 8 interleaved A/B pairs, idle, same worktree:
//   without this mock: ServicesSection findByText settled in 261-293ms (7 of 8)
//   with    this mock: ServicesSection findByText settled in  25-37ms  (8 of 8)
// i.e. ~10x, which is why the assertion sat ~3.7x from findByText's 1000ms deadline instead
// of ~38x, and why gate-run-20260909T021634 crossed it at 2851ms under STEP 1 contention
// while 29 isolated retries never did.
//
// This is NOT a widened timeout, wait, retry or sleep, and it deletes no assertion -- this
// file asserts nothing whatsoever about FaqHighlights. It stubs the fourth lazy sibling the
// way the other three were already stubbed, so the 1000ms budget covers only what this test
// is about. (FooterCtaStrip needs no stub: enableFooterMiniCtaAboveFooter is false, so it
// never mounts.)
//
// The shared boundary is ALSO a real product latency finding for guests -- one slow chunk
// delays three other sections in a real browser too. Filed separately as TASK-101857; do not
// "fix" it here by editing Home.tsx.
vi.mock("../../../components/faq/FaqHighlights", () => ({
  __esModule: true,
  default: () => <div>Faq Highlights</div>,
}));

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

describe("Home", () => {
  it("renders default sections when all UX flags are disabled", async () => {
    render(
      <BookingProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </BookingProvider>,
    );

    // BannerSecondary removed in Home v2 — replaced by inline why-direct section
    expect(screen.getByText(/We verify every home/i)).toBeInTheDocument();
    expect(screen.getByText(/You pay the host directly/i)).toBeInTheDocument();
    expect(screen.queryByText(/Free cancellation 48h before/i)).not.toBeInTheDocument();
    // 3cee54b3 (TASK-7822) moved these two behind React.lazy + <Suspense fallback={null}>, so
    // they are absent on the first synchronous paint and only appear once the dynamic import
    // resolves. getByText asserts against the fallback and always fails — await them.
    //
    // TASK-101855: instrumentation only, NOT a timeout change (do not widen findByText's default
    // 1000ms window here — see the board block for why). gate-run-20260909T021634 reproduced
    // exactly here at 2851ms in STEP 1's parallel window (guest vitest concurrent with the API
    // build) but the same assertion passed 468ms alone and did not reproduce across 6 isolated
    // retries + 1 synthetic-CPU-load retry + ~22 further retries under a REAL concurrent
    // `dotnet build`/`dotnet test Atlas.Api.Tests` in this task's own investigation (range
    // 107ms-1057ms, 0 failures). Timing every occurrence, pass or fail, so the NEXT gate red
    // carries the actual lazy-import resolution number instead of only a pass/fail bit — this is
    // what settles whether the concurrency hypothesis is the true cause.
    //
    // ⚠️ THE `finally` IS THE WHOLE POINT — do not "simplify" it back to a log after the await.
    // An earlier revision of this instrumentation logged on the line AFTER each `await`, which
    // cannot fire in the one case it was built for: `findByText` THROWS on timeout, so the
    // statement after it never runs. The observed gate red (2851ms) was on the FIRST assertion,
    // so that shape would have recorded exactly nothing on the run that mattered. Logging in a
    // `finally` records the elapsed time on BOTH paths, and the default vitest reporter — which
    // is what STEP 1 runs — surfaces console output for FAILING tests, so the number reaches
    // `atlas-gate-guest-<ts>.log` precisely when it is needed. (On PASSING runs the default
    // reporter suppresses it; that is fine and expected — pass `--reporter=verbose` to see the
    // baseline locally. Verified both directions 2026-09-09 by forcing this assertion red.)
    const timedFindByText = async (label: string, matcher: RegExp) => {
      const started = performance.now();
      try {
        return await screen.findByText(matcher);
      } finally {
        console.info(
          `[TASK-101855] ${label} findByText settled in ${(performance.now() - started).toFixed(0)}ms`,
        );
      }
    };

    expect(
      await timedFindByText("ServicesSection", /Discover Our Exclusive Services/i),
    ).toBeInTheDocument();
    expect(
      await timedFindByText("TestimonialsSection", /Hear What Our Happy Guests Are Saying/i),
    ).toBeInTheDocument();
  });
});
