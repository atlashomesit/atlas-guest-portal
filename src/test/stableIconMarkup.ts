/**
 * TASK-103194: a snapshot stores what OUR code put on an icon, never what lucide-react draws for it.
 *
 * A rendered lucide icon is
 *   <svg xmlns width height viewBox fill stroke stroke-width stroke-linecap stroke-linejoin
 *        class="lucide lucide-<name> [lucide-<alias>] <our classes>" aria-hidden="true"><path d="..." />...</svg>
 * and everything in it except our className comes from the installed lucide-react: the glyph geometry (the
 * path / circle / rect / line children), the default presentation attributes, and the `lucide-*` class tokens,
 * including alias tokens that some versions add and others drop. A snapshot that stores them turns red on a
 * lucide bump with no change in our code. tests/__snapshots__/AboutPage.test.tsx.snap was refreshed four times
 * for exactly that, and the last one cost a release-gate STEP 1 run (2026-10-10):
 *   2026-09-04  21cf6a7d / 19b8dd72  glyph redrawn: CheckCircle2 d="m9 12 2 2 4-4" -> "m16 9-5.5 5.5L8 12"
 *   2026-09-24  cfa5ce11             alias classes dropped (lucide-check-circle-2, lucide-stars; clock-4 -> clock4)
 *   2026-10-10  b8d08a83             alias classes back with lucide-react 1.52.0 (dependabot b46eb80e)
 * Incident record: atlas-e2e docs/incidents/aboutpage-snapshot-lucide-alias-drift-2026-10-09.md.
 *
 * So each lucide icon is replaced by one stable marker element that keeps only what the caller chose:
 *   <svg data-icon="lucide" class="<our classes>" [aria-* other than aria-hidden] [data-*] [role] [id]></svg>
 * Given up on purpose: the snapshot no longer says WHICH icon it is. The identity tokens are exactly the ones that
 * flipped (clock-4 / clock4, check-circle-2), so they were never a stable thing to store; the page's own assertions
 * cover its structure. aria-hidden is dropped because lucide sets it by default and a caller's own value cannot be
 * told apart from that default.
 *
 * A NEW snapshot test that renders lucide icons: snapshot `withStableIcons(node)` (a DOM snapshot) or
 * `withStableIcons(document.body).innerHTML` (a string snapshot), and assert `lucideOwnedMarkup(...)` is empty
 * the way tests/AboutPage.test.tsx does.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** A token lucide-react puts on its icons: the bare marker class, or `lucide-<icon name / alias>`. */
const isLucideToken = (token: string): boolean => token === "lucide" || token.startsWith("lucide-");

/** True for an <svg> that lucide-react rendered (it always carries the bare `lucide` class). */
export function isLucideIcon(el: Element): boolean {
  return el.tagName.toLowerCase() === "svg" && el.classList.contains("lucide");
}

/** Attributes the CALLER can set on an icon and that lucide never invents (aria-hidden is lucide's default). */
function isCallerAttribute(name: string): boolean {
  if (name === "aria-hidden") return false;
  return name.startsWith("aria-") || name.startsWith("data-") || name === "role" || name === "id";
}

function stableIconElement(icon: Element): Element {
  const marker = icon.ownerDocument.createElementNS(SVG_NS, "svg");
  marker.setAttribute("data-icon", "lucide");
  const ours = (icon.getAttribute("class") ?? "").split(/\s+/).filter((t) => t && !isLucideToken(t));
  if (ours.length > 0) marker.setAttribute("class", ours.join(" "));
  for (const attr of Array.from(icon.attributes)) {
    if (isCallerAttribute(attr.name)) marker.setAttribute(attr.name, attr.value);
  }
  return marker;
}

/**
 * A deep CLONE of `node` in which every lucide icon is the stable marker element. The live tree is never touched,
 * so a test can still query and interact with the real icons after taking its snapshot.
 */
export function withStableIcons<T extends Node>(node: T): T {
  const clone = node.cloneNode(true) as T;
  const root = clone as unknown as Element;
  if (root.nodeType === 1 && isLucideIcon(root)) return stableIconElement(root) as unknown as T;
  if (typeof (root as Element).querySelectorAll !== "function") return clone;
  for (const icon of Array.from(root.querySelectorAll("svg.lucide"))) {
    icon.replaceWith(stableIconElement(icon));
  }
  return clone;
}

/**
 * Every piece of lucide-owned markup left in serialized HTML or snapshot text: `lucide-*` class tokens, and glyph
 * geometry inside an svg that carries the `lucide` class. Empty = the text holds nothing a lucide bump can change.
 */
export function lucideOwnedMarkup(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/class="([^"]*)"/g)) {
    for (const token of m[1].split(/\s+/)) {
      if (token.startsWith("lucide-")) found.push(token);
    }
  }
  for (const m of text.matchAll(/<svg\b[^>]*\bclass="[^"]*\blucide\b[^"]*"[^>]*>([\s\S]*?)<\/svg>/g)) {
    const geometry = m[1].match(/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>/);
    if (geometry) found.push(geometry[0]);
  }
  return found;
}
