# Atlas Homes catalog

- Our Homes is static and driven by `src/content/rooms.ts` (single source of truth).
- The navbar "Our Homes" dropdown is generated from `rooms.ts` (desktop + mobile).
- Room route format: `/homes/{roomNo}` (e.g., `/homes/101`).
- To add or edit a home, add a single entry in `rooms.ts` with the title `Atlas Homes {roomNo}` and optional highlights/tagline/image.
- Homepage Our Homes cards and the sitemap both pull from `rooms.ts`, so no extra wiring is needed after updating the file.
