# Atlas Homes catalog

- Our Homes is static and driven by `src/content/homes.ts` (single source of truth).
- The navbar "Our Homes" dropdown is generated from `homes.ts` (desktop + mobile).
- Home route format: `/property_details/{slug}` (e.g., `/property_details/atlas-homes-room-101`).
- To add or edit a home, add a single entry in `homes.ts` with the title `Atlas Homes {roomNo}` and optional highlights/tagline/image. Ensure the slug matches an existing `/property_details/{slug}` page.
- Homepage Our Homes cards and the sitemap both pull from `homes.ts`, so no extra wiring is needed after updating the file.
