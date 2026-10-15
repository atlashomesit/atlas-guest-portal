/**
 * TASK-103194: the AboutPage snapshot flipped ten times between 2026-09-04 and 2026-10-10 on markup that lucide-react
 * owns (glyph paths and alias class names), never on our code. These cases replay three real states of the same three
 * icons (CheckCircle2, Sparkles, Clock4), copied from the committed snapshot blobs, and require that a snapshot taken
 * through withStableIcons is identical for all three. See src/test/stableIconMarkup.ts.
 */
import { describe, expect, it } from "vitest";
import { isLucideIcon, lucideOwnedMarkup, withStableIcons } from "./stableIconMarkup";

const SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function icons(state: { check: string; sparkles: string; clock: string; checkPath: string }): string {
  return [
    `<li class="flex items-start gap-3"><svg ${SVG_ATTRS} class="${state.check} w-5 h-5 text-primary mt-1" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="${state.checkPath}"></path></svg><span>Mission</span></li>`,
    `<span class="pill"><svg ${SVG_ATTRS} class="${state.sparkles} w-4 h-4" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0"></path></svg>Standards</span>`,
    `<div class="badge"><svg ${SVG_ATTRS} class="${state.clock} w-5 h-5" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg></div>`,
  ].join("");
}

// Blob 5e26c448 (before 2026-09-04): the old CheckCircle2 glyph, no alias classes, Clock4 as `clock4 clock-4`.
const BEFORE_REDRAW = icons({ check: "lucide lucide-circle-check", sparkles: "lucide lucide-sparkles", clock: "lucide lucide-clock4 lucide-clock-4", checkPath: "m9 12 2 2 4-4" });
// Blob 31285950 (21cf6a7d, cfa5ce11, c80283e4): the redrawn glyph, still no alias classes.
const REDRAWN = icons({ check: "lucide lucide-circle-check", sparkles: "lucide lucide-sparkles", clock: "lucide lucide-clock4 lucide-clock-4", checkPath: "m16 9-5.5 5.5L8 12" });
// Blob 845534af (18080e41, 1db3547d, b8d08a83; lucide-react 1.47.0 and 1.52.0): alias classes added, Clock4 as `clock-4` only.
const WITH_ALIASES = icons({ check: "lucide lucide-circle-check lucide-check-circle-2", sparkles: "lucide lucide-sparkles lucide-stars", clock: "lucide lucide-clock-4", checkPath: "m16 9-5.5 5.5L8 12" });

function stable(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  return withStableIcons(host).innerHTML;
}

describe("withStableIcons (TASK-103194)", () => {
  it("gives one snapshot for the three lucide-react states the AboutPage snapshot flipped between", () => {
    expect(BEFORE_REDRAW).not.toBe(WITH_ALIASES); // the raw markup really does differ: this is what a snapshot used to store
    expect(stable(BEFORE_REDRAW)).toBe(stable(REDRAWN));
    expect(stable(REDRAWN)).toBe(stable(WITH_ALIASES));
  });

  it("keeps only what our code chose for the icon: its own classes, in order, on a marker element with no children", () => {
    expect(stable(WITH_ALIASES)).toBe(
      [
        '<li class="flex items-start gap-3"><svg data-icon="lucide" class="w-5 h-5 text-primary mt-1"></svg><span>Mission</span></li>',
        '<span class="pill"><svg data-icon="lucide" class="w-4 h-4"></svg>Standards</span>',
        '<div class="badge"><svg data-icon="lucide" class="w-5 h-5"></svg></div>',
      ].join(""),
    );
  });

  it("keeps the caller's aria-label, data-* and role, and drops lucide's default aria-hidden", () => {
    const out = stable(
      `<svg ${SVG_ATTRS} class="lucide lucide-x size-4" role="img" aria-label="Close" data-testid="close-icon" aria-hidden="true"><path d="M18 6 6 18"></path></svg>`,
    );
    expect(out).toBe('<svg data-icon="lucide" class="size-4" role="img" aria-label="Close" data-testid="close-icon"></svg>');
  });

  it("leaves an svg that lucide did not render (no `lucide` class) exactly as it was", () => {
    const own = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"></path></svg>';
    expect(stable(own)).toBe(own);
  });

  it("never touches the live tree, and handles a lucide icon passed in directly", () => {
    const host = document.createElement("div");
    host.innerHTML = WITH_ALIASES;
    const before = host.innerHTML;
    withStableIcons(host);
    expect(host.innerHTML).toBe(before);
    const icon = host.querySelector("svg")!;
    expect(isLucideIcon(icon)).toBe(true);
    expect(withStableIcons(icon).outerHTML).toBe('<svg data-icon="lucide" class="w-5 h-5 text-primary mt-1"></svg>');
  });
});

describe("lucideOwnedMarkup (TASK-103194)", () => {
  it("finds the alias tokens and the glyph geometry the old snapshots stored", () => {
    const found = lucideOwnedMarkup(WITH_ALIASES);
    expect(found).toEqual(
      expect.arrayContaining(["lucide-circle-check", "lucide-check-circle-2", "lucide-stars", "lucide-clock-4", '<circle cx="12" cy="12" r="10">']),
    );
  });

  it("reads pretty-format snapshot text too (multi-line attributes)", () => {
    const snap = '<svg\n  aria-hidden="true"\n  class="lucide lucide-sparkles lucide-stars w-4 h-4"\n  fill="none"\n>\n  <path\n    d="M11.017 2.814"\n  />\n</svg>';
    expect(lucideOwnedMarkup(snap)).toEqual(["lucide-sparkles", "lucide-stars", '<path\n    d="M11.017 2.814"\n  />']);
  });

  it("finds nothing once the icons are stable", () => {
    expect(lucideOwnedMarkup(stable(WITH_ALIASES))).toEqual([]);
    expect(lucideOwnedMarkup(stable(BEFORE_REDRAW))).toEqual([]);
  });
});
