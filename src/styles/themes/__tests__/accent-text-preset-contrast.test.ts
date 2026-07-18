/**
 * TASK-4962 — every preset's EFFECTIVE `--accent-text` / `--lavender-text` must clear WCAG AA
 * against that preset's own `--bg-primary` and `--bg-surface`.
 *
 * "Effective" is the point. base.css defines both tokens with LIGHT-tuned defaults
 * (#a84832 coral / #6f5aa8 lavender) and its own comment states the contract: *every theme SHOULD
 * override with its own brand-matched passing values*. A preset that simply omits them inherits the
 * light defaults — correct for the 11 light presets, silently broken for a dark one.
 *
 * That is how this shipped twice. TASK-4952 fixed it for privateIslandNoir/emeraldDynasty by hand
 * but left no guard, so `ultraYachtAzure` — added later, also dark (#0a1628 / #0f1f38) — was missed
 * and rendered price chips and badges (SearchAvailabilityWidget, MarketplaceHomepage,
 * Homepage_LocationDetails) at 3.14:1 / 2.86:1 for accent-text and 3.21:1 / 2.91:1 for
 * lavender-text. A per-file review can't catch this: nothing is *wrong* in `ultra-yacht-azure.css`,
 * the tokens are simply absent, and absence is invisible.
 *
 * So this test is driven off `index.css`'s own @import list rather than a hardcoded preset array —
 * a newly added preset is covered the moment it is imported, without anyone remembering to
 * register it here.
 *
 * Same approach as `footer-success-text-contrast.test.ts`: read real values from the CSS sources
 * and compute with the WCAG relative-luminance formula. No ratio is hardcoded.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

type Rgb = [number, number, number];

function srgbChannelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const AA_NORMAL_TEXT_MIN = 4.5;
const THEMES_DIR = resolve(__dirname, "..");

const read = (file: string) => readFileSync(resolve(THEMES_DIR, file), "utf-8");

/** Only files index.css actually imports are live; anything else in the dir is dead weight. */
const importedFiles = [...read("index.css").matchAll(/@import\s+"\.\/([^"]+)"/g)].map((m) => m[1]);

/** `--token: value;` within an already-isolated block. Anchored so prose in comments can't match. */
function tokenIn(body: string, token: string): string | null {
  const m = body.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, "m"));
  return m ? m[1].trim() : null;
}

/** Collect every `:root[data-theme="<id>"]` block across the imported files. */
const presets: Record<string, { file: string; body: string }> = {};
for (const file of importedFiles) {
  const source = read(file);
  const re = /:root\[data-theme="([A-Za-z]+)"\]\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    const end = source.indexOf("\n}", start);
    presets[m[1]] = { file, body: source.slice(start, end === -1 ? undefined : end) };
  }
}

const baseBody = read("base.css");

/**
 * Resolves a token to a hex literal, following one level of `var(--other)` indirection within the
 * same preset block (the luxury presets define `--bg-primary: var(--bg-base)`), and falling back to
 * base.css's `:root` default when the preset doesn't override it — which is exactly the inheritance
 * this test exists to police.
 */
function resolveHex(body: string, token: string): string | null {
  let value = tokenIn(body, token) ?? tokenIn(baseBody, token);
  if (!value) return null;
  const indirect = value.match(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/);
  if (indirect) value = tokenIn(body, indirect[1]) ?? tokenIn(baseBody, indirect[1]) ?? value;
  return value.startsWith("#") ? value : null;
}

const TEXT_TOKENS = ["--accent-text", "--lavender-text"];
const SURFACE_TOKENS = ["--bg-primary", "--bg-surface"];

describe("every preset's effective text-role accents clear WCAG AA on its own surfaces", () => {
  it("index.css imports at least the known preset files", () => {
    // Guards the discovery mechanism itself: if the @import parse ever silently returns nothing,
    // every describe.each below would vacuously pass with zero cases.
    expect(importedFiles.length).toBeGreaterThan(5);
    expect(Object.keys(presets).length).toBeGreaterThan(10);
  });

  describe.each(Object.entries(presets))("%s", (id, { body }) => {
    it.each(TEXT_TOKENS)(`%s passes on both surfaces`, (textToken) => {
      const text = resolveHex(body, textToken);
      expect(text, `${id} ${textToken} did not resolve to a hex literal`).not.toBeNull();

      for (const surfaceToken of SURFACE_TOKENS) {
        const surface = resolveHex(body, surfaceToken);
        if (!surface) continue; // preset genuinely doesn't define this surface
        const ratio = contrastRatio(hexToRgb(text as string), hexToRgb(surface));
        expect(
          ratio,
          `${id}: ${textToken} (${text}) on ${surfaceToken} (${surface})`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
      }
    });
  });
});

/**
 * Known-orphaned theme CSS, deliberately allowlisted rather than deleted here.
 *
 * `luxury-pastel.css` is not imported by `index.css` and is referenced nowhere in src/ or tests/,
 * yet its header calls itself the "single source of truth" for the OLD design and it defines a full
 * `:root[data-theme="default"]` block. Editing it to change the default theme therefore looks
 * effective and does nothing — the live `default` block is in `default.css`. Removing it is a
 * separate call from a contrast fix, so it is recorded here instead of silently deleted; drop this
 * entry when the file goes.
 */
const KNOWN_ORPHANED_THEME_CSS = ["luxury-pastel.css"];

describe("theme stylesheet hygiene", () => {
  it("gains no NEW theme CSS that index.css never imports", () => {
    const onDisk = readdirSync(THEMES_DIR).filter((f) => f.endsWith(".css") && f !== "index.css");
    const orphaned = onDisk.filter(
      (f) => !importedFiles.includes(f) && !KNOWN_ORPHANED_THEME_CSS.includes(f),
    );
    expect(orphaned, `theme CSS not imported by index.css: ${orphaned.join(", ")}`).toEqual([]);
  });

  it("still has every allowlisted orphan on disk (drop the entry once removed)", () => {
    const onDisk = readdirSync(THEMES_DIR);
    const stale = KNOWN_ORPHANED_THEME_CSS.filter((f) => !onDisk.includes(f));
    expect(stale, `allowlisted orphan no longer exists — remove from the list: ${stale.join(", ")}`).toEqual([]);
  });
});
