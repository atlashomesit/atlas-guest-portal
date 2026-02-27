# Short Links

This project supports branded short URLs that send guests directly to Atlas property pages.

## Current short links

| Short path | Target URL |
| --- | --- |
| `/101` | /property_details/atlas-homes-room-101 |
| `/102` | /property_details/atlas-homes-room-102 |
| `/201` | /property_details/atlas-homes-room-201 |
| `/202` | /property_details/atlas-homes-room-202 |
| `/301` | /property_details/atlas-homes-room-301 |
| `/302` | /property_details/atlas-homes-room-302 |
| `/penthouse` | /property_details/atlas-penthouse-501 |
| `/501` | /property_details/atlas-homes-room-501 |

## How it works

All mappings live in [`src/config/shortLinks.ts`](../src/config/shortLinks.ts). The [`ShortLinkRedirect`](../src/components/ShortLinkRedirect.tsx) route reads the path segment, finds the matching target URL, sets `noindex,follow` + a canonical link, shows a branded loading state, and calls `window.location.replace` so browser history is not polluted.

Direct navigation is supported on Cloudflare Pages via [`public/_redirects`](../public/_redirects), which ensures SPA routes are served through `index.html`.

## Adding or updating a short link

1. Edit `src/config/shortLinks.ts` and update the `shortLinkMap` object with the new path → target URL mapping. Keep keys lowercase and use relative paths pointing at `/property_details/<slug>` routes so they work on any environment.
2. No router changes are required; the dynamic `/:shortCode` route will pick up new entries automatically.
3. Commit the change.

## Testing

- Open each short URL in a new tab (e.g., `/201`) and confirm it redirects to the correct property_details page.
- Refresh the short URL to ensure there is no 404 (Cloudflare Pages serves `index.html`).
- Try an unknown short URL (e.g., `/999`) to see the friendly not-found message with a button to go home.
- Inspect the page source or network panel to verify `noindex,follow` and a canonical link pointing at the target URL.
- Click the **Continue** button on the loading screen to ensure it immediately redirects.
