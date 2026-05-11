# atlas-guest-portal: commits after `2b56cef` (backup replay queue)

This document lists every commit on branch **`dev-backup-pre-2b56-reset`** that is **not** an ancestor of **`2b56cef`** - i.e. the work that was removed when **`dev`** was reset to **`2b56cef`**.

- **Repository:** `atlashomesit/atlas-guest-portal`
- **Base commit:** [`2b56cef`](https://github.com/atlashomesit/atlas-guest-portal/commit/2b56cef87261a16252b0e03bb58e3448c771a102) - Merge PR #151 (dependabot npm minor/patch)
- **Tip commit (backup branch):** [`c402c661`](https://github.com/atlashomesit/atlas-guest-portal/commit/c402c661c68d37605d9f0c9cc0f17f57a718086d)
- **Total commits:** 69
- **Replay order:** oldest to newest (same order as this document). Command: `git log --reverse --oneline 2b56cef..origin/dev-backup-pre-2b56-reset`

For each entry: **name-status** shows add/modify/delete; **diff statistics** shows insert/delete counts per file.

To regenerate this file after fetching `origin`: run `scripts/_generate-dev-backup-commit-guide.ps1` from the repository root (script lives under `scripts/`).

---

## 1. `08aabf70` chore(deps): bump react and @types/react

| Field | Value |
|-------|-------|
| Full SHA | `08aabf70ae9870b89ff6c2aad7356b227ea6b8ed` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-09T15:53:20Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/08aabf70ae9870b89ff6c2aad7356b227ea6b8ed) |

### Commit message (body)

```
Bumps [react](https://github.com/facebook/react/tree/HEAD/packages/react) and [@types/react](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/react). These dependencies needed to be updated together.  Updates `react` from 18.3.1 to 19.2.6 - [Release notes](https://github.com/facebook/react/releases) - [Changelog](https://github.com/facebook/react/blob/main/CHANGELOG.md) - [Commits](https://github.com/facebook/react/commits/v19.2.6/packages/react)  Updates `@types/react` from 18.3.28 to 19.2.14 - [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases) - [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/react)  --- updated-dependencies: - dependency-name: react   dependency-version: 19.2.6   dependency-type: direct:production   update-type: version-update:semver-major - dependency-name: "@types/react"   dependency-version: 19.2.14   dependency-type: direct:development   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
```

### Diff statistics

```text
 package-lock.json | 27 ++++++++-------------------
 package.json      |  4 ++--
 2 files changed, 10 insertions(+), 21 deletions(-)
```

---

## 2. `6b661f88` chore(deps-dev): bump tailwindcss from 3.4.19 to 4.3.0

| Field | Value |
|-------|-------|
| Full SHA | `6b661f88d566b3e02cb85ed468200dd454d35473` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-09T15:53:47Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/6b661f88d566b3e02cb85ed468200dd454d35473) |

### Commit message (body)

```
Bumps [tailwindcss](https://github.com/tailwindlabs/tailwindcss/tree/HEAD/packages/tailwindcss) from 3.4.19 to 4.3.0. - [Release notes](https://github.com/tailwindlabs/tailwindcss/releases) - [Changelog](https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md) - [Commits](https://github.com/tailwindlabs/tailwindcss/commits/v4.3.0/packages/tailwindcss)  --- updated-dependencies: - dependency-name: tailwindcss   dependency-version: 4.3.0   dependency-type: direct:development   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
```

### Diff statistics

```text
 package-lock.json | 698 +-----------------------------------------------------
 package.json      |   2 +-
 2 files changed, 6 insertions(+), 694 deletions(-)
```

---

## 3. `3943756b` chore(deps): bump react-router-dom from 6.30.3 to 7.15.0

| Field | Value |
|-------|-------|
| Full SHA | `3943756b183ef2e0387b881f9c50751ff2769157` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-09T15:54:04Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/3943756b183ef2e0387b881f9c50751ff2769157) |

### Commit message (body)

```
Bumps [react-router-dom](https://github.com/remix-run/react-router/tree/HEAD/packages/react-router-dom) from 6.30.3 to 7.15.0. - [Release notes](https://github.com/remix-run/react-router/releases) - [Changelog](https://github.com/remix-run/react-router/blob/main/packages/react-router-dom/CHANGELOG.md) - [Commits](https://github.com/remix-run/react-router/commits/react-router-dom@7.15.0/packages/react-router-dom)  --- updated-dependencies: - dependency-name: react-router-dom   dependency-version: 7.15.0   dependency-type: direct:production   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
```

### Diff statistics

```text
 package-lock.json | 52 +++++++++++++++++++++++++++-------------------------
 package.json      |  2 +-
 2 files changed, 28 insertions(+), 26 deletions(-)
```

---

## 4. `a42a82fd` chore(seo): recover JSON-LD + hreflang WIP from 2026-04-25 stash

| Field | Value |
|-------|-------|
| Full SHA | `a42a82fd4ba0fc92c66dad958930b5d49b0ce596` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T10:05:22+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/a42a82fd4ba0fc92c66dad958930b5d49b0ce596) |

### Commit message (body)

```
Recovered from atlas-guest-portal stash@{0} dated 2026-04-25 17:09. Adds: - LodgingBusiness/LocalBusiness JSON-LD with full business info (geo, address,   amenities, payment methods) - WebSite JSON-LD with SearchAction - hreflang="en-IN" and x-default alternate links  This content was never committed to any branch ΓÇö verified via `git log --all -S LodgingBusiness` returning no results. Stash also held _worker.bundle and public/sitemap.xml regen churn which was discarded (only meaningful index.html diff preserved). 
```

### Files changed (name-status)

```text
M  index.html
```

### Diff statistics

```text
 index.html | 55 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 55 insertions(+)
```

---

## 5. `0a58ea3a` Merge pull request #152 from atlashomesit/dependabot/npm_and_yarn/dev/multi-76a9a2998f

| Field | Value |
|-------|-------|
| Full SHA | `0a58ea3a8ed419a9b78274ca8f5927bfe33f1814` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T16:02:10+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/0a58ea3a8ed419a9b78274ca8f5927bfe33f1814) |

### Commit message (body)

```
chore(deps): bump react and @types/react
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  .env.example
M  .github/dependabot.yml
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
A  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
A  .gitleaks.toml
A  .markdownlint.json
M  AGENTS.md
A  docs/security/secret-rotation.md
M  package-lock.json
M  package.json
M  public/.well-known/atlas-runtime-config.json
D  public/be/asset-manifest.json
D  public/be/favicon.ico
D  public/be/index.html
D  public/be/logo192.f181800b.webp
D  public/be/logo192.png
D  public/be/logo512.f181800b.webp
D  public/be/logo512.png
D  public/be/manifest.json
D  public/be/robots.txt
D  public/be/static/css/main.5a8b9a96.css
D  public/be/static/css/main.5a8b9a96.css.map
D  public/be/static/js/453.cc1bb556.chunk.js
D  public/be/static/js/453.cc1bb556.chunk.js.map
D  public/be/static/js/main.caa69fb1.css
D  public/be/static/js/main.caa69fb1.css.map
D  public/be/static/js/main.caa69fb1.js
D  public/be/static/js/main.caa69fb1.js.LICENSE.txt
D  public/be/static/js/main.caa69fb1.js.map
M  public/sitemap.xml
D  public/static/css/main.a475c3c1.css
D  public/static/css/main.a475c3c1.css.map
D  public/static/js/787.a9ed2b2b.chunk.js
D  public/static/js/787.a9ed2b2b.chunk.js.map
D  public/static/js/main.0f16a38a.js
D  public/static/js/main.0f16a38a.js.LICENSE.txt
D  public/static/js/main.0f16a38a.js.map
A  public/sw-register.js
A  public/sw.js
M  src/App.tsx
D  src/components/CookieConsent (1).tsx
M  src/components/CookieConsent.tsx
M  src/components/CookieConsentBanner.tsx
D  src/components/RecentlyViewedStrip (1).tsx
M  src/components/ShortLinkRedirect.tsx
M  src/components/VirtualTourSection.tsx
M  src/components/apartments/ListingCard.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/home/BannerSecondary.tsx
M  src/components/home/ServicesSection.tsx
M  src/components/home/TestimonialsSection.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/components/homepage_components/homepage_exclusiveservice/ExclusiveService_Card.tsx
M  src/components/homepage_components/homepage_locations/HomePage_Locations.tsx
M  src/components/homepage_components/slider/Slider.tsx
D  src/components/search/SearchResultsMap (1).tsx
M  src/config/homepageUxFlags.ts
A  src/config/siteOrigin.ts
A  src/content/cities/cityLandingSlugs.ts
A  src/content/cities/coorg.json
A  src/content/cities/goa.json
A  src/content/cities/hyderabad.json
A  src/content/cities/manali.json
M  src/content/terms.ts
D  src/contexts/CurrencyContext (1).tsx
D  src/hooks/useTenantListings (1).ts
M  src/pages/AboutPage.tsx
M  src/pages/Amenities.tsx
M  src/pages/Apartments.tsx
M  src/pages/BecomeHost.tsx
M  src/pages/BookingConfirmationPage.tsx
A  src/pages/CityLandingPage.test.tsx
A  src/pages/CityLandingPage.tsx
M  src/pages/CommunicationPreferences.tsx
M  src/pages/FaqPage.tsx
M  src/pages/FavoritesPage.tsx
M  src/pages/GalleryPage.tsx
D  src/pages/MarketplaceHomepage (1).tsx
M  src/pages/MyBookingsPage.tsx
M  src/pages/OffersPage.tsx
M  src/pages/Policies.tsx
M  src/pages/PrivacyPage.tsx
M  src/pages/PrivacyPolicyPage.tsx
M  src/pages/ProfilePage.tsx
M  src/pages/RecentlyViewedPage.tsx
M  src/pages/ReviewSubmitPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/SelfCheckIn.tsx
M  src/pages/StubPage.tsx
M  src/pages/home/Home.tsx
M  src/pages/home/HomeDetails.tsx
A  src/pages/home/homeDetailsJsonLd.test.ts
A  src/pages/home/homeDetailsJsonLd.ts
M  src/tenant/displayBrand.ts
D  src/tenant/tenantOverrides (1).ts
M  src/tenant/tenantOverrides.ts
A  src/types/pannellum.d.ts
A  src/utils/cityListingFilter.ts
A  src/utils/directBookingPromo.ts
D  src/utils/propertyDataUtils (1).ts
D  src/utils/razorpayGuestErrors (1).ts
D  src/utils/serverErrorFromResponse (1).ts
M  src/vite-env.d.ts
M  tools/generate-sitemap.mjs
M  tools/optimize-images.mjs
M  vite.config.ts
```

### Diff statistics

```text
 package-lock.json | 27 ++++++++-------------------
 package.json      |  4 ++--
 2 files changed, 10 insertions(+), 21 deletions(-)
```

---

## 6. `2ee132fa` Merge pull request #154 from atlashomesit/dependabot/npm_and_yarn/dev/tailwindcss-4.3.0

| Field | Value |
|-------|-------|
| Full SHA | `2ee132faf7aa5a6a9591d0574ff6296b606b01ba` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T16:02:13+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/2ee132faf7aa5a6a9591d0574ff6296b606b01ba) |

### Commit message (body)

```
chore(deps-dev): bump tailwindcss from 3.4.19 to 4.3.0
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  .env.example
M  .github/dependabot.yml
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
A  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
A  .gitleaks.toml
A  .markdownlint.json
M  AGENTS.md
A  docs/security/secret-rotation.md
M  package-lock.json
M  package.json
M  public/.well-known/atlas-runtime-config.json
D  public/be/asset-manifest.json
D  public/be/favicon.ico
D  public/be/index.html
D  public/be/logo192.f181800b.webp
D  public/be/logo192.png
D  public/be/logo512.f181800b.webp
D  public/be/logo512.png
D  public/be/manifest.json
D  public/be/robots.txt
D  public/be/static/css/main.5a8b9a96.css
D  public/be/static/css/main.5a8b9a96.css.map
D  public/be/static/js/453.cc1bb556.chunk.js
D  public/be/static/js/453.cc1bb556.chunk.js.map
D  public/be/static/js/main.caa69fb1.css
D  public/be/static/js/main.caa69fb1.css.map
D  public/be/static/js/main.caa69fb1.js
D  public/be/static/js/main.caa69fb1.js.LICENSE.txt
D  public/be/static/js/main.caa69fb1.js.map
M  public/sitemap.xml
D  public/static/css/main.a475c3c1.css
D  public/static/css/main.a475c3c1.css.map
D  public/static/js/787.a9ed2b2b.chunk.js
D  public/static/js/787.a9ed2b2b.chunk.js.map
D  public/static/js/main.0f16a38a.js
D  public/static/js/main.0f16a38a.js.LICENSE.txt
D  public/static/js/main.0f16a38a.js.map
A  public/sw-register.js
A  public/sw.js
M  src/App.tsx
D  src/components/CookieConsent (1).tsx
M  src/components/CookieConsent.tsx
M  src/components/CookieConsentBanner.tsx
D  src/components/RecentlyViewedStrip (1).tsx
M  src/components/ShortLinkRedirect.tsx
M  src/components/VirtualTourSection.tsx
M  src/components/apartments/ListingCard.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/home/BannerSecondary.tsx
M  src/components/home/ServicesSection.tsx
M  src/components/home/TestimonialsSection.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/components/homepage_components/homepage_exclusiveservice/ExclusiveService_Card.tsx
M  src/components/homepage_components/homepage_locations/HomePage_Locations.tsx
M  src/components/homepage_components/slider/Slider.tsx
D  src/components/search/SearchResultsMap (1).tsx
M  src/config/homepageUxFlags.ts
A  src/config/siteOrigin.ts
A  src/content/cities/cityLandingSlugs.ts
A  src/content/cities/coorg.json
A  src/content/cities/goa.json
A  src/content/cities/hyderabad.json
A  src/content/cities/manali.json
M  src/content/terms.ts
D  src/contexts/CurrencyContext (1).tsx
D  src/hooks/useTenantListings (1).ts
M  src/pages/AboutPage.tsx
M  src/pages/Amenities.tsx
M  src/pages/Apartments.tsx
M  src/pages/BecomeHost.tsx
M  src/pages/BookingConfirmationPage.tsx
A  src/pages/CityLandingPage.test.tsx
A  src/pages/CityLandingPage.tsx
M  src/pages/CommunicationPreferences.tsx
M  src/pages/FaqPage.tsx
M  src/pages/FavoritesPage.tsx
M  src/pages/GalleryPage.tsx
D  src/pages/MarketplaceHomepage (1).tsx
M  src/pages/MyBookingsPage.tsx
M  src/pages/OffersPage.tsx
M  src/pages/Policies.tsx
M  src/pages/PrivacyPage.tsx
M  src/pages/PrivacyPolicyPage.tsx
M  src/pages/ProfilePage.tsx
M  src/pages/RecentlyViewedPage.tsx
M  src/pages/ReviewSubmitPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/SelfCheckIn.tsx
M  src/pages/StubPage.tsx
M  src/pages/home/Home.tsx
M  src/pages/home/HomeDetails.tsx
A  src/pages/home/homeDetailsJsonLd.test.ts
A  src/pages/home/homeDetailsJsonLd.ts
M  src/tenant/displayBrand.ts
D  src/tenant/tenantOverrides (1).ts
M  src/tenant/tenantOverrides.ts
A  src/types/pannellum.d.ts
A  src/utils/cityListingFilter.ts
A  src/utils/directBookingPromo.ts
D  src/utils/propertyDataUtils (1).ts
D  src/utils/razorpayGuestErrors (1).ts
D  src/utils/serverErrorFromResponse (1).ts
M  src/vite-env.d.ts
M  tools/generate-sitemap.mjs
M  tools/optimize-images.mjs
M  vite.config.ts
```

### Diff statistics

```text
 package-lock.json | 698 +-----------------------------------------------------
 package.json      |   2 +-
 2 files changed, 6 insertions(+), 694 deletions(-)
```

---

## 7. `2119b2db` Merge pull request #155 from atlashomesit/dependabot/npm_and_yarn/dev/react-router-dom-7.15.0

| Field | Value |
|-------|-------|
| Full SHA | `2119b2dbb302f4f1cdc63e7c6d130314f32403cf` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T16:02:16+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/2119b2dbb302f4f1cdc63e7c6d130314f32403cf) |

### Commit message (body)

```
chore(deps): bump react-router-dom from 6.30.3 to 7.15.0
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  .env.example
M  .github/dependabot.yml
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
A  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
A  .gitleaks.toml
A  .markdownlint.json
M  AGENTS.md
A  docs/security/secret-rotation.md
M  package-lock.json
M  package.json
M  public/.well-known/atlas-runtime-config.json
D  public/be/asset-manifest.json
D  public/be/favicon.ico
D  public/be/index.html
D  public/be/logo192.f181800b.webp
D  public/be/logo192.png
D  public/be/logo512.f181800b.webp
D  public/be/logo512.png
D  public/be/manifest.json
D  public/be/robots.txt
D  public/be/static/css/main.5a8b9a96.css
D  public/be/static/css/main.5a8b9a96.css.map
D  public/be/static/js/453.cc1bb556.chunk.js
D  public/be/static/js/453.cc1bb556.chunk.js.map
D  public/be/static/js/main.caa69fb1.css
D  public/be/static/js/main.caa69fb1.css.map
D  public/be/static/js/main.caa69fb1.js
D  public/be/static/js/main.caa69fb1.js.LICENSE.txt
D  public/be/static/js/main.caa69fb1.js.map
M  public/sitemap.xml
D  public/static/css/main.a475c3c1.css
D  public/static/css/main.a475c3c1.css.map
D  public/static/js/787.a9ed2b2b.chunk.js
D  public/static/js/787.a9ed2b2b.chunk.js.map
D  public/static/js/main.0f16a38a.js
D  public/static/js/main.0f16a38a.js.LICENSE.txt
D  public/static/js/main.0f16a38a.js.map
A  public/sw-register.js
A  public/sw.js
M  src/App.tsx
D  src/components/CookieConsent (1).tsx
M  src/components/CookieConsent.tsx
M  src/components/CookieConsentBanner.tsx
D  src/components/RecentlyViewedStrip (1).tsx
M  src/components/ShortLinkRedirect.tsx
M  src/components/VirtualTourSection.tsx
M  src/components/apartments/ListingCard.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/home/BannerSecondary.tsx
M  src/components/home/ServicesSection.tsx
M  src/components/home/TestimonialsSection.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/components/homepage_components/homepage_exclusiveservice/ExclusiveService_Card.tsx
M  src/components/homepage_components/homepage_locations/HomePage_Locations.tsx
M  src/components/homepage_components/slider/Slider.tsx
D  src/components/search/SearchResultsMap (1).tsx
M  src/config/homepageUxFlags.ts
A  src/config/siteOrigin.ts
A  src/content/cities/cityLandingSlugs.ts
A  src/content/cities/coorg.json
A  src/content/cities/goa.json
A  src/content/cities/hyderabad.json
A  src/content/cities/manali.json
M  src/content/terms.ts
D  src/contexts/CurrencyContext (1).tsx
D  src/hooks/useTenantListings (1).ts
M  src/pages/AboutPage.tsx
M  src/pages/Amenities.tsx
M  src/pages/Apartments.tsx
M  src/pages/BecomeHost.tsx
M  src/pages/BookingConfirmationPage.tsx
A  src/pages/CityLandingPage.test.tsx
A  src/pages/CityLandingPage.tsx
M  src/pages/CommunicationPreferences.tsx
M  src/pages/FaqPage.tsx
M  src/pages/FavoritesPage.tsx
M  src/pages/GalleryPage.tsx
D  src/pages/MarketplaceHomepage (1).tsx
M  src/pages/MyBookingsPage.tsx
M  src/pages/OffersPage.tsx
M  src/pages/Policies.tsx
M  src/pages/PrivacyPage.tsx
M  src/pages/PrivacyPolicyPage.tsx
M  src/pages/ProfilePage.tsx
M  src/pages/RecentlyViewedPage.tsx
M  src/pages/ReviewSubmitPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/SelfCheckIn.tsx
M  src/pages/StubPage.tsx
M  src/pages/home/Home.tsx
M  src/pages/home/HomeDetails.tsx
A  src/pages/home/homeDetailsJsonLd.test.ts
A  src/pages/home/homeDetailsJsonLd.ts
M  src/tenant/displayBrand.ts
D  src/tenant/tenantOverrides (1).ts
M  src/tenant/tenantOverrides.ts
A  src/types/pannellum.d.ts
A  src/utils/cityListingFilter.ts
A  src/utils/directBookingPromo.ts
D  src/utils/propertyDataUtils (1).ts
D  src/utils/razorpayGuestErrors (1).ts
D  src/utils/serverErrorFromResponse (1).ts
M  src/vite-env.d.ts
M  tools/generate-sitemap.mjs
M  tools/optimize-images.mjs
M  vite.config.ts
```

### Diff statistics

```text
 package-lock.json | 52 +++++++++++++++++++++++++++-------------------------
 package.json      |  2 +-
 2 files changed, 28 insertions(+), 26 deletions(-)
```

---

## 8. `a57c09b5` chore(deps): bump actions/checkout from 4 to 6

| Field | Value |
|-------|-------|
| Full SHA | `a57c09b52c1e20c9c9278140940990ecde9f2764` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-10T10:32:27Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/a57c09b52c1e20c9c9278140940990ecde9f2764) |

### Commit message (body)

```
Bumps [actions/checkout](https://github.com/actions/checkout) from 4 to 6. - [Release notes](https://github.com/actions/checkout/releases) - [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md) - [Commits](https://github.com/actions/checkout/compare/v4...v6)  --- updated-dependencies: - dependency-name: actions/checkout   dependency-version: '6'   dependency-type: direct:production   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
M  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
```

### Diff statistics

```text
 .github/workflows/ci.yml                 | 2 +-
 .github/workflows/docs-guardrails.yml    | 2 +-
 .github/workflows/lockfile-guard.yml     | 2 +-
 .github/workflows/secret-scan.yml        | 2 +-
 .github/workflows/sri-check.yml          | 2 +-
 .github/workflows/vulnerability-scan.yml | 2 +-
 6 files changed, 6 insertions(+), 6 deletions(-)
```

---

## 9. `79abe777` chore(deps): bump react-dom and @types/react-dom

| Field | Value |
|-------|-------|
| Full SHA | `79abe777d085fd7fd4653c952b83054aba4cffbd` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-10T10:33:01Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/79abe777d085fd7fd4653c952b83054aba4cffbd) |

### Commit message (body)

```
Bumps [react-dom](https://github.com/facebook/react/tree/HEAD/packages/react-dom) and [@types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/react-dom). These dependencies needed to be updated together.  Updates `react-dom` from 18.3.1 to 19.2.6 - [Release notes](https://github.com/facebook/react/releases) - [Changelog](https://github.com/facebook/react/blob/main/CHANGELOG.md) - [Commits](https://github.com/facebook/react/commits/v19.2.6/packages/react-dom)  Updates `@types/react-dom` from 18.3.7 to 19.2.3 - [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases) - [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/react-dom)  --- updated-dependencies: - dependency-name: "@types/react-dom"   dependency-version: 19.2.3   dependency-type: direct:development   update-type: version-update:semver-major - dependency-name: react-dom   dependency-version: 19.2.6   dependency-type: direct:production   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
```

### Diff statistics

```text
 package-lock.json | 35 +++++++++++++++--------------------
 package.json      |  4 ++--
 2 files changed, 17 insertions(+), 22 deletions(-)
```

---

## 10. `b1f7197d` Merge pull request #149 from atlashomesit/dependabot/github_actions/dev/actions/checkout-6

| Field | Value |
|-------|-------|
| Full SHA | `b1f7197dcb7f5582974c5501f2dced70747754ca` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T16:03:03+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/b1f7197dcb7f5582974c5501f2dced70747754ca) |

### Commit message (body)

```
chore(deps): bump actions/checkout from 4 to 6
```

### Files changed (name-status)

```text
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
M  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
```

### Diff statistics

```text
 .github/workflows/ci.yml                 | 2 +-
 .github/workflows/docs-guardrails.yml    | 2 +-
 .github/workflows/lockfile-guard.yml     | 2 +-
 .github/workflows/secret-scan.yml        | 2 +-
 .github/workflows/sri-check.yml          | 2 +-
 .github/workflows/vulnerability-scan.yml | 2 +-
 6 files changed, 6 insertions(+), 6 deletions(-)
```

---

## 11. `c267a5bf` Merge pull request #153 from atlashomesit/dependabot/npm_and_yarn/dev/multi-bb2efd036b

| Field | Value |
|-------|-------|
| Full SHA | `c267a5bfd47aa515d5fd97cf3d0758a6f3dc57b3` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T16:03:06+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c267a5bfd47aa515d5fd97cf3d0758a6f3dc57b3) |

### Commit message (body)

```
chore(deps): bump react-dom and @types/react-dom
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  .github/workflows/ci.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
M  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
```

### Diff statistics

```text
 package-lock.json | 35 +++++++++++++++--------------------
 package.json      |  4 ++--
 2 files changed, 17 insertions(+), 22 deletions(-)
```

---

## 12. `dfec07d0` fix(guest): SGH daily-QA P0/P1 batch ΓÇö chat brand leak, hero CTA overflow, listing titles, location fallback

| Field | Value |
|-------|-------|
| Full SHA | `dfec07d0037a583568bd16c83adf7f6803a0c9f3` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:04:18+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/dfec07d0037a583568bd16c83adf7f6803a0c9f3) |

### Commit message (body)

```
Implements 5 of 6 tasks filed by atlas-starguesthouse-daily-qa 2026-05-10:  - TASK-2205 [P0] Replace "Chat with Atlas" subtitle in support drawer with brand-templated copy. Header.title and header.subtitle in supportDrawerCopy.ts converted to factory functions; brandName threaded through SupportDrawer prop. SGH now renders "Star Guest House Concierge" + "Chat with Star Guest HouseΓÇª". Eliminates the visible Atlas brand leak on white-label tenants. - TASK-2206 [P2] Header restored to tenant-branded "${brand} Concierge" via the same factory functions, satisfying the SGH daily-QA spec. - TASK-2207 [P1] Hero "Check availability" submit field-card widened (lg:min-w-[180px]) and padding trimmed (lg:!px-4) so the CTA text no longer clips at desktop viewports. - TASK-2208 [P1] New utils/formatListingTitle.ts converts underscored slugs to spaced display names. Applied at 24+ render sites across Homepage_PropertyDetails, HomePage_Locations, and HomeDetails (h1, document.title, OG/Twitter, JSON-LD, share text, deep links, alt text). Slug-derivation, analytics payloads, and pattern-matching call sites intentionally left raw. - TASK-2209 [P2] property_location fallback now uses the populated propertyAddress when property_location is null/undefined, before falling back to "Location not specified".  TASK-2210 [P0] is data-side only (8 SGH listings have inverted check-in/out times in the database) ΓÇö moved to MANUAL-DEVELOPER-BACKLOG.md "Production data / compliance" section. Renderer is correct; no guest-portal code change needed.  GitHub issues: atlas-guest-portal#160, #161, #162, #163, #164, #165.  tsc --noEmit: PASS.  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/SearchAvailabilityWidget.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/components/homepage_components/homepage_locations/HomePage_Locations.tsx
M  src/components/support-drawer/SupportDrawer.tsx
M  src/components/support-drawer/SupportWidget.tsx
M  src/config/supportDrawerCopy.ts
M  src/pages/home/HomeDetails.tsx
A  src/utils/formatListingTitle.ts
```

### Diff statistics

```text
 .../availability/SearchAvailabilityWidget.tsx      |  2 +-
 .../Homepage_PropertyDetails.tsx                   | 27 +++++++++++-----------
 .../homepage_locations/HomePage_Locations.tsx      |  9 ++++----
 src/components/support-drawer/SupportDrawer.tsx    |  6 +++--
 src/components/support-drawer/SupportWidget.tsx    |  1 +
 src/config/supportDrawerCopy.ts                    |  8 +++++--
 src/pages/home/HomeDetails.tsx                     | 21 +++++++++--------
 src/utils/formatListingTitle.ts                    | 23 ++++++++++++++++++
 8 files changed, 66 insertions(+), 31 deletions(-)
```

---

## 13. `00e8fea9` feat(guest): TASK-1982 star-rating histogram on listing cards

| Field | Value |
|-------|-------|
| Full SHA | `00e8fea9164d7e38ea5e1e94caa255026b4195de` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:23:23+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/00e8fea9164d7e38ea5e1e94caa255026b4195de) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/api/listingClient.ts
M  src/components/apartments/ListingCard.tsx
M  src/hooks/useTenantListings.ts
M  src/pages/Apartments.tsx
M  src/pages/CityLandingPage.tsx
```

### Diff statistics

```text
 src/api/listingClient.ts                  |  8 ++++++++
 src/components/apartments/ListingCard.tsx | 30 ++++++++++++++++++++++++++++++
 src/hooks/useTenantListings.ts            |  3 +++
 src/pages/Apartments.tsx                  |  3 +++
 src/pages/CityLandingPage.tsx             |  2 ++
 5 files changed, 46 insertions(+)
```

---

## 14. `85ec810e` test(guest): refresh About page snapshot

| Field | Value |
|-------|-------|
| Full SHA | `85ec810ed7f4761ed4f1ac177a2423f5268b593d` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:25:01+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/85ec810ed7f4761ed4f1ac177a2423f5268b593d) |

### Commit message (body)

```
Update the AboutPage snapshot for the current typography class changes so the guest portal test suite matches rendered output.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  tests/__snapshots__/AboutPage.test.tsx.snap
```

### Diff statistics

```text
 tests/__snapshots__/AboutPage.test.tsx.snap | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

---

## 15. `e7f5daf7` fix(guest): use Tailwind v4 PostCSS plugin

| Field | Value |
|-------|-------|
| Full SHA | `e7f5daf7b1e70c8ff28d82d6291df903bdd6ace7` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:29:24+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/e7f5daf7b1e70c8ff28d82d6291df903bdd6ace7) |

### Commit message (body)

```
Add @tailwindcss/postcss and update PostCSS config so Vitest and Vite can process Tailwind v4 styles.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  postcss.config.js
```

### Diff statistics

```text
 package-lock.json | 342 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 package.json      |   1 +
 postcss.config.js |   2 +-
 3 files changed, 344 insertions(+), 1 deletion(-)
```

---

## 16. `4f824625` test(guest): refresh DatePicker snapshot

| Field | Value |
|-------|-------|
| Full SHA | `4f824625ca7fc78536e39f6b454f0c362bd92d06` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:32:58+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/4f824625ca7fc78536e39f6b454f0c362bd92d06) |

### Commit message (body)

```
Update the mobile date-picker snapshot for current React id output and hero field sizing.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  tests/__snapshots__/DatePicker.test.tsx.snap
```

### Diff statistics

```text
 tests/__snapshots__/DatePicker.test.tsx.snap | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)
```

---

## 17. `f402594e` feat(guest): add checkout deposit consent disclosure

| Field | Value |
|-------|-------|
| Full SHA | `f402594e1d466938feff2ebea88a122330986dcf` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T16:44:22+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/f402594e1d466938feff2ebea88a122330986dcf) |

### Commit message (body)

```
Pass listing security-deposit amounts into guest checkout, require explicit acknowledgement when needed, and replace legacy Tailwind @apply chip styles with plain CSS for Tailwind v4 builds.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  public/sitemap.xml
M  src/api/listingClient.ts
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/index.css
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 public/sitemap.xml                                 | 42 +++++++++----------
 src/api/listingClient.ts                           |  8 ++++
 src/components/availability/UnitBookingWidget.tsx  | 47 +++++++++++++++++++++-
 .../Homepage_PropertyDetails.tsx                   |  8 ++++
 src/index.css                                      | 14 ++++++-
 src/pages/home/HomeDetails.tsx                     |  2 +
 6 files changed, 97 insertions(+), 24 deletions(-)
```

---

## 18. `ae0b272f` City landing, listing client filters, and sitemap updates

| Field | Value |
|-------|-------|
| Full SHA | `ae0b272fe79ab510cfe4daf8b539e7c7244de5f8` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T17:05:13+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/ae0b272fe79ab510cfe4daf8b539e7c7244de5f8) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  public/sitemap.xml
M  src/api/listingClient.ts
M  src/pages/CityLandingPage.test.tsx
M  src/pages/CityLandingPage.tsx
M  src/utils/cityListingFilter.ts
```

### Diff statistics

```text
 public/sitemap.xml                 | 42 ++++++++++++------------
 src/api/listingClient.ts           | 65 +++++++++++++++++++++++++++-----------
 src/pages/CityLandingPage.test.tsx |  1 +
 src/pages/CityLandingPage.tsx      | 13 ++++----
 src/utils/cityListingFilter.ts     |  4 +--
 5 files changed, 76 insertions(+), 49 deletions(-)
```

---

## 19. `94a76c4c` fix(gitleaks): allowlist env-var reads in atlas-sql-password-assignment

| Field | Value |
|-------|-------|
| Full SHA | `94a76c4c3400f32f0f6cebdde85f80798423e6e0` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T17:30:35+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/94a76c4c3400f32f0f6cebdde85f80798423e6e0) |

### Commit message (body)

```
The rule was over-matching common patterns like:   var pw = process.env.E2E_X_PASSWORD ?? '';   var pw = Environment.GetEnvironmentVariable("X_PASSWORD");  These are reading FROM env, not declaring leaked secrets. Today's devΓåÆmain PRs all hit this false positive (1 in atlas-api, 9 in atlas-e2e, 1-equiv in others). Adding a per-rule allowlist with regexTarget=line preserves the rule's intent (catch literal SQL connection-string passwords) while excluding the legitimate code patterns. Same fix applied to all 4 repo .gitleaks.toml files.  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  .gitleaks.toml
```

### Diff statistics

```text
 .gitleaks.toml | 9 +++++++++
 1 file changed, 9 insertions(+)
```

---

## 20. `20609034` fix(docs): sync .markdownlint.json with .markdownlint-cli2.jsonc disables

| Field | Value |
|-------|-------|
| Full SHA | `20609034ae19edda55c292619ba82d994c0c4bac` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T17:35:02+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/20609034ae19edda55c292619ba82d994c0c4bac) |

### Commit message (body)

```
The minimal .markdownlint.json added on 2026-05-10 didn't carry over the team's intentional rule disables that already live in .markdownlint-cli2.jsonc. Result: CI markdownlint check (which reads .markdownlint.json) was firing rules the cli2 config explicitly disables. Bringing them into alignment.  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  .markdownlint.json
```

### Diff statistics

```text
 .markdownlint.json | 17 ++++++++++++++++-
 1 file changed, 16 insertions(+), 1 deletion(-)
```

---

## 21. `20057063` fix(gitleaks): allowlist public runtime-config json (Google Maps key is restricted in GCP)

| Field | Value |
|-------|-------|
| Full SHA | `200570632aa3b25652a7a39f3f01c171ce4bdbd9` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T17:42:00+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/200570632aa3b25652a7a39f3f01c171ce4bdbd9) |

### Commit message (body)

```
The googleMapsApiKey in public/.well-known/atlas-runtime-config.json is public-by-design ΓÇö browsers must read it to call Google Maps. Key is locked to atlashomestays.com / atlastays.com / localhost referrers in GCP console, so exposure is harmless. Adding to global allowlist unblocks devΓåÆmain PR #158.  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  .gitleaks.toml
```

### Diff statistics

```text
 .gitleaks.toml | 4 ++++
 1 file changed, 4 insertions(+)
```

---

## 22. `07b79e96` chore(deps): bump dependabot/fetch-metadata from 2 to 3

| Field | Value |
|-------|-------|
| Full SHA | `07b79e960aa28a84a5b2f388ad986a13a709fd3f` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-10T12:16:12Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/07b79e960aa28a84a5b2f388ad986a13a709fd3f) |

### Commit message (body)

```
Bumps [dependabot/fetch-metadata](https://github.com/dependabot/fetch-metadata) from 2 to 3. - [Release notes](https://github.com/dependabot/fetch-metadata/releases) - [Commits](https://github.com/dependabot/fetch-metadata/compare/v2...v3)  --- updated-dependencies: - dependency-name: dependabot/fetch-metadata   dependency-version: '3'   dependency-type: direct:production   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  .github/workflows/dependabot-auto-merge.yml
```

### Diff statistics

```text
 .github/workflows/dependabot-auto-merge.yml | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

---

## 23. `1482abf6` chore(deps): bump react-leaflet from 4.2.1 to 5.0.0

| Field | Value |
|-------|-------|
| Full SHA | `1482abf6b45e610126be3fbdea584269a93274d9` |
| Author | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| Commit date | 2026-05-10T12:17:22Z |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/1482abf6b45e610126be3fbdea584269a93274d9) |

### Commit message (body)

```
Bumps [react-leaflet](https://github.com/PaulLeCam/react-leaflet) from 4.2.1 to 5.0.0. - [Release notes](https://github.com/PaulLeCam/react-leaflet/releases) - [Changelog](https://github.com/PaulLeCam/react-leaflet/blob/master/CHANGELOG.md) - [Commits](https://github.com/PaulLeCam/react-leaflet/compare/v4.2.1...v5.0.0)  --- updated-dependencies: - dependency-name: react-leaflet   dependency-version: 5.0.0   dependency-type: direct:production   update-type: version-update:semver-major ...  Signed-off-by: dependabot[bot] <support@github.com>
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
```

### Diff statistics

```text
 package-lock.json | 36 ++++++++++++------------------------
 package.json      |  2 +-
 2 files changed, 13 insertions(+), 25 deletions(-)
```

---

## 24. `52e3305b` Merge pull request #166 from atlashomesit/dependabot/github_actions/dev/dependabot/fetch-metadata-3

| Field | Value |
|-------|-------|
| Full SHA | `52e3305b86d814effe48ed99617b2b08ab7c7441` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T17:55:13+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/52e3305b86d814effe48ed99617b2b08ab7c7441) |

### Commit message (body)

```
chore(deps): bump dependabot/fetch-metadata from 2 to 3
```

### Files changed (name-status)

```text
M  .github/workflows/dependabot-auto-merge.yml
```

### Diff statistics

```text
 .github/workflows/dependabot-auto-merge.yml | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

---

## 25. `846c5226` Merge pull request #167 from atlashomesit/dependabot/npm_and_yarn/dev/react-leaflet-5.0.0

| Field | Value |
|-------|-------|
| Full SHA | `846c52265f35c610c490aa2d5d278fe6587d2382` |
| Author | atlashomesit <atlashomesit@gmail.com> |
| Commit date | 2026-05-10T17:55:15+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/846c52265f35c610c490aa2d5d278fe6587d2382) |

### Commit message (body)

```
chore(deps): bump react-leaflet from 4.2.1 to 5.0.0
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  .github/workflows/dependabot-auto-merge.yml
```

### Diff statistics

```text
 package-lock.json | 36 ++++++++++++------------------------
 package.json      |  2 +-
 2 files changed, 13 insertions(+), 25 deletions(-)
```

---

## 26. `e838a83d` docs(agents): link to canonical parallel-agent safety rules in atlas-e2e

| Field | Value |
|-------|-------|
| Full SHA | `e838a83d4eef08b6b085bcc4c03afe9c722ffcd0` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T18:05:58+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/e838a83d4eef08b6b085bcc4c03afe9c722ffcd0) |

### Commit message (body)

```
Adds one-line reference to atlas-e2e/docs/agents/PARALLEL-AGENT-SAFETY.md so Cursor and other agents reading this repo's AGENTS.md see the shared no-touch / push-discipline / stop-condition rules without each repo duplicating them.  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  AGENTS.md
```

### Diff statistics

```text
 AGENTS.md | 1 +
 1 file changed, 1 insertion(+)
```

---

## 27. `fcf20063` TASK-1478: Prefer API sitemap and point robots at atlastays.com

| Field | Value |
|-------|-------|
| Full SHA | `fcf20063ab5ac7b973feec60ff8a58455daa03d8` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T18:18:08+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/fcf20063ab5ac7b973feec60ff8a58455daa03d8) |

### Commit message (body)

```
Cloudflare sitemap function now proxies GET /api/public/sitemap.xml when ATLAS_API_BASE_URL is set, passing X-Public-Origin and X-Tenant-Slug so each tenant host serves DB-backed loc URLs. Fall back to JSON listings + core paths when the API is unavailable. Default static sitemap origin and robots Sitemap line use https://atlastays.com; regenerate public/sitemap.xml via generate-sitemap.mjs.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  functions/sitemap.xml.ts
M  public/robots.txt
M  public/sitemap.xml
M  tools/generate-sitemap.mjs
```

### Diff statistics

```text
 functions/sitemap.xml.ts   | 26 ++++++++++++++
 public/robots.txt          |  2 +-
 public/sitemap.xml         | 84 +++++++++++++++++++++++-----------------------
 tools/generate-sitemap.mjs |  2 +-
 4 files changed, 70 insertions(+), 44 deletions(-)
```

---

## 28. `37e2a8e2` TASK-1478: dynamic robots Sitemap per host and sitemap fallback paths

| Field | Value |
|-------|-------|
| Full SHA | `37e2a8e203ed0e5f765b071afc82daec5ed9d763` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T18:36:07+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/37e2a8e203ed0e5f765b071afc82daec5ed9d763) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
A  functions/robots.txt.ts
M  functions/sitemap.xml.ts
A  tests/RobotsTxt.test.ts
```

### Diff statistics

```text
 functions/robots.txt.ts  | 39 +++++++++++++++++++++++++++++++++++++++
 functions/sitemap.xml.ts |  5 +++++
 tests/RobotsTxt.test.ts  | 15 +++++++++++++++
 3 files changed, 59 insertions(+)
```

---

## 29. `c6853b06` merge branch 'task/TASK-1478-sitemap-per-tenant' into dev

| Field | Value |
|-------|-------|
| Full SHA | `c6853b06bbb7f4e0d7c0f441700fa12c08ef6c82` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T18:52:30+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c6853b06bbb7f4e0d7c0f441700fa12c08ef6c82) |

### Files changed (name-status)

```text
A  functions/robots.txt.ts
M  functions/sitemap.xml.ts
A  tests/RobotsTxt.test.ts
```

### Diff statistics

```text
 functions/robots.txt.ts  | 39 +++++++++++++++++++++++++++++++++++++++
 functions/sitemap.xml.ts |  5 +++++
 tests/RobotsTxt.test.ts  | 15 +++++++++++++++
 3 files changed, 59 insertions(+)
```

---

## 30. `7f7e22f2` TASK-1936: Helmet meta from public listing detail API

| Field | Value |
|-------|-------|
| Full SHA | `7f7e22f2bd44ec92bb3407bd32e862e799015552` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T18:56:30+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/7f7e22f2bd44ec92bb3407bd32e862e799015552) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  src/api/listingClient.ts
M  src/main.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 package-lock.json              | 36 ++++++++++++++++++++++++++++++++++++
 package.json                   |  1 +
 src/api/listingClient.ts       | 37 +++++++++++++++++++++++++++++++++++++
 src/main.tsx                   | 17 ++++++++++-------
 src/pages/home/HomeDetails.tsx | 34 ++++++++++++++++++++++++++++++++++
 5 files changed, 118 insertions(+), 7 deletions(-)
```

---

## 31. `e56a7a9a` test(guest): TASK-2208 unit tests for formatListingTitle slug display helper

| Field | Value |
|-------|-------|
| Full SHA | `e56a7a9afb7b8d059275c1855b6cb8b8a3cf93a6` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T19:10:08+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/e56a7a9afb7b8d059275c1855b6cb8b8a3cf93a6) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
A  src/utils/formatListingTitle.test.ts
```

### Diff statistics

```text
 src/utils/formatListingTitle.test.ts | 19 +++++++++++++++++++
 1 file changed, 19 insertions(+)
```

---

## 32. `cedb102e` Merge task/TASK-1936-listing-seo-meta into dev

| Field | Value |
|-------|-------|
| Full SHA | `cedb102ee04c7f9fd1f1b4aecd726e43843759da` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T19:18:00+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/cedb102ee04c7f9fd1f1b4aecd726e43843759da) |

### Commit message (body)

```
Wires Helmet meta tags (title/description) from public listing detail API. 
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
M  src/api/listingClient.ts
M  src/main.tsx
M  src/pages/home/HomeDetails.tsx
A  src/utils/formatListingTitle.test.ts
```

### Diff statistics

```text
 package-lock.json              | 36 ++++++++++++++++++++++++++++++++++++
 package.json                   |  1 +
 src/api/listingClient.ts       | 37 +++++++++++++++++++++++++++++++++++++
 src/main.tsx                   | 17 ++++++++++-------
 src/pages/home/HomeDetails.tsx | 34 ++++++++++++++++++++++++++++++++++
 5 files changed, 118 insertions(+), 7 deletions(-)
```

---

## 33. `a33db67e` Merge chore/seo-jsonld-recovered into dev

| Field | Value |
|-------|-------|
| Full SHA | `a33db67ead1b5f27e9445c991f4dc899dfa3e685` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T19:26:35+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/a33db67ead1b5f27e9445c991f4dc899dfa3e685) |

### Commit message (body)

```
Adds LodgingBusiness/LocalBusiness + WebSite JSON-LD with SearchAction, plus en-IN + x-default hreflang alternates to index.html. Recovered from a 2026-04-25 stash. 
```

### Files changed (name-status)

```text
M  index.html
M  .env.example
M  .github/dependabot.yml
M  .github/workflows/ci.yml
M  .github/workflows/dependabot-auto-merge.yml
M  .github/workflows/docs-guardrails.yml
M  .github/workflows/lockfile-guard.yml
M  .github/workflows/secret-scan.yml
M  .github/workflows/sri-check.yml
M  .github/workflows/vulnerability-scan.yml
M  .gitleaks.toml
A  .markdownlint.json
M  AGENTS.md
A  functions/robots.txt.ts
M  functions/sitemap.xml.ts
M  package-lock.json
M  package.json
M  postcss.config.js
D  public/be/asset-manifest.json
D  public/be/favicon.ico
D  public/be/index.html
D  public/be/logo192.f181800b.webp
D  public/be/logo192.png
D  public/be/logo512.f181800b.webp
D  public/be/logo512.png
D  public/be/manifest.json
D  public/be/robots.txt
D  public/be/static/css/main.5a8b9a96.css
D  public/be/static/css/main.5a8b9a96.css.map
D  public/be/static/js/453.cc1bb556.chunk.js
D  public/be/static/js/453.cc1bb556.chunk.js.map
D  public/be/static/js/main.caa69fb1.css
D  public/be/static/js/main.caa69fb1.css.map
D  public/be/static/js/main.caa69fb1.js
D  public/be/static/js/main.caa69fb1.js.LICENSE.txt
D  public/be/static/js/main.caa69fb1.js.map
M  public/robots.txt
M  public/sitemap.xml
D  public/static/css/main.a475c3c1.css
D  public/static/css/main.a475c3c1.css.map
D  public/static/js/787.a9ed2b2b.chunk.js
D  public/static/js/787.a9ed2b2b.chunk.js.map
D  public/static/js/main.0f16a38a.js
D  public/static/js/main.0f16a38a.js.LICENSE.txt
D  public/static/js/main.0f16a38a.js.map
A  public/sw-register.js
A  public/sw.js
M  src/App.tsx
M  src/api/listingClient.ts
M  src/components/CookieConsentBanner.tsx
M  src/components/apartments/ListingCard.tsx
M  src/components/availability/SearchAvailabilityWidget.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/components/homepage_components/homepage_locations/HomePage_Locations.tsx
M  src/components/homepage_components/slider/Slider.tsx
M  src/components/support-drawer/SupportDrawer.tsx
M  src/components/support-drawer/SupportWidget.tsx
A  src/config/siteOrigin.ts
M  src/config/supportDrawerCopy.ts
A  src/content/cities/cityLandingSlugs.ts
A  src/content/cities/coorg.json
A  src/content/cities/goa.json
A  src/content/cities/hyderabad.json
A  src/content/cities/manali.json
M  src/hooks/useTenantListings.ts
M  src/index.css
M  src/main.tsx
M  src/pages/AboutPage.tsx
M  src/pages/Apartments.tsx
M  src/pages/BecomeHost.tsx
M  src/pages/BookingConfirmationPage.tsx
A  src/pages/CityLandingPage.test.tsx
A  src/pages/CityLandingPage.tsx
M  src/pages/CommunicationPreferences.tsx
M  src/pages/MyBookingsPage.tsx
M  src/pages/Policies.tsx
M  src/pages/PrivacyPage.tsx
M  src/pages/ProfilePage.tsx
M  src/pages/RecentlyViewedPage.tsx
M  src/pages/ReviewSubmitPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/home/Home.tsx
M  src/pages/home/HomeDetails.tsx
A  src/pages/home/homeDetailsJsonLd.test.ts
A  src/pages/home/homeDetailsJsonLd.ts
M  src/tenant/tenantOverrides.ts
A  src/utils/cityListingFilter.ts
A  src/utils/directBookingPromo.ts
A  src/utils/formatListingTitle.test.ts
A  src/utils/formatListingTitle.ts
M  src/vite-env.d.ts
A  tests/RobotsTxt.test.ts
M  tests/__snapshots__/AboutPage.test.tsx.snap
M  tests/__snapshots__/DatePicker.test.tsx.snap
M  tools/generate-sitemap.mjs
M  tools/optimize-images.mjs
M  vite.config.ts
```

### Diff statistics

```text
 index.html | 55 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 55 insertions(+)
```

---

## 34. `46a2e643` feat(monitoring): TASK-1495/1505 trace ids on API errors and Sentry tenant tags

| Field | Value |
|-------|-------|
| Full SHA | `46a2e64336815c66215cccc1402d4120f1432757` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T21:43:12+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/46a2e64336815c66215cccc1402d4120f1432757) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/lib/monitoring.ts
```

### Diff statistics

```text
 src/lib/monitoring.ts | 34 ++++++++++++++++++++++++++++++++--
 1 file changed, 32 insertions(+), 2 deletions(-)
```

---

## 35. `ced10030` feat: wire AI meta-title/description into listing detail pages (TASK-1936)

| Field | Value |
|-------|-------|
| Full SHA | `ced100301b5613387a3aa7b8f8df977e03b7de90` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T21:45:06+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/ced100301b5613387a3aa7b8f8df977e03b7de90) |

### Commit message (body)

```
Implementation already shipped via Merge task/TASK-1936-listing-seo-meta into dev (cedb102e). Verified: PublicListing type, normalizePublicListing, fetchPublicListingById, HomeDetails.tsx seoListing/pageTitle/pageDescription logic all present. Sitemap regenerated by prebuild scripts.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  public/sitemap.xml
```

### Diff statistics

```text
 public/sitemap.xml | 42 +++++++++++++++++++++---------------------
 1 file changed, 21 insertions(+), 21 deletions(-)
```

---

## 36. `3c937867` feat: add conversion funnel analytics events to guest portal (TASK-1480)

| Field | Value |
|-------|-------|
| Full SHA | `3c937867dd96ecb4fe9f47a63206cc9a31d7a22e` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T21:45:18+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/3c937867dd96ecb4fe9f47a63206cc9a31d7a22e) |

### Commit message (body)

```
Adds four trackEvent() calls from utils/analytics at canonical funnel checkpoints: - search_submitted: hero search form submit (city, checkIn, checkOut) - listing_viewed: HomeDetails mount (listingId, listingName) - checkout_started: UnitBookingWidget Book Now click (listingId, amount) - booking_confirmed: BookingConfirmationPage on booking load (bookingRef, amount)  All calls are additive alongside existing track() calls; no existing logic changed.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/SearchAvailabilityWidget.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/pages/BookingConfirmationPage.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/availability/SearchAvailabilityWidget.tsx | 7 +++++++
 src/components/availability/UnitBookingWidget.tsx        | 3 +++
 src/pages/BookingConfirmationPage.tsx                    | 3 +++
 src/pages/home/HomeDetails.tsx                           | 7 ++++++-
 4 files changed, 19 insertions(+), 1 deletion(-)
```

---

## 37. `575456c2` feat(guest): payout verified badge from hostVerified API (TASK-1487)

| Field | Value |
|-------|-------|
| Full SHA | `575456c206fe78427bfd65b63172172eb35f44e7` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T21:57:16+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/575456c206fe78427bfd65b63172172eb35f44e7) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/api/listingClient.ts
M  src/components/apartments/ListingCard.tsx
M  src/pages/CityLandingPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/api/listingClient.ts                  |  3 +++
 src/components/apartments/ListingCard.tsx | 16 +++++++++++++++-
 src/pages/CityLandingPage.tsx             |  2 ++
 src/pages/SearchPage.tsx                  | 15 ++++++++++++++-
 src/pages/home/HomeDetails.tsx            | 15 +++++++++++++++
 5 files changed, 49 insertions(+), 2 deletions(-)
```

---

## 38. `1f8cb7a9` feat(guest): WeatherWidget Lucide SVG icons, error boundary, tests (TASK-1490)

| Field | Value |
|-------|-------|
| Full SHA | `1f8cb7a9710b8b8c03e0fc90ee863baf34a75d4e` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:12:56+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/1f8cb7a9710b8b8c03e0fc90ee863baf34a75d4e) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
A  src/components/WeatherWidget.test.tsx
M  src/components/WeatherWidget.tsx
```

### Diff statistics

```text
 src/components/WeatherWidget.test.tsx |  65 +++++++++++++++++++
 src/components/WeatherWidget.tsx      | 114 ++++++++++++++++++++++------------
 2 files changed, 141 insertions(+), 38 deletions(-)
```

---

## 39. `5684353f` feat(TASK-1935): use photo altText in guest portal listing detail images

| Field | Value |
|-------|-------|
| Full SHA | `5684353f2d8222b2f264b5cbc139bcbee9f471f2` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:16:46+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/5684353f2d8222b2f264b5cbc139bcbee9f471f2) |

### Commit message (body)

```
- Add photos field (url + altText) to PublicListing type and normalizePublicListing - HomeDetails: build urlΓåÆaltText map from seoListing.photos / listingsById photos - Hero <img alt> uses altText from API when available; falls back to displayTitle - Gallery thumbnails use altText per photo; fall back to "{title} photo N"  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/api/listingClient.ts
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/api/listingClient.ts       | 14 ++++++++
 src/pages/home/HomeDetails.tsx | 78 ++++++++++++++++++++++++------------------
 2 files changed, 59 insertions(+), 33 deletions(-)
```

---

## 40. `c38f9a1b` TASK-1504: listing card price breakdown panel and calendar sample

| Field | Value |
|-------|-------|
| Full SHA | `c38f9a1b74546e6d54182e233b3e106b5facc701` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:25:42+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c38f9a1b74546e6d54182e233b3e106b5facc701) |

### Commit message (body)

```
Add Info control with portal popover (outside click + Escape), lazy GET /api/pricing/breakdown for sample night, GST helper on pricing.ts, optional cleaningFeePerNight. Apartments passes sampleCalendarCheckIn. Unit tests for breakdown trigger and cleaning line.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
A  src/components/apartments/ListingCard.test.tsx
M  src/components/apartments/ListingCard.tsx
M  src/pages/Apartments.tsx
M  src/utils/pricing.ts
```

### Diff statistics

```text
 src/components/apartments/ListingCard.test.tsx |  83 ++++++++++
 src/components/apartments/ListingCard.tsx      | 214 ++++++++++++++++++++++++-
 src/pages/Apartments.tsx                       |   1 +
 src/utils/pricing.ts                           |  17 ++
 4 files changed, 308 insertions(+), 7 deletions(-)
```

---

## 41. `0290badf` feat: add profile photo avatar upload on guest ProfilePage (TASK-1549)

| Field | Value |
|-------|-------|
| Full SHA | `0290badf5202994383c7fb9d1c42c06106693c27` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:29:15+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/0290badf5202994383c7fb9d1c42c06106693c27) |

### Commit message (body)

```
Clicking the 20├ù20 circular avatar opens a file picker. Selected image previews instantly as a data URL. Upload is attempted via /api/public/bookings/{id}/guest-avatar (gracefully no-ops on 404/405 until the endpoint ships). Loading spinner shown during upload, success toast on 2xx, silent local-preview fallback on 404/405.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/pages/ProfilePage.tsx
```

### Diff statistics

```text
 src/pages/ProfilePage.tsx | 104 ++++++++++++++++++++++++++++++++++++++++++----
 1 file changed, 96 insertions(+), 8 deletions(-)
```

---

## 42. `ef92dd85` fix(mobile): TASK-2130 raise support FAB homeHeroLift 112ΓåÆ128px for narrow phones

| Field | Value |
|-------|-------|
| Full SHA | `ef92dd859445049f927ac0e6f9dac148f98298bb` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:37:20+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/ef92dd859445049f927ac0e6f9dac148f98298bb) |

### Files changed (name-status)

```text
M  src/components/support-drawer/SupportWidget.tsx
```

### Diff statistics

```text
 src/components/support-drawer/SupportWidget.tsx | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
```

---

## 43. `a03e4ac1` feat(TASK-1467): capture booking intent on email blur + prefill scroll in HomeDetails

| Field | Value |
|-------|-------|
| Full SHA | `a03e4ac12c792b3c8e712231cbcdeb13aa59a2ff` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T22:54:35+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/a03e4ac12c792b3c8e712231cbcdeb13aa59a2ff) |

### Commit message (body)

```
- UnitBookingWidget: captureBookingIntent fires POST /api/booking-intents on email field blur (fire-and-forget) - HomeDetails: useEffect scrolls #booking-widget into view when ?prefill=<intentId> present in URL 
```

### Files changed (name-status)

```text
M  src/components/availability/UnitBookingWidget.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/availability/UnitBookingWidget.tsx | 20 ++++++++++++++++++++
 src/pages/home/HomeDetails.tsx                    | 14 +++++++++++++-
 2 files changed, 33 insertions(+), 1 deletion(-)
```

---

## 44. `b834df76` feat(TASK-1384): multi-payment method tiles (UPI/Card/NetBanking) on checkout

| Field | Value |
|-------|-------|
| Full SHA | `b834df7699fb5e09431f348e153d4ae203011411` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:00:48+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/b834df7699fb5e09431f348e153d4ae203011411) |

### Commit message (body)

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/components/availability/UnitBookingWidget.tsx | 116 +++++++++++++++++++++-
 1 file changed, 113 insertions(+), 3 deletions(-)
```

---

## 45. `057dbce8` feat(TASK-1951): NITI Aayog certified badge on listing cards and detail

| Field | Value |
|-------|-------|
| Full SHA | `057dbce8ff184cff290705c6088bae3aac6cc217` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:02:02+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/057dbce8ff184cff290705c6088bae3aac6cc217) |

### Commit message (body)

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/apartments/ListingCard.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/apartments/ListingCard.tsx | 14 ++++++++++++++
 src/pages/home/HomeDetails.tsx            | 23 +++++++++++++++--------
 2 files changed, 29 insertions(+), 8 deletions(-)
```

---

## 46. `96a7b8aa` feat(TASK-1467): wire prefillIntentId prop and refresh sitemap

| Field | Value |
|-------|-------|
| Full SHA | `96a7b8aa7a97d6738a9ec6f37570506b6848071b` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:02:50+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/96a7b8aa7a97d6738a9ec6f37570506b6848071b) |

### Commit message (body)

```
Passes ?prefill= query param from Homepage_PropertyDetails to the booking widget; sitemap refreshed with current listing URLs.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  public/sitemap.xml
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
```

### Diff statistics

```text
 public/sitemap.xml                                 | 42 +++++++++++-----------
 .../Homepage_PropertyDetails.tsx                   |  1 +
 2 files changed, 22 insertions(+), 21 deletions(-)
```

---

## 47. `38c4dc30` Guest portal: strip ?prefill= from URL after successful intent hydrate (TASK-1467).

| Field | Value |
|-------|-------|
| Full SHA | `38c4dc302b9741c1452f37c98e4fac12bdfd0dc5` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:04:10+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/38c4dc302b9741c1452f37c98e4fac12bdfd0dc5) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/components/availability/UnitBookingWidget.tsx | 55 +++++++----------------
 1 file changed, 15 insertions(+), 40 deletions(-)
```

---

## 48. `9757c97a` feat(i18n): add i18next setup with English and Hindi translation files (TASK-1284)

| Field | Value |
|-------|-------|
| Full SHA | `9757c97abeb3b4faab290ab1c64b8875f5e90204` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:24:26+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/9757c97abeb3b4faab290ab1c64b8875f5e90204) |

### Commit message (body)

```
Installs i18next + react-i18next, creates src/i18n/{en,hi}.json with ~50 UI strings, wires the side-effect import in main.tsx.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  package-lock.json
M  package.json
A  src/i18n/en.json
A  src/i18n/hi.json
A  src/i18n/index.ts
M  src/main.tsx
```

### Diff statistics

```text
 package-lock.json | 84 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 package.json      |  2 ++
 src/i18n/en.json  | 78 +++++++++++++++++++++++++++++++++++++++++++++++++++
 src/i18n/hi.json  | 78 +++++++++++++++++++++++++++++++++++++++++++++++++++
 src/i18n/index.ts | 15 ++++++++++
 src/main.tsx      |  1 +
 6 files changed, 258 insertions(+)
```

---

## 49. `28412980` feat(i18n): add language picker pill to Navbar (TASK-1284)

| Field | Value |
|-------|-------|
| Full SHA | `2841298015f7b3c0c5357aac904bd12b8069cbc2` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:25:02+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/2841298015f7b3c0c5357aac904bd12b8069cbc2) |

### Commit message (body)

```
Adds ENΓåöHI toggle button on desktop right and mobile menu. Persists choice to localStorage under 'atlasLang'.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/commonComponents/navbar/Navbar.tsx
```

### Diff statistics

```text
 src/components/commonComponents/navbar/Navbar.tsx | 29 +++++++++++++++++++++++
 1 file changed, 29 insertions(+)
```

---

## 50. `24365fae` feat(TASK-1485): multi-currency display on listing cards

| Field | Value |
|-------|-------|
| Full SHA | `24365fae7727a88fe0332f887d57dac25b3a22db` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:27:40+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/24365fae7727a88fe0332f887d57dac25b3a22db) |

### Commit message (body)

```
- Add priceUsd/priceEur/priceGbp fields to PublicListing API type and   normalizePublicListing() in listingClient.ts - Propagate FX fields through useTenantListings TenantPropertyRecord   and Apartments.tsx CombinedListing ΓåÆ ListingCard props - ListingCard: add priceUsd/priceEur/priceGbp props; when a non-INR   currency is selected show INR base + static FX hint "(~$Y)" alongside   the live-rate converted headline price from CurrencyContext - CurrencyContext, CurrencySelector, and CurrencyProvider were already   fully implemented (TASK-1687); no changes needed there  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/api/listingClient.ts
M  src/components/apartments/ListingCard.tsx
M  src/hooks/useTenantListings.ts
M  src/pages/Apartments.tsx
```

### Diff statistics

```text
 src/api/listingClient.ts                  | 10 ++++++++
 src/components/apartments/ListingCard.tsx | 42 ++++++++++++++++++++++++++++---
 src/hooks/useTenantListings.ts            |  7 ++++++
 src/pages/Apartments.tsx                  | 11 ++++++++
 4 files changed, 67 insertions(+), 3 deletions(-)
```

---

## 51. `31e22304` feat(i18n): wire useTranslation into key components (TASK-1284)

| Field | Value |
|-------|-------|
| Full SHA | `31e223043a5b509c52a3949d4da4c385b153b841` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:28:26+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/31e223043a5b509c52a3949d4da4c385b153b841) |

### Commit message (body)

```
Updates Slider hero text, HomeDetails (amenities/reviews/location/chat), ListingCard (perNight/bookNow), Footer (privacy/terms/contact), Cookie banner (accept/decline), SearchAvailabilityWidget (checkin/checkout/ checkAvailability), and GuestTypeSelector (guests label).  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/CookieConsentBanner.tsx
M  src/components/availability/SearchAvailabilityWidget.tsx
M  src/components/commonComponents/footer/Footer.tsx
M  src/components/homepage_components/slider/Slider.tsx
M  src/components/ui/GuestTypeSelector.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/CookieConsentBanner.tsx                   |  6 ++++--
 src/components/availability/SearchAvailabilityWidget.tsx |  8 +++++---
 src/components/commonComponents/footer/Footer.tsx        |  8 +++++---
 src/components/homepage_components/slider/Slider.tsx     |  6 ++++--
 src/components/ui/GuestTypeSelector.tsx                  |  4 +++-
 src/pages/home/HomeDetails.tsx                           | 12 +++++++-----
 6 files changed, 28 insertions(+), 16 deletions(-)
```

---

## 52. `c07acbd9` chore: refresh public sitemap lastmod timestamps

| Field | Value |
|-------|-------|
| Full SHA | `c07acbd972b12e6e80ad34114e805f67ff46f801` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-10T23:52:49+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c07acbd972b12e6e80ad34114e805f67ff46f801) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  public/sitemap.xml
```

### Diff statistics

```text
 public/sitemap.xml | 42 +++++++++++++++++++++---------------------
 1 file changed, 21 insertions(+), 21 deletions(-)
```

---

## 53. `622e4c39` TASK-2303: guest /account/inbox + booking links

| Field | Value |
|-------|-------|
| Full SHA | `622e4c39ad2f4030b4740d118fcf4201569fa837` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T00:24:46+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/622e4c39ad2f4030b4740d118fcf4201569fa837) |

### Commit message (body)

```
- AccountInboxPage: token + guestId, list and mark read via /api/guest/inbox - Route /account/inbox; links from my bookings and confirmation  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/App.tsx
A  src/pages/AccountInboxPage.tsx
M  src/pages/BookingConfirmationPage.tsx
M  src/pages/MyBookingsPage.tsx
```

### Diff statistics

```text
 src/App.tsx                           |   2 +
 src/pages/AccountInboxPage.tsx        | 159 ++++++++++++++++++++++++++++++++++
 src/pages/BookingConfirmationPage.tsx |   8 ++
 src/pages/MyBookingsPage.tsx          |  10 +++
 4 files changed, 179 insertions(+)
```

---

## 54. `53b59194` TASK-1500: guest minimum stay ΓÇö chips, calendar guardrails, widget prop

| Field | Value |
|-------|-------|
| Full SHA | `53b59194d768f9834b75c381eda82ef2fe7e642c` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:26:56+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/53b59194d768f9834b75c381eda82ef2fe7e642c) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/components/apartments/ListingCard.test.tsx
M  src/components/apartments/ListingCard.tsx
M  src/components/availability/UnitBookingWidget.tsx
M  src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx
M  src/pages/Apartments.tsx
M  src/pages/CityLandingPage.tsx
M  src/pages/SearchPage.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/apartments/ListingCard.test.tsx     | 24 ++++++++++++++++++++++
 src/components/apartments/ListingCard.tsx          | 13 ++++++++++++
 src/components/availability/UnitBookingWidget.tsx  | 22 ++++++++++++++++++--
 .../Homepage_PropertyDetails.tsx                   |  8 ++++++++
 src/pages/Apartments.tsx                           |  8 ++++++++
 src/pages/CityLandingPage.tsx                      |  2 ++
 src/pages/SearchPage.tsx                           |  9 ++++++++
 src/pages/home/HomeDetails.tsx                     |  1 +
 8 files changed, 85 insertions(+), 2 deletions(-)
```

---

## 55. `aed960e6` feat(TASK-1374): NearbyAttractions component on listing detail page

| Field | Value |
|-------|-------|
| Full SHA | `aed960e6d8c0df83c534debe6467929233ffd192` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:30:03+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/aed960e6d8c0df83c534debe6467929233ffd192) |

### Commit message (body)

```
- NearbyAttractions.tsx: fetches GET /api/public/listings/{id}/nearby,   groups results into Food/Cafes/Attractions/Transit sections with   Tailwind cards, animated skeleton while loading, hides on error - HomeDetails.tsx: mount <NearbyAttractions listingId={room.listingId}>   after amenities section; also add missing EmbeddedListingMap import  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
A  src/components/NearbyAttractions.tsx
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/components/NearbyAttractions.tsx | 170 +++++++++++++++++++++++++++++++++++
 src/pages/home/HomeDetails.tsx       |   5 ++
 2 files changed, 175 insertions(+)
```

---

## 56. `2570cc57` feat(TASK-1300): QuoteRequestModal + Send me a quote button in booking widget

| Field | Value |
|-------|-------|
| Full SHA | `2570cc570ff65afc7cd97e6163c5abb84e949249` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:32:05+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/2570cc570ff65afc7cd97e6163c5abb84e949249) |

### Commit message (body)

```
- QuoteRequestModal.tsx: Tailwind modal with name/phone/email/dates/   message fields; POSTs to POST /api/leads; success state shows   confirmation message; error shown inline; closes on Escape or backdrop - UnitBookingWidget.tsx: "≡ƒÆ¼ Send me a quote" outline button below Book Now;   opens QuoteRequestModal with pre-populated dates from the date range picker  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
A  src/components/QuoteRequestModal.tsx
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/components/QuoteRequestModal.tsx              | 278 ++++++++++++++++++++++
 src/components/availability/UnitBookingWidget.tsx |  24 ++
 2 files changed, 302 insertions(+)
```

---

## 57. `65be56f9` feat(TASK-1380): add DigiLocker Aadhaar verification to self check-in Step 2

| Field | Value |
|-------|-------|
| Full SHA | `65be56f92e798eacb3e804c008b3eed2b741d788` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:41:34+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/65be56f92e798eacb3e804c008b3eed2b741d788) |

### Commit message (body)

```
- Imports useEffect for query-param detection on mount - handleDigiLockerVerify: calls GET /api/public/digilocker/authorize, redirects to   DigiLocker OAuth or shows toast if feature is not configured - On return from DigiLocker callback (?digilocker=verified): shows green verified   badge, cleans URL via history.replaceState, auto-advances to Step 3 after 1.8s - Manual ID entry preserved with "or enter manually" divider for fallback - Privacy note: "DigiLocker is India's official government document wallet..."  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/pages/SelfCheckIn.tsx
```

### Diff statistics

```text
 src/pages/SelfCheckIn.tsx | 133 ++++++++++++++++++++++++++++++++++++++--------
 1 file changed, 111 insertions(+), 22 deletions(-)
```

---

## 58. `862d0216` feat(guest): TASK-1497 house rules icon row on listing detail page

| Field | Value |
|-------|-------|
| Full SHA | `862d0216fed6ed9bbe1a9d9c8fc4c5e5b871a4bb` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:47:19+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/862d0216fed6ed9bbe1a9d9c8fc4c5e5b871a4bb) |

### Commit message (body)

```
- listingClient.ts: add houseRulesStructured to PublicListing type and   normalizePublicListing (pass-through from API JSON) - HomeDetails.tsx: render a "House rules" card above the amenities section   when listing.houseRulesStructured is set; shows 4 emoji chips (≡ƒÜ¡≡ƒÉ╛≡ƒÄë≡ƒæ╢)   coloured green/red + a ≡ƒöç quiet hours chip when times are set.   Renders nothing and falls back gracefully when the field is null.  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/api/listingClient.ts
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/api/listingClient.ts       |  4 ++++
 src/pages/home/HomeDetails.tsx | 44 ++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 48 insertions(+)
```

---

## 59. `af539594` feat(TASK-1498): pass guestEmail to promo validate for first-time-guest check

| Field | Value |
|-------|-------|
| Full SHA | `af5395943317a2ce14e25f1fe01ca4bc05db49b9` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T01:53:46+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/af5395943317a2ce14e25f1fe01ca4bc05db49b9) |

### Commit message (body)

```
UnitBookingWidget now sends guestEmail in the promo-code validate payload so the API can reject FIRSTSTAY10 (and other FirstTimeGuestOnly codes) when the guest already has a prior confirmed booking.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/components/availability/UnitBookingWidget.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

---

## 60. `7b8a8676` feat(TASK-1306): show tourism tax line in guest price breakdown

| Field | Value |
|-------|-------|
| Full SHA | `7b8a867625bf8ff8628c8888bdb528acced8f613` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T02:13:18+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/7b8a867625bf8ff8628c8888bdb528acced8f613) |

### Commit message (body)

```
Reads touristTaxAmount/touristTaxPercent from PriceBreakdownDto via fetchPricingBreakdown; renders a Tourism tax row below the GST line when the amount is > 0. Updates PricingBreakdown type accordingly. 
```

### Files changed (name-status)

```text
M  src/api/pricingClient.ts
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/api/pricingClient.ts                          | 15 +++++++++++++++
 src/components/availability/UnitBookingWidget.tsx | 23 ++++++++++++++++++++++-
 2 files changed, 37 insertions(+), 1 deletion(-)
```

---

## 61. `4f631421` feat(TASK-1501): show long-stay discount line in price breakdown

| Field | Value |
|-------|-------|
| Full SHA | `4f6314218105f8ff38ca69dd7afe85a968f03298` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T03:23:29+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/4f6314218105f8ff38ca69dd7afe85a968f03298) |

### Commit message (body)

```
Adds longStayDiscountPct / longStayDiscountAmount to PricingBreakdown type. fetchPricingBreakdown now makes a secondary call to /api/pricing/guest-breakdown to retrieve the stay-duration-aware long-stay discount (the calendar /breakdown endpoint cannot apply weekly/monthly tiers without knowing the full stay length). UnitBookingWidget displays a green discount row (X% weekly/monthly discount) when a long-stay discount applies.  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/api/pricingClient.ts
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/api/pricingClient.ts                          | 29 +++++++++++++++++++++++
 src/components/availability/UnitBookingWidget.tsx | 28 +++++++++++++++++++++-
 2 files changed, 56 insertions(+), 1 deletion(-)
```

---

## 62. `2f896d94` feat(TASK-1377): Show loyalty points earn info chip in booking widget

| Field | Value |
|-------|-------|
| Full SHA | `2f896d94052bb4ef36fa637296adb29c010c55f8` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T03:54:03+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/2f896d94052bb4ef36fa637296adb29c010c55f8) |

### Commit message (body)

```
After the price breakdown, display "Earn X loyalty points on this booking" when a date range is selected and a positive total is computed. 1% of the final total is shown (integer floor, matching server accrual logic).  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com> 
```

### Files changed (name-status)

```text
M  src/components/availability/UnitBookingWidget.tsx
```

### Diff statistics

```text
 src/components/availability/UnitBookingWidget.tsx | 6 ++++++
 1 file changed, 6 insertions(+)
```

---

## 63. `f23c8634` TASK-1486: Guest portal /group-inquiry route

| Field | Value |
|-------|-------|
| Full SHA | `f23c86345e9ec40ec82ea8a9f83647fb576e7fbc` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T12:19:18+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/f23c86345e9ec40ec82ea8a9f83647fb576e7fbc) |

### Commit message (body)

```
- New page GroupInquiryPage with form fields (city, dates, group size,   requirements, contact name/phone/email) submitting to POST /api/group-inquiries. - groupInquiryClient.ts API wrapper. - App.tsx route /group-inquiry. 
```

### Files changed (name-status)

```text
M  src/App.tsx
A  src/api/groupInquiryClient.ts
A  src/pages/GroupInquiryPage.tsx
```

### Diff statistics

```text
 src/App.tsx                    |   2 +
 src/api/groupInquiryClient.ts  |  41 ++++++
 src/pages/GroupInquiryPage.tsx | 290 +++++++++++++++++++++++++++++++++++++++++
 3 files changed, 333 insertions(+)
```

---

## 64. `6ba7b7b6` TASK-1486: Alias /groups to /group-inquiry

| Field | Value |
|-------|-------|
| Full SHA | `6ba7b7b6e323491e0cc6c9f223c8d599e10a0ef2` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T12:23:27+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/6ba7b7b6e323491e0cc6c9f223c8d599e10a0ef2) |

### Commit message (body)

```
Matches original product URL while keeping canonical /group-inquiry route. 
```

### Files changed (name-status)

```text
M  src/App.tsx
```

### Diff statistics

```text
 src/App.tsx | 1 +
 1 file changed, 1 insertion(+)
```

---

## 65. `b9c8fa99` fix(lint): avoid useless assignment parsing house rules JSON

| Field | Value |
|-------|-------|
| Full SHA | `b9c8fa9995cf580d5894d1ba6e9985928a1abdfd` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T15:02:32+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/b9c8fa9995cf580d5894d1ba6e9985928a1abdfd) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/pages/home/HomeDetails.tsx
```

### Diff statistics

```text
 src/pages/home/HomeDetails.tsx | 8 ++++++--
 1 file changed, 6 insertions(+), 2 deletions(-)
```

---

## 66. `5ee0f55a` test(slider): wrap hero tests with I18nextProvider and refresh snapshots

| Field | Value |
|-------|-------|
| Full SHA | `5ee0f55aa9e17d0f74e3912de253a9569b07ea7e` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T15:08:43+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/5ee0f55aa9e17d0f74e3912de253a9569b07ea7e) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/components/homepage_components/slider/Slider.test.tsx
M  src/components/homepage_components/slider/Slider.vrt.test.tsx
```

### Diff statistics

```text
 .../homepage_components/slider/Slider.test.tsx           | 16 ++++++++++------
 .../homepage_components/slider/Slider.vrt.test.tsx       | 12 ++++++++----
 2 files changed, 18 insertions(+), 10 deletions(-)
```

---

## 67. `ffd20085` test: wrap Slider integration tests with I18nextProvider; refresh DatePicker snapshot

| Field | Value |
|-------|-------|
| Full SHA | `ffd200852ec820ae8814688373fc094bdf50dbbb` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T15:14:53+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/ffd200852ec820ae8814688373fc094bdf50dbbb) |

### Commit message (body)

```
Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  tests/DatePicker.test.tsx
M  tests/__snapshots__/DatePicker.test.tsx.snap
M  tests/availability.test.tsx
```

### Diff statistics

```text
 tests/DatePicker.test.tsx                    | 10 +++++++---
 tests/__snapshots__/DatePicker.test.tsx.snap |  6 +++---
 tests/availability.test.tsx                  | 14 +++++++++-----
 3 files changed, 19 insertions(+), 11 deletions(-)
```

---

## 68. `c58e21ab` fix(guest): resolve marketplace root for atlas tenant hero

| Field | Value |
|-------|-------|
| Full SHA | `c58e21ab957619cfb45b984d2048b1b27ea2da15` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T16:14:36+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c58e21ab957619cfb45b984d2048b1b27ea2da15) |

### Commit message (body)

```
Infer isMarketplaceRoot when tenantSlug is atlas if the API omits the flag; align validateTenant() with slug atlas. Restores penthouse hero + readable hero copy on dev.atlashomestays.com and other atlas hosts.  Co-authored-by: Cursor <cursoragent@cursor.com> 
```

### Files changed (name-status)

```text
M  src/components/homepage_components/slider/Slider.tsx
M  src/tenant/tenantContext.ts
```

### Diff statistics

```text
 src/components/homepage_components/slider/Slider.tsx |  1 +
 src/tenant/tenantContext.ts                          | 17 +++++++++++------
 2 files changed, 12 insertions(+), 6 deletions(-)
```

---

## 69. `c402c661` Revert "fix(guest): resolve marketplace root for atlas tenant hero"

| Field | Value |
|-------|-------|
| Full SHA | `c402c661c68d37605d9f0c9cc0f17f57a718086d` |
| Author | Atlas Dev <dev@atlashomestays.com> |
| Commit date | 2026-05-11T16:39:05+05:30 |
| Link | [View on GitHub](https://github.com/atlashomesit/atlas-guest-portal/commit/c402c661c68d37605d9f0c9cc0f17f57a718086d) |

### Commit message (body)

```
This reverts commit c58e21ab957619cfb45b984d2048b1b27ea2da15. 
```

### Files changed (name-status)

```text
M  src/components/homepage_components/slider/Slider.tsx
M  src/tenant/tenantContext.ts
```

### Diff statistics

```text
 src/components/homepage_components/slider/Slider.tsx |  1 -
 src/tenant/tenantContext.ts                          | 17 ++++++-----------
 2 files changed, 6 insertions(+), 12 deletions(-)
```

---

