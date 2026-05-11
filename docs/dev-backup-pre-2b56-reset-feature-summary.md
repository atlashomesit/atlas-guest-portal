# Feature / TASK summary — commits after `2b56cef` (selective replay)

**Purpose:** Pick **product work** (TASK IDs and related UI) without blindly replaying all 69 commits. Full per-commit detail remains in [dev-backup-pre-2b56-reset-commit-guide.md](./dev-backup-pre-2b56-reset-commit-guide.md).

**Backup tip:** `origin/dev-backup-pre-2b56-reset` @ `c402c661`  
**Replay order:** always **oldest → newest** (`git log --reverse --oneline 2b56cef..origin/dev-backup-pre-2b56-reset`).

---

## How to use this list

1. Cherry-pick **one SHA at a time** onto current `dev` (at `2b56cef` or later), in the order below.
2. **Merge commits** in the backup branch (e.g. `Merge pull request #…`, `merge branch 'task/…'`) are **skipped** in this list unless noted — prefer the **non-merge** commits that carry the same changes. If you must replay a merge: `git cherry-pick -m 1 <merge-sha>` (parent 1 is usually `dev`).
3. **Dependency stack:** React 19, Tailwind 4, React Router 7, react-leaflet 5, etc. appear **first** in history. If a feature commit fails to build, you likely need the **infrastructure** block applied before it (see [Infrastructure (deps & tooling)](#infrastructure-deps--tooling)).
4. **Net-zero pair:** `c58e21ab` (marketplace hero fix) + `c402c661` (revert) — **omit both** unless you want that experiment; they cancel out.

---

## Infrastructure (deps & tooling)

Apply as a **block** if you need the same stack as the backup branch before feature commits.

| Area | Short SHAs (in order) | Notes |
|------|------------------------|--------|
| Core deps | `08aabf70` `6b661f88` `3943756b` | React 19, Tailwind 4, RR 7 |
| Dependabot merges | `0a58ea3a` `2ee132fa` `2119b2db` | Optional if you apply the three commits above instead |
| CI / Actions | `a57c09b5` `b1f7197d` | actions/checkout v6 |
| More npm | `79abe777` `c267a5bf` | react-dom; multi merge |
| Tailwind v4 wiring | `e7f5daf7` | PostCSS — often **required** after Tailwind 4 bump |
| GHActions / leaflets | `07b79e96` `52e3305b` `1482abf6` `846c5226` | fetch-metadata; react-leaflet 5 |

**Docs / repo hygiene (optional):** `e838a83d` (AGENTS), `94a76c4c` `20057063` (gitleaks), `20609034` (markdownlint).

---

## Chronological order (product-oriented commits only)

Use this sequence when you want **time order** (same as the backup branch), omitting obvious **deps / merge / gitleaks / docs-only** rows. Insert the [Infrastructure](#infrastructure-deps--tooling) block **before** `e7f5daf7` if you need the upgraded stack.

| # | SHA | Summary |
|---|-----|---------|
| 1 | `a42a82fd` | SEO JSON-LD + hreflang WIP |
| 2 | `dfec07d0` | SGH QA batch (TASK-2205–2208 in body) |
| 3 | `00e8fea9` | TASK-1982 star-rating histogram |
| 4 | `85ec810e` | test: About snapshot *(optional)* |
| 5 | `e7f5daf7` | Tailwind v4 PostCSS *(tooling)* |
| 6 | `4f824625` | test: DatePicker snapshot *(optional)* |
| 7 | `f402594e` | Checkout deposit consent |
| 8 | `ae0b272f` | City landing, filters, sitemap |
| 9 | `e838a83d` | docs: AGENTS link *(optional)* |
| 10 | `fcf20063` | TASK-1478 (part 1) |
| 11 | `37e2a8e2` | TASK-1478 (part 2) |
| 12 | `c6853b06` | merge TASK-1478 *(prefer `-m 1` or skip if redundant)* |
| 13 | `7f7e22f2` | TASK-1936 Helmet meta |
| 14 | `e56a7a9a` | TASK-2208 tests |
| 15 | `cedb102e` | merge TASK-1936 *(optional `-m 1`)* |
| 16 | `a33db67e` | merge SEO JSON-LD *(optional `-m 1`)* |
| 17 | `46a2e643` | TASK-1495/1505 monitoring |
| 18 | `ced10030` | TASK-1936 AI meta wiring |
| 19 | `3c937867` | TASK-1480 analytics |
| 20 | `575456c2` | TASK-1487 payout badge |
| 21 | `1f8cb7a9` | TASK-1490 WeatherWidget |
| 22 | `5684353f` | TASK-1935 alt text |
| 23 | `c38f9a1b` | TASK-1504 price breakdown |
| 24 | `0290badf` | TASK-1549 avatar upload |
| 25 | `ef92dd85` | TASK-2130 FAB lift |
| 26 | `a03e4ac1` | TASK-1467 intent capture |
| 27 | `b834df76` | TASK-1384 payment tiles |
| 28 | `057dbce8` | TASK-1951 NITI badge |
| 29 | `96a7b8aa` | TASK-1467 prefill + sitemap |
| 30 | `38c4dc30` | TASK-1467 strip `?prefill=` |
| 31 | `9757c97a` | TASK-1284 i18n setup |
| 32 | `28412980` | TASK-1284 language pill |
| 33 | `24365fae` | TASK-1485 multi-currency |
| 34 | `31e22304` | TASK-1284 wire translations |
| 35 | `c07acbd9` | chore: sitemap lastmod |
| 36 | `622e4c39` | TASK-2303 inbox |
| 37 | `53b59194` | TASK-1500 minimum stay |
| 38 | `aed960e6` | TASK-1374 NearbyAttractions |
| 39 | `2570cc57` | TASK-1300 quote modal |
| 40 | `65be56f9` | TASK-1380 DigiLocker |
| 41 | `862d0216` | TASK-1497 house rules row |
| 42 | `af539594` | TASK-1498 promo email |
| 43 | `7b8a8676` | TASK-1306 tourism tax |
| 44 | `4f631421` | TASK-1501 long-stay discount |
| 45 | `2f896d94` | TASK-1377 loyalty chip |
| 46 | `f23c8634` | TASK-1486 route |
| 47 | `6ba7b7b6` | TASK-1486 alias |
| 48 | `b9c8fa99` | lint fix *(optional)* |
| 49 | `5ee0f55a` | tests + i18n *(optional)* |
| 50 | `ffd20085` | tests + i18n *(optional)* |
| — | `c58e21ab` / `c402c661` | **Skip** (fix + revert) |

---

## TASK-indexed feature work

Same order as on **`dev-backup-pre-2b56-reset`** (oldest first). One row can list **several SHAs** — apply **top to bottom** within the row.

| Task ID | What shipped | Commit(s) |
|---------|----------------|-----------|
| **TASK-2205–2208** | SGH daily QA: support drawer brand copy, hero CTA width, `formatListingTitle`, locations fallback (see commit body for P0/P1 map) | `dfec07d0` |
| **TASK-1982** | Star-rating histogram on listing cards | `00e8fea9` |
| **—** | SEO: recovered JSON-LD + hreflang WIP | `a42a82fd` |
| **—** | City landing, listing client filters, sitemap updates | `ae0b272f` |
| **—** | Checkout deposit consent disclosure | `f402594e` |
| **TASK-1478** | API sitemap, robots, per-host sitemap paths | `fcf20063` `37e2a8e2` — skip merge `c6853b06` if both commits already applied cleanly |
| **TASK-1936** (+ SEO merges) | Helmet meta from API; AI meta title/description; merges bundle SEO branch | `7f7e22f2` → then `cedb102e` / `a33db67e` **or** cherry-pick linear follow-ups: `ced10030` (and resolve overlap with merges locally) |
| **TASK-2208** | Unit tests for `formatListingTitle` | `e56a7a9a` (after `dfec07d0`) |
| **TASK-1495 / TASK-1505** | Trace IDs on API errors; Sentry tenant tags | `46a2e643` |
| **TASK-1480** | Conversion funnel analytics events | `3c937867` |
| **TASK-1487** | Payout verified badge (`hostVerified`) | `575456c2` |
| **TASK-1490** | WeatherWidget icons, error boundary, tests | `1f8cb7a9` |
| **TASK-1935** | Photo `altText` on listing detail images | `5684353f` |
| **TASK-1504** | Listing card price breakdown panel + calendar sample | `c38f9a1b` |
| **TASK-1549** | Profile photo avatar upload on ProfilePage | `0290badf` |
| **TASK-2130** | Support FAB `homeHeroLift` for narrow phones | `ef92dd85` |
| **TASK-1467** | Booking intent email blur, prefill, `prefillIntentId`, strip `?prefill=` | `a03e4ac1` `96a7b8aa` `38c4dc30` |
| **TASK-1384** | Multi-payment tiles (UPI / Card / NetBanking) on checkout | `b834df76` |
| **TASK-1951** | NITI Aayog certified badge | `057dbce8` |
| **TASK-1284** | i18next setup, language pill, `useTranslation` wiring | `9757c97a` `28412980` `31e22304` |
| **TASK-1485** | Multi-currency display on listing cards (references CurrencyContext / TASK-1687) | `24365fae` |
| **—** | Refresh public sitemap `lastmod` | `c07acbd9` |
| **TASK-2303** | Guest `/account/inbox` + booking links | `622e4c39` |
| **TASK-1500** | Minimum stay: chips, calendar guardrails, widget prop | `53b59194` |
| **TASK-1374** | NearbyAttractions on listing detail | `aed960e6` |
| **TASK-1300** | QuoteRequestModal + “Send me a quote” | `2570cc57` |
| **TASK-1380** | DigiLocker Aadhaar on self check-in step 2 | `65be56f9` |
| **TASK-1497** | House rules icon row on listing detail | `862d0216` |
| **TASK-1498** | Pass `guestEmail` into promo validate | `af539594` |
| **TASK-1306** | Tourism tax line in price breakdown | `7b8a8676` |
| **TASK-1501** | Long-stay discount line in price breakdown | `4f631421` |
| **TASK-1377** | Loyalty points earn chip in booking widget | `2f896d94` |
| **TASK-1486** | `/group-inquiry` route + `/groups` alias | `f23c8634` `6ba7b7b6` |

---

## Follow-up / test-only commits tied to features

Pick these **after** the related feature/i18n work if you want CI green without re-resolving snapshots locally.

| SHAs | Purpose |
|------|---------|
| `85ec810e` `4f824625` | About / DatePicker snapshots |
| `b9c8fa99` | Lint fix for house rules JSON (after TASK-1497 path) |
| `5ee0f55a` `ffd20085` | Slider / DatePicker tests + I18nextProvider |

---

## Omit unless debugging

| SHAs | Reason |
|------|--------|
| `c58e21ab` `c402c661` | Fix + revert marketplace hero — **net no change** |

---

## One-line “features only” SHA list (non-merge, common path)

Use after deps + `e7f5daf7` if you need a minimal ordered list (still resolve conflicts per branch). Order matches [chronological table](#chronological-order-product-oriented-commits-only) (non-merge path):

`a42a82fd` `dfec07d0` `00e8fea9` `f402594e` `ae0b272f` `fcf20063` `37e2a8e2` `7f7e22f2` `e56a7a9a` `ced10030` `46a2e643` `3c937867` `575456c2` `1f8cb7a9` `5684353f` `c38f9a1b` `0290badf` `ef92dd85` `a03e4ac1` `b834df76` `057dbce8` `96a7b8aa` `38c4dc30` `9757c97a` `28412980` `24365fae` `31e22304` `c07acbd9` `622e4c39` `53b59194` `aed960e6` `2570cc57` `65be56f9` `862d0216` `af539594` `7b8a8676` `4f631421` `2f896d94` `f23c8634` `6ba7b7b6`

You may still need merge commits **`cedb102e`** / **`a33db67e`** for TASK-1936 + SEO if linear picks miss files.

---

## Regenerating the long-form guide

See [dev-backup-pre-2b56-reset-commit-guide.md](./dev-backup-pre-2b56-reset-commit-guide.md) and `scripts/_generate-dev-backup-commit-guide.ps1`.
