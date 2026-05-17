# Atlas Stays · Guest portal · May 2026 — Property page rebuild (A + C)

Applicable patch for the Direction A + C round we agreed on. Five new files
to drop in, four targeted edits to existing files, and one manual wire-in
step at the end.

This patch is **scoped to the property detail page**. Out of scope (deferred
by you): Direction B (real checkout / funnel refactor), mountain wordmark
migration, phone-OTP.

---

## What's in this folder

```
patch/
├── README.md                                  this file
├── changes.diff                                surgical edits to existing files
└── src/
    ├── config/
    │   └── legalIdentifiers.ts                NEW · Atlas legal-IDs config + tenant hook
    └── components/property/
        ├── cancellationTimeline.ts            NEW · pure helper, easy to unit-test
        ├── TrustBand.tsx                      NEW · Direction C (legitimacy / cancel / pay / support)
        └── MobileBookBar.tsx                  NEW · Direction A (persistent mobile CTA)
```

The new files live in **`src/config/`** and **`src/components/property/`** —
neither folder exists today. They're greenfield, no merge conflicts.

---

## How to apply

```bash
cd /path/to/atlas-guest-portal

# 1. Copy the new files into place
cp -r patch/src/* src/

# 2. Apply the surgical edits to existing files
git apply --check patch/changes.diff   # dry run first
git apply patch/changes.diff           # then for real

# 3. Wire up <TrustBand /> and <MobileBookBar /> in Homepage_PropertyDetails.tsx
#    (manual — see "Wire-in step" below; needs your eyes on which props to pass)

# 4. Type-check + test
npm run typecheck
npm run test -- TrustBand MobileBookBar cancellationTimeline
```

To revert the surgical edits later: `git apply -R patch/changes.diff`. To
revert the new files: delete `src/config/legalIdentifiers.ts` and the
`src/components/property/` folder.

If `git apply --check` reports drift (line numbers shifted since this patch
was authored), every hunk also has plain-English instructions in **"Manual
fallback"** below — five minutes by hand.

---

## What `changes.diff` does, and why

### 1. `Slider.tsx` — remove glassmorphism from the hero

- Drop `backdropFilter: 'blur(2px) saturate(0.98)'` and
  `'blur(4px) saturate(0.96)'` from the hero overlay style object.
- Drop `backdrop-blur-sm` from the direct-booking promo and "List your
  property" Link className.
- Drop the photo-overlay alpha from `0.5` → `0.42` so the property photo
  reads through instead of being painted flat.

**Why:** brand guardrails state "Glassmorph: NOT part of the system. Use
solid surfaces + warm shadows." Today's hero applies blur in two places.
Heuristic review finding **#04**.

### 2. `Navbar.tsx` — remove the scroll-blur handler

- Delete the `useEffect` that toggles a `backdrop-blur` class on
  `#navbar_container` based on `window.scrollY`. The handler runs on every
  scroll event; the rule it toggles is no longer in the CSS.

**Why:** same guardrail violation as above. Also: the original handler ran
on every scroll without RAF throttling. Removing it is a tiny perf win.

### 3. `navbar.css` — solid ivory navbar

- Remove `-webkit-backdrop-filter: blur(10px)` and `backdrop-filter: blur(10px)` from `.navbar-container`.
- Replace `background-color: rgba(255, 250, 245, 0.92)` with `var(--bg-primary, #fffaf5)`.
- Delete the `.navbar-container.backdrop-blur` block entirely (no longer toggled).
- Remove `backdrop-filter: blur(8px)` from the dropdown menu.

**Why:** same as #1/#2.

### 4. `Homepage_PropertyDetails.tsx` — three changes

#### 4a. Mobile order — show photos first

- Skeleton (L88):      `order-2 sm:order-1` → `order-1`
- Main left col (L1390): `order-2 sm:order-1` → `order-1`
- Main right col (L1762): `order-1 sm:order-2` → `order-2`

**Why:** on mobile today (`order-1 sm:order-2`), the booking widget renders
**above** the photos — the first thing a mobile guest sees is a price
summary and date picker before any image of the home. Heuristic review
finding **#11 + #13** — mobile-specific.

After the fix the order is consistent across viewports: photos and content
first, booking widget below. (The mobile CTA stays reachable via
`<MobileBookBar />` — see wire-in step.)

#### 4b. Chip cluster collapses to one warm "Verified home · Instant book"

- Remove the `bg-green-50 text-green-700` "✓ Verified listing" span.
- Remove the `bg-blue-50 text-blue-700` "⚡ Instant book" span.
- Replace with a single `bg-accent-soft` warm pill: **Verified home · Instant book**.

**Why:** the green/blue Tailwind defaults are out of the warm-editorial
system (and `blue-700` is the admin portal's CTA hue, not the guest
surface). The ⚡ and ✓ are emoji, banned everywhere else in the codebase.
Heuristic review finding **#05**.

### Manual fallback if `git apply` drifts

If your file has moved on, each change is small enough to apply by hand:

| File | Search for | Replace with |
|---|---|---|
| `Slider.tsx` | `backdropFilter: "blur(2px) saturate(0.98)",` | (delete the line) |
| `Slider.tsx` | `backdropFilter: "blur(4px) saturate(0.96)",` | (delete the line) |
| `Slider.tsx` | ` shadow-lg backdrop-blur-sm"` | ` shadow-lg"` |
| `Slider.tsx` | ` backdrop-blur-sm transition` | ` transition` |
| `Navbar.tsx` | the `/* Navbar scroll blur */ useEffect(...)` block | delete the entire useEffect |
| `navbar.css` | `backdrop-filter: blur(10px);` | (delete the line, both occurrences in `.navbar-container` and the dropdown) |
| `navbar.css` | the `.navbar-container.backdrop-blur` rule | delete the whole rule |
| `Homepage_PropertyDetails.tsx` | `order-2 sm:order-1` | `order-1` (2 occurrences) |
| `Homepage_PropertyDetails.tsx` | `order-1 sm:order-2` | `order-2` (1 occurrence) |
| `Homepage_PropertyDetails.tsx` | the `bg-green-50` Verified-listing span and the `bg-blue-50` Instant-book span | replace both with the single warm pill shown in `changes.diff` |

---

## Wire-in step (manual — 30 seconds)

`changes.diff` does **not** add the `<TrustBand>` / `<MobileBookBar>`
usages, because their placement depends on a judgment call (full-width
above the columns, or inside the left column?). Recommended placement:

In **`src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx`**, add the imports near the other `lucide-react` import:

```tsx
import TrustBand from '@/components/property/TrustBand';
import MobileBookBar from '@/components/property/MobileBookBar';
```

Then drop `<TrustBand />` **immediately before** the main two-column flex
container (the one whose comment says `{/* Left div */}` around line 1388).
This makes the trust band full-width below the gallery and amenities:

```tsx
{/* Trust band — Direction C (May 2026 rebuild).
    Sits between gallery/amenities and the booking card; surfaces
    legitimacy, cancellation, payment, support before the price. */}
<TrustBand
  cancellationTier={data?.cancellationTier ?? null}
  hostPhoneE164={
    data?.hostPhone
      ? (() => {
          const digits = data.hostPhone.replace(/\D/g, '');
          if (digits.length === 10) return `91${digits}`;
          return digits.length >= 11 ? digits : null;
        })()
      : null
  }
  hostPhoneDisplay={data?.hostPhone ?? null}
  hostReplyMinutes={12 /* TODO: surface real avg-reply from listing API */}
  listingName={data?.property_name}
  photosVerifiedAt={(data as { photosVerifiedAt?: string | null })?.photosVerifiedAt ?? null}
/>

<div className='flex flex-col gap-4 sm:flex-row '>
  {/* Left div ... */}
```

Then drop `<MobileBookBar />` **at the very bottom** of the component's
returned JSX, right before the closing `</section>` / closing fragment:

```tsx
{/* Mobile-only persistent CTA — Direction A (May 2026 rebuild).
    Hidden ≥ sm. Smooth-scrolls to #booking-form. */}
<MobileBookBar
  nightlyRate={data?.property_price ?? 0}
  cancellationTier={data?.cancellationTier ?? null}
  listingName={data?.property_name}
/>
```

That's the wire-in. Two imports, two component usages.

---

## What the new files give you

### `cancellationTimeline.ts`
Pure function `cancellationTimeline(tier, checkIn)` returns four refund
steps with copy anchored to the guest's check-in date. Also exports
`freeCancelByDate(tier, checkIn)`. No React, no DOM — easy to unit-test.

Sample test scaffold (drop into `cancellationTimeline.test.ts`):

```ts
import { cancellationTimeline, freeCancelByDate } from './cancellationTimeline';

describe('cancellationTimeline', () => {
  const checkIn = new Date('2026-05-15T00:00:00+05:30');

  it('Flexible: free cancel ends 1 day before check-in', () => {
    const freeBy = freeCancelByDate('Flexible', checkIn);
    expect(freeBy?.toISOString().slice(0, 10)).toBe('2026-05-13');
  });
  it('Strict: free cancel ends 14 days before check-in', () => {
    const freeBy = freeCancelByDate('Strict', checkIn);
    expect(freeBy?.toISOString().slice(0, 10)).toBe('2026-04-30');
  });
  it('returns generic copy when no check-in selected', () => {
    expect(cancellationTimeline('Flexible', null)[0].label).toBe('Full refund');
  });
});
```

### `legalIdentifiers.ts`
Returns `{ legalName, gstin, cin, nitiAayog, fssai }`. Today reads from a
hardcoded Atlas-defaults block. Tenant override hook is in place so non-
Atlas tenants automatically hide the legal grid (avoiding mis-attribution)
until you wire backend-side tenant config — see "Backend follow-ups" below.

### `TrustBand.tsx`
The 4-row section from Direction C. Reads:
- legal IDs via `getLegalIdentifiers()`
- check-in date via `useBooking()` for the refund timeline anchor
- listing tier + host phone via props

Renders nothing for missing data — pass `null`/`undefined` freely.

### `MobileBookBar.tsx`
Hidden ≥ sm. When the guest hasn't picked dates: shows `₹X / night` plus
"Check availability". When dates are set: shows `₹X total · N nights` plus
"Reserve" with the free-cancel deadline.

Tapping the CTA smooth-scrolls to `#booking-form` (the existing
`UnitBookingWidget` form) — does **not** open Razorpay. Razorpay still
flows through `UnitBookingWidget` exactly as before. This bar is just a
persistent jump-to-CTA, not a replacement checkout.

---

## Backend follow-ups (separate PR, not in this patch)

These are flagged by the design but **not implemented** here. If you want
the trust band to show real per-tenant / per-listing legal info instead of
Atlas defaults, the backend needs:

1. **Add to `/api/listings/public` listing payload:**
   - `legalIds?: { gstin?, cin?, nitiAayog?, fssai? }` (per-property override)
   - `photosVerifiedAt?: string | null` (already there in some shape — confirm field name)
   - `hostReplyAvgMinutes?: number` (currently the TrustBand prop is hardcoded to `12`)

2. **Add to tenant config:**
   - Per-tenant fallback for the above when the listing itself doesn't
     carry it. Today's `getLegalIdentifiers()` returns hardcoded Atlas
     defaults — replace those with a tenant-config lookup.

3. **Until either of the above lands:** non-Atlas tenants render TrustBand
   with only legalName (their tenant name) and no GSTIN/CIN/NITI Aayog/
   FSSAI cells. The "Direct booking · 0% commission" pill still shows. The
   cancellation, payment, and support rows render unchanged.

---

## What's NOT in this patch (and why)

- **Direction B** — the real-checkout funnel refactor. Reserve.tsx still
  redirects back to the property page, UnitBookingWidget still owns the
  Razorpay flow inline. Deferred per your call.
- **The price-card restructure** — total-first headline, free-cancel date
  pinned below CTA. UnitBookingWidget is 2,773 lines; surgically rewriting
  its price headline is its own PR. Today's price card is preserved.
- **The "📋 Bookings not found" emoji** in `MyBookingsPage.tsx` L100. Out
  of scope this round, but it should go in a cleanup PR — replace with
  Lucide `<Calendar size={32} className="text-text-muted" />`.
- **The remaining out-of-system chip** at `Homepage_PropertyDetails.tsx`
  L1455–1460 — the cancellation-tier chip using `bg-green-100/yellow-100/red-100`
  Tailwind defaults. Lives in the policies block, separate from the
  verified/instant-book pair we cleaned up. The TrustBand below it now
  carries this signal in the warm register; you could either delete the
  inline chip entirely or restyle it (`bg-accent-soft text-[var(--cta-primary)]`).
  Up to you — flagging.
- **Mountain wordmark migration** — separate PR per your note.
- **Phone-OTP** — staying zero-auth this round.

---

## Heuristic-review findings this patch closes

| # | Finding | Status |
|---|---|---|
| 04 | Glassmorphism in hero + navbar | ✅ Fixed |
| 05 | Out-of-system green/blue chips on property page | ✅ Fixed (the verified/instant-book pair; cancellation chip noted above) |
| 07 | "Who am I paying?" — legitimacy implied not stated | ✅ Fixed (TrustBand row 01) |
| 08 | Cancellation terms are post-hoc | ✅ Fixed (TrustBand row 02 with anchored timeline) |
| 10 | Trust-badge strip in wrong place | ✅ Fixed (TrustBand sits on property page where the price lives) |
| 11 | No sticky mobile "Book" CTA | ✅ Fixed (MobileBookBar) |
| **Bonus** | Mobile column reorder — booking widget renders above photos | ✅ Fixed (order-1/2 swap) |

Findings **01–03** (no real checkout, availability interstitial, price
above the fold) and **06** (uniform type scale — Cormorant Garamond doing
one job) are Direction B / a separate property-page price-card pass.
Findings **09** (no guest account) and **12** (native vs. custom date
picker) are out of scope per your call.

---

## Commit message suggestion

```
feat(property): add Trust Band + mobile book-bar, remove glassmorphism, fix mobile order

May 2026 review: Direction A + C from the property-page rebuild.

New components:
- TrustBand — 4-row section (legitimacy, cancellation, payment, support)
- MobileBookBar — persistent bottom CTA on < sm (jumps to #booking-form)
- cancellationTimeline — pure helper for the refund step computation
- legalIdentifiers — Atlas-defaults config; tenant override hook ready

Guardrail fixes:
- Slider.tsx: backdrop-filter removed from hero overlay (2 places) + 2 Link buttons
- Navbar.tsx: scroll-blur handler removed
- navbar.css: backdrop-filter removed from .navbar-container + dropdown
- Homepage_PropertyDetails: out-of-system green/blue chips → single warm pill
- Homepage_PropertyDetails: mobile order fix — photos before booking widget

Out of scope this PR: Direction B (real checkout), mountain wordmark migration,
phone-OTP, the price-card restructure inside UnitBookingWidget. Backend
follow-ups for tenant-level legal IDs noted in patch/README.md.

Refs: May 2026 heuristic review (findings #04, #05, #07, #08, #10, #11).
```
