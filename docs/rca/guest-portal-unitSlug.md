# RCA: ReferenceError unitSlug is not defined

## Problem
All property detail pages failed with "We couldn't load this page" on routes like:
- `/homes/atlas-homes-room-202/4`
- `/homes/atlas-homes-room-301/5`
- `/homes/atlas-homes-room-102/2`

Console: `ReferenceError: unitSlug is not defined` (boundary: `property-details-home-route`).

## Root cause

**Exact code:** `Homepage_PropertyDetails.tsx` line 227 (now fixed):

```ts
}, [propertySlug, unitSlug, location.state]);
```

`unitSlug` was referenced in a `useEffect` dependency array but was never declared. It had been renamed to `listingIdParam` in a prior refactor; the dependency array was not updated.

**Why it’s undefined:**
- `useParams()` returns `{ propertySlug, unitSlug, id }` (param names from the route).
- The component destructures `unitSlug: unitSlugParam` and uses `listingIdParam = unitSlugParam ?? ...`.
- `unitSlug` itself is not defined in the component; only `unitSlugParam` and `listingIdParam` exist.
- The effect’s dependency array still referred to `unitSlug`, causing a `ReferenceError` when the effect ran.

## Why dev/local didn’t catch it

1. **Dev HMR:** In dev, navigation often goes through internal links, which can use different code paths or cached modules. The failing path (direct load of a property details URL) might not run.
2. **No deep-link in dev:** Testing via header → Our Homes → click card goes through `listingIdParam` correctly; the bad `unitSlug` branch is only hit when visiting the route directly.
3. **Prod build:** The error occurs at runtime when the effect runs; it needs a production build and a direct visit to the route.
4. **Lint:** ESLint `no-undef` should flag undefined variables, but the rule may have been relaxed or not applied to this file; alternatively, lint wasn’t run before deploy.
5. **TypeScript:** `strict` is `false` in `tsconfig.json`, so TS did not enforce stricter checks that might have caught this.
6. **Tests:** `PropertyDetailsMedia` uses `MemoryRouter` but the main test is skipped (`it.skip`). No test actually rendered `Homepage_PropertyDetails` with the full route and asserted it doesn’t error.
7. **CI:** CI runs lint and build, but there was no smoke test that hit these routes against a built app and asserted they render without error.

## Fix

Replace `unitSlug` with `listingIdParam` in the dependency array:

```ts
}, [propertySlug, listingIdParam, location.state]);
```

## Prevention

- Add smoke tests that render `Homepage_PropertyDetails` with the failing route patterns.
- Ensure `npm run lint` is run in CI and that `no-undef` is enabled for applicable files.
- Add a CI step that runs `npm run build && npm run preview` and verifies property routes return 200 and do not show the error boundary.
