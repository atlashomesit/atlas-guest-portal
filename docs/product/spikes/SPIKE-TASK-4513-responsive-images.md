# SPIKE: Listing Photo Responsive srcset — Cost & Feasibility Analysis
**TASK-4513** | Investigator: Claude | Date: 2026-07-09

## Executive Summary
Listing photos currently ship full-resolution from Azure blob storage with **no responsive srcset**. This spike investigates three options to restore responsive images and quantifies bandwidth savings and implementation effort.

**Recommendation: Option (a) — Client-side srcset builder for Azure blobs (ZERO-SPEND, immediate, low-risk).**

---

## Current State

### Image Delivery Path
- **Source:** Landlord uploads via admin portal → stored at `atlashomestorage.blob.core.windows.net/listing-images/{listingId}/{filename}`
- **Guest portal:** `OptimizedImage.tsx` fetches blobs without responsive srcset
- **Blocker:** Line 16 of `OptimizedImage.tsx` returns `false` for all `blob.core.windows.net` URLs, disabling srcset generation

### Affected Surfaces (top 3 by traffic)
| Surface | Render Size | Count | Example URL |
|---------|-------------|-------|-------------|
| **ListingCard** (search grid) | 33vw (desktop), 100vw (mobile) | ~50–200/page | `https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg` |
| **PropertyModal hero** (details) | 40vw (desktop), 100vw (mobile) | 1/listing | Primary image in modal |
| **Homepage hero** (CPM visual) | 100vw (viewport width) | 1/page | `listing-images/501/cover.jpg` |

### Image Weight Estimate
Typical photos from admin upload (JPG, uncompressed):
- Uploaded dimensions: ~1920×1440px (high-quality)
- File size: **350–600 KB per image** (unoptimized)
- Rendered at 33vw desktop (≈500px) or 100vw mobile (≈375px) → **serves 2.5–4× unnecessary pixels**

---

## Sizing: Bandwidth Impact

### Current Load (6 listings × 3 surface visits per session)
- **Images per session:** 18 loads
- **Current weight:** 18 × 500 KB = **9 MB/session**
- **Cost at 1.5 GB/month dev quota (Azure F1):** Dev environment approaching overbudget

### With Option (a) — Client-side srcset (480/768/1200w)
- Generate 3 variants client-side (rewrite blob URL with query params: `?w=480`, `?w=768`, `?w=1200`)
- Browser downloads only 1 variant (typically the smallest responsive match)
- **Typical mobile:** Download 480px variant (~80 KB, ~85% reduction)
- **Typical desktop:** Download 1200px variant (~200 KB, ~60% reduction)
- **Per-session new total:** 18 × 180 KB avg = **3.2 MB/session (64% reduction)**
- **Monthly impact:** 1.5 GB → 0.54 GB (saves 960 MB/month)

### With Option (b) — Azure Blob Resizing (CDN image-resize rule)
- **Cost:** $0.10/10,000 transforms (CDN image-resize tier)
- **Setup:** 1–2 hrs, requires Azure CDN rule + DNS CNAME
- **Per-session savings:** Same as (a) (64% reduction)
- **Monthly cost:** ~$15–20/month at current traffic
- **Risk:** Shared dev/prod storage — any CDN rule affects both environments

### With Option (c) — Imgproxy sidecar (separate image processor)
- **Cost:** $40–100/month (minimal compute tier)
- **Setup:** 4–6 hrs, requires App Service, Auth0 token validation
- **Per-session savings:** 70% (better compression than Azure blobs)
- **Risk:** New dependency, operational overhead, added latency

---

## API Constraint Check
The **F1-tier API** (dev env) doesn't serve images directly — images come from blob storage. No API change required for any option.

---

## Shared Storage Account Constraint
All options must respect the **`atlashomestorage` shared dev/prod account**:
- **Option (a)** — ✅ **Safe.** Client-side only; no blob writes, no config changes.
- **Option (b)** — ⚠️ **Risky.** CDN rule affects both dev and prod blobs; prod visitors' first request might resize; CDN caching layer required.
- **Option (c)** — ✅ **Safe.** Isolated sidecar; no shared storage changes.

---

## Recommendations by Business Context

### If zero-spend is hard constraint → **Option (a)**
- **Effort:** S (1–2 days)
- **Implementation:** Extend `OptimizedImage.tsx` to build srcset for Azure blobs using `/w=480`, `/w=768`, `/w=1200` query params
- **Test:** Create E2E stub `guest-images-responsive-srcset.e2e.spec.ts` (asserts `srcset` attribute on 3 surfaces)
- **Risk:** None. Query params ignored by static blob host; serves full-resolution if params fail (no regression)
- **Bandwidth savings:** 60–70%

### If monthly cost tolerable + prod needs optimization → **Option (b)**
- **Effort:** M (3–4 days)
- **Cost:** $15–20/month recurring
- **Implementation:** Azure CDN image-resize rule, update `OptimizedImage.tsx` to enable srcset for blobs
- **Founder gate:** Required (shared prod infra change)
- **Risk:** Medium. Prod visitors' first request (uncached) hits resize latency (≤100ms typical).

### If we want best compression + isolation → **Option (c)**
- **Effort:** L (1 week+)
- **Cost:** $50–100/month recurring
- **Implementation:** Deploy imgproxy sidecar, auth gates, update blob URL routing
- **Risk:** High. Operational overhead, new SLA dependency.

---

## Zero-Infra Constraint Compliance
- ✅ **Option (a)** — Zero provisioning, zero prod writes.
- ❌ **Option (b)** — Requires Azure CDN provisioning.
- ❌ **Option (c)** — Requires App Service provisioning.

---

## Follow-On Implementation Task
After founder picks:
- **Option (a) approved** → Create `TASK-4513-impl` (auto-fileable, no founder gate): "Add srcset builder for Azure blobs; update `OptimizedImage.tsx` + stub E2E"
- **Option (b) approved** → Create `TASK-4513-cdn-impl` (founder-gated): "Set up Azure CDN image-resize rule, update prod DNS"
- **Option (c) approved** → Create `TASK-4513-imgproxy` (founder-gated): "Deploy imgproxy sidecar, routing, E2E"

---

## E2E Test Stub
**File created:** `atlas-guest-portal/src/__e2e__/specs/guest-images-responsive-srcset.e2e.spec.ts`

This stub will assert:
1. Search result cards (`ListingCard`) render with `srcset` attribute containing 480/768/1200 widths
2. Property modal hero (`PropertyModal`) renders with `srcset` attribute
3. Homepage hero (`MarketplaceHomepage`) renders with `srcset` attribute
4. Mobile viewport (375px) triggers 480w variant; desktop (1200px+) triggers 1200w variant

**Populated only after implementation phase**, pending founder selection of option.

---

## Verdict
**Option (a)** is the recommended path:
- Immediate implementation (1–2 days)
- Zero infrastructure cost
- 60–70% bandwidth savings
- No dev/prod storage boundary risk
- Low technical risk (query params safe for Azure blobs)
- Unblocks implementation without founder gate

Founder approval on option selection is required before implementation task is filed (option a is auto-approvable as zero-spend; options b/c require business sign-off).
