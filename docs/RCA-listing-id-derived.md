# RCA: Listing ID Derived from Name (404 on Details)

## Problem
Guest portal called `GET /listings/102` → 404, but the API expects `GET /listings/{Listing.Id}` (e.g. `/listings/2`). The DB uses `Listing.Id` as PK: Atlas102 has `Id = 2`, not 102.

## Root cause
1. **Static data**: `propertyData` has `id` (room code: 101, 102) and `listingId` (PK: 1, 2). UI used `property.id` or `getUnitSlug(property)` which preferred `id` → produced "102" in the URL.
2. **Navigation**: `buildHomeUnitPath(propertySlug, unitSlug)` received `unitSlug` from `getUnitSlug(property)` → slugified `property.id` (102) or `property_name` → path became `/homes/.../102`.
3. **Details page**: `lookupId = unitSlug` (102) → `resolveListing("102")` → `GET /listings/102` → 404.

## Fix
- Use `listingId` (PK) end-to-end: `buildHomeUnitPath(propertySlug, listingId)`, `getListingNavigation` returns path with `listingId`.
- `content/homes` href uses `listingId` from `propertyData`.
- PropertyDetails finds by `listingId` first; guard on invalid `listingId`.
