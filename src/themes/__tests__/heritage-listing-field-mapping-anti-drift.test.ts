/**
 * TASK-8221: heritage's fork of the API-fallback listing mapper read `property_rating` /
 * `property_reviews` / `property_price` in snake_case only. The API (`PublicListingDto`, no
 * `JsonNamingPolicy` override in `Program.cs`) emits camelCase — `propertyRating` /
 * `reviewCount` / `baseNightlyRate` — so every real DB-backed listing collapsed all three to 0.
 * That silently killed the TASK-4015 "Save ~₹X by booking directly" conversion banner
 * (`data.property_price > 0` gate) on every heritage tenant.
 *
 * TASK-5196 fixed the identical bug in the classic sibling (`Homepage_PropertyDetails.tsx`),
 * which reads camelCase first with snake_case kept only as a `??` fallback. This test doesn't
 * just grep for the field names — it extracts the actual mapping EXPRESSION out of both files
 * and evaluates it against several fixtures, so it fails on any regression that changes the
 * *behaviour* (dropped fallback, swapped precedence, wrong field), not only a reverted literal.
 * Running the same fixtures through both forks and asserting identical output is the anti-drift
 * guard TASK-8221 asks for: the two files must never be able to silently diverge again.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SURFACES = [
  {
    label: "heritage",
    path: resolve(__dirname, "../heritage/PropertyDetails.tsx"),
  },
  {
    label: "default",
    path: resolve(
      __dirname,
      "../../components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx",
    ),
  },
] as const;

const FIELDS = [
  { key: "property_rating", camel: "propertyRating" },
  { key: "property_reviews", camel: "reviewCount" },
  { key: "property_price", camel: "baseNightlyRate" },
] as const;

/** Strips TypeScript-only syntax (`as X`, `as Record<string, unknown>`) so the extracted
 *  mapping expression is plain, evaluable JS. */
const stripTsCasts = (expr: string): string =>
  expr
    .replace(/\s+as\s+Record<string,\s*unknown>/g, "")
    .replace(/\s+as\s+[\w[\]]+/g, "");

/**
 * Pulls the literal RHS of `<key>: <expr>,` out of the API-fallback `const mapped: Property = {
 * ... }` block specifically (both files also map a *different*, unrelated `item.<key> ?? 0`
 * shape earlier, for a recently-viewed-items list — scoping to the anchor avoids matching that).
 * Returns both the raw source text (for literal containment checks) and a cast-stripped,
 * evaluable version (for behavioural checks).
 */
const extractMappingExpr = (content: string, key: string): { raw: string; evaluable: string } => {
  const anchor = content.indexOf("const mapped: Property = {");
  if (anchor === -1) throw new Error('could not find "const mapped: Property = {" anchor');
  const scoped = content.slice(anchor);
  const re = new RegExp(`^\\s*${key}:\\s*(.+),\\s*$`, "m");
  const m = scoped.match(re);
  if (!m) throw new Error(`could not find "${key}:" mapping line after the mapped:Property anchor`);
  return { raw: m[1], evaluable: stripTsCasts(m[1]) };
};

/** Evaluates the extracted mapping expression against a fixture `apiListing` object. */
const evalMapping = (expr: string, apiListing: Record<string, unknown>): number => {
  // eslint-disable-next-line no-new-func
  const fn = new Function("apiListing", `return (${expr});`);
  return fn(apiListing) as number;
};

const FIXTURES: Array<{ label: string; apiListing: Record<string, unknown>; expected: Record<string, number> }> = [
  {
    label: "real API response — camelCase only (the actual production shape)",
    apiListing: { baseNightlyRate: 4200, propertyRating: 4.7, reviewCount: 12 },
    expected: { property_price: 4200, property_rating: 4.7, property_reviews: 12 },
  },
  {
    label: "legacy snake_case only — fallback must still work",
    apiListing: { property_price: 1500, property_rating: 3.2, property_reviews: 5 },
    expected: { property_price: 1500, property_rating: 3.2, property_reviews: 5 },
  },
  {
    label: "both present — camelCase must win (guards against silently re-preferring snake_case)",
    apiListing: {
      baseNightlyRate: 9900,
      propertyRating: 4.1,
      reviewCount: 30,
      property_price: 1,
      property_rating: 1,
      property_reviews: 1,
    },
    expected: { property_price: 9900, property_rating: 4.1, property_reviews: 30 },
  },
  {
    label: "neither present — safe zero, not NaN/undefined",
    apiListing: {},
    expected: { property_price: 0, property_rating: 0, property_reviews: 0 },
  },
];

describe("TASK-8221: heritage/default listing field mapping reads camelCase with snake_case fallback", () => {
  const contents = Object.fromEntries(
    SURFACES.map(({ label, path }) => [label, readFileSync(path, "utf-8")]),
  );

  for (const { label } of SURFACES) {
    describe(`${label} surface`, () => {
      for (const { key, camel } of FIELDS) {
        it(`${key} mapping expression reads ${camel} first, ${key} as fallback`, () => {
          const { raw } = extractMappingExpr(contents[label], key);
          // Must reference both the camelCase API field and the snake_case fallback (the
          // fallback may be written as `(apiListing as Record<string, unknown>).<key>`).
          expect(raw, `expression: ${raw}`).toContain(`apiListing.${camel}`);
          expect(raw, `expression: ${raw}`).toMatch(new RegExp(`apiListing(\\s+as\\s+[^)]+)?\\)?\\.${key}\\b`));
          expect(raw, `expression: ${raw}`).toMatch(/\?\?/);
        });

        for (const fixture of FIXTURES) {
          it(`${key}: ${fixture.label}`, () => {
            const { evaluable } = extractMappingExpr(contents[label], key);
            const result = evalMapping(evaluable, fixture.apiListing);
            expect(result).toBe(fixture.expected[key]);
          });
        }
      }
    });
  }

  it("anti-drift: both surfaces map every fixture to identical values", () => {
    for (const fixture of FIXTURES) {
      for (const { key } of FIELDS) {
        const results = SURFACES.map(({ label }) => ({
          label,
          value: evalMapping(extractMappingExpr(contents[label], key).evaluable, fixture.apiListing),
        }));
        const [first, ...rest] = results;
        for (const other of rest) {
          expect(
            other.value,
            `${key} diverged for "${fixture.label}": ${first.label}=${first.value}, ${other.label}=${other.value}`,
          ).toBe(first.value);
        }
      }
    }
  });
});

describe("TASK-8221: TASK-4015 'Save ~₹X by booking directly' banner renders once property_price is mapped", () => {
  const contents = Object.fromEntries(
    SURFACES.map(({ label, path }) => [label, readFileSync(path, "utf-8")]),
  );

  for (const { label } of SURFACES) {
    it(`${label}: banner gate is 'data.property_price > 0'`, () => {
      expect(contents[label]).toContain("data.property_price && data.property_price > 0 && (");
    });

    it(`${label}: banner formula computes the expected savings figure`, () => {
      const m = contents[label].match(/Math\.round\((data\.property_price \* [\d.]+ \* [\d.]+)\)/);
      expect(m, "Math.round(...) savings formula not found").not.toBeNull();
      // eslint-disable-next-line no-new-func
      const fn = new Function("data", `return Math.round(${m![1]});`);

      // Using the TASK-8221 fixture: baseNightlyRate 4200 -> property_price 4200 once mapped.
      const { evaluable } = extractMappingExpr(contents[label], "property_price");
      const property_price = evalMapping(evaluable, { baseNightlyRate: 4200 });
      expect(property_price).toBe(4200);
      expect(fn({ property_price })).toBe(1302);
    });

    it(`${label}: banner does not render when property_price is 0 (pre-fix behaviour)`, () => {
      const { evaluable } = extractMappingExpr(contents[label], "property_price");
      const property_price = evalMapping(evaluable, {});
      expect(property_price).toBe(0);
      // gate is `data.property_price && ...` — 0 is falsy, so the banner block is skipped.
      expect(Boolean(property_price)).toBe(false);
    });
  }
});
