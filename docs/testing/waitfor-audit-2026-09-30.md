# waitFor / findBy audit, guest portal (TASK-102734)

Date 2026-09-30. Base `40645f7f`. Scope: `atlas-guest-portal` only; the admin portal is a later dispatch that copies the
helper and rule shape from here (section 9).

## 1. Result

1. **Two independent causes** produce the gate's "`expected null to be X`, after two waits of about 1 s" red. Both are
   reproduced on demand (section 2): a **wall-clock race** in `waitFor`/`findBy*` (the mechanism the entry filed), and a
   **shared-worker state leak** (a test file that leaves `document.visibilityState = "hidden"` behind, found while
   converting). `settle()` fixes the first and does **not** fix the second, so the `40645f7f` fix alone would not have
   prevented the second.
2. **Fixed for the guest suite:** 331 waits in 70 files converted to a deterministic drain, the leak fixed at its source
   and guarded per file, and a lint rule (with a shrink-only baseline) that stops the class coming back.
3. **Not decided:** which of the two causes hit gate run 7. That needs one bounded `grep` on the run-7 guest log
   (section 2.3). The four log files named for this task were **not present** at the exact paths given (stat returned
   "missing"), so it could not be done here.
4. **Deferred by instruction:** the quiet-box measured column, the real-load repro, item 5 (where should guest vitest
   run), and all admin work.

## 2. Root cause: two mechanisms, not one

### 2.1 Cause A: the wall-clock race (the entry's mechanism, confirmed and refined)

`@testing-library/dom` 10.4.1 `waitFor` arms one real `setTimeout(handleTimeout, 1000)`, re-checks on a 50 ms
`setInterval` and on DOM mutations, and when the deadline fires it rejects with the last error it saw without looking
again (`dist/wait-for.js`). RTL's `asyncWrapper` runs the wait with `IS_REACT_ACT_ENVIRONMENT = false`, so React commits
through the Scheduler (one `setImmediate` per task).

**Repro (deterministic).** Hold the thread about 1.2 s inside the mocked `response.json()` (a stand-in for a starved
worker), then compare the old `await waitFor(() => expect(first.result.current).toBe(1.25))` with `await settle()`.
The hook is `useTenantProcessingFee`, unchanged since `75b4206b`. Pass counts, 4 runs per cell. This is a deterministic stand-in that shows the ordering; it is not a failure-rate estimate under real load (that repro is deferred):

Hook (`renderHook`), the test body starting from four different event-loop positions:

| Form (1.2 s hold) | nothing before | after a timer | after `setImmediate` | after a microtask |
|---|---|---|---|---|
| old `waitFor` | 0/4 | 0/4 | 0/4 | 0/4 |
| `settle()` | 4/4 | 4/4 | 4/4 | 4/4 |

DOM component (a `<p>` that shows the fee once the mocked fetch resolves), same four starts but the last one is `await act(...)`:

| Form (1.2 s hold) | nothing before | after a timer | after `setImmediate` | after `await act(...)` |
|---|---|---|---|---|
| `findByText` | 3/4 | 4/4 | 0/4 | 0/4 |
| `waitFor` + `getBy` | 4/4 | 4/4 | 0/4 | 0/4 |
| `settle()` + `getBy` | 4/4 | 4/4 | 4/4 | 4/4 |

With no hold every cell passes; the old hook wait then costs 58 to 81 ms of its 1,000 ms window on this box, `settle()`
1 to 24 ms. The first failure message is exactly the gate's: `expected null to be 1.25 // Object.is equality`.

**Refinement of the entry.** The render is *not* late. An instrumented run (event log, ms from start) shows:

```
   17 REACT  render, value=null
   31 TEST   waitFor armed (deadline 1000 ms)
   36 MOCK   json() spin start
 1241 MOCK   json() spin end
 1243 REACT  render, value=1.25            <- the commit is on time
 1246 TIMER  poll interval (50 ms) fires   <- reads result.current: still null
 1247 TIMER  deadline (1000 ms) fires      <- rejects with the stale null
 1264 TEST   waitFor REJECTED: expected null to be 1.25
 1264 REACT  passive effect, value=1.25    <- renderHook publishes result.current HERE, one Scheduler task later
```

`renderHook` assigns `result.current` in a `useEffect`, and React flushes passive effects in a second Scheduler task.
The overdue timers run between the two tasks. DOM waits are exposed the same way when they are armed from the check
phase (any `await act(...)` resolves through `setImmediate`, so a wait that follows one starts there). That matches
Node's loop order: an immediate queued during the check phase runs on the next iteration, after its timers phase, where
an overdue deadline runs first. How many tests in the suite start a wait that way was not counted.

**Why `settle()` is immune.** It awaits one macrotask inside an async `act()`. While the act scope is open React queues
every update in the act queue instead of the Scheduler, so the scope drains every already-resolved promise step, commits
and flushes passive effects before it resolves. It waits for an order, not a time. It is fake-timer aware (a real
`setTimeout(0)` would never fire when `setTimeout` is faked, so it advances the fake clock by 0 instead).

Regression test: `src/test/settle.test.tsx`. By default it asserts only what must always hold (settle drains a chain that
holds the thread past a wait window; it does not hang under fake timers). `ATLAS_WAITFOR_REPRO=1 npx vitest run
src/test/settle.test.tsx` reruns the entry's full-scale numbers (1.2 s hold, default 1,000 ms window) and additionally
asserts that the old form fails. It is passing in both modes.

Note for later: DTL detects only *Jest's* fake timers (it needs a `jest` global). Under vitest fake timers `waitFor`
uses the faked `setTimeout`, so its deadline never fires; a wait in a file that fakes `setTimeout` is event-driven, not
clock-driven. The lint rule exempts such files for that reason.

### 2.2 Cause B: a shared-worker leak (new; same signature; `settle()` does not cure it)

The `shared-fast` project runs with `isolate: false`: every file a worker runs shares one jsdom `document`.
`GuestDetailsPage.abandonOnDeparture.test.tsx` simulates a hidden tab with
`Object.defineProperty(document, 'visibilityState', { value: 'hidden' })`; its last test ends hidden and no `afterEach`
restores it. `useTenantProcessingFee.refresh()` returns early while the tab is hidden, so **the next file that worker
runs** reads `null` forever.

Deterministic repro: `ATLAS_GUEST_VITEST_MAX_WORKERS=1 npx vitest run --project shared-fast --maxWorkers=1
src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx src/hooks/useTenantProcessingFee.test.tsx`

| Fee test form | leaking file first | fee test alone |
|---|---|---|
| `75b4206b` (old `waitFor`) | **fails**: `(7 tests \| 2 failed) 2042ms`, each failure about 1,020 ms; probe shows `visibilityState=hidden` at file start | passes; `visible` |
| `40645f7f` (`settle()`) | **fails** (2 failed) | passes |
| with the fix in this task | passes | passes |

The old form's `(7 tests | 2 failed) 2042ms` has the shape of the gate log's `(7 tests | 2 failed) 2095ms` (two 1,000 ms
timeouts). Whether it fails depends only on which file the worker happened to run first. That order depends on
scheduling and on vitest's cached durations, so it moves with machine load without the worker ever being slow, which is
what makes it look like a load flake. It also showed up here on a quiet box: one of my own full-suite runs failed exactly those two tests in 22 ms
(with `settle()`), and the next identical run passed. That is consistent with this cause; I did not capture that run's
file order.

**Fix.** The leaking test now restores the property in `afterEach`; `src/test/setup.ts` calls
`restoreDocumentVisibility()` (from `src/test/sharedWorkerHygiene.ts`) at the start of every test file, so any future
leaker is confined to its own file. Proven independent of the test-level fix: with the `afterEach` restore removed, the
same two-file, one-worker run still passes.

A static scan of the guest's shared-worker files for other un-restored global overrides (`defineProperty` on
`document`/`window`/`navigator`/`location`, `stubGlobal` without `unstubAllGlobals`, fake timers without
`useRealTimers`) found only this one; `ErrorBoundary.test.tsx` (`window.location`) and `AtlasBookingCalendar.test.tsx`
(`innerHeight`) restore theirs, and `setup.ts` re-stubs `fetch` at the start of every file. That scan covers those
patterns only, not DOM residue in `document.head` or storage.

### 2.3 Which one hit run 7? One command decides

In gate mode the `shared-fast` project has one worker, so the completion order in the guest log is the execution order.
On the run-7 guest log (`atlas-gate-guest-20260930033055.log`):

```
grep -n -E "abandonOnDeparture|useTenantProcessingFee" atlas-gate-guest-20260930033055.log
```

If `abandonOnDeparture` completed **before** `useTenantProcessingFee` there (and after it, or in another worker, in the
green runs 3, 5 and 8), cause B was the failure and the `40645f7f` fix only passed run 8 by ordering. If it did not,
cause A stands. I could not run it: the four logs named for this task were not found at the exact paths given.

## 3. Inventory

An AST scan (repo TypeScript) of all 271 tracked test files found **339 async waits in 73 files**: 178 `waitFor`,
155 `findBy*`, 6 `findAllBy*`; 324 on the default window and 15 with an explicit `timeout`. (A plain-text count gives
178 `waitFor(` in 61 files and 161 `find*`, matching; the entry quotes 169 in 58 files and 158, taken at origin/dev, while this is `40645f7f`.) Seven of the 73 files use fake timers: five fake `Date` only, two call `vi.useFakeTimers()` with no arguments inside individual tests.

## 4. Classification

**How a verdict was established (by running, not by reading):**

- **WALL-CLOCK-ON-MOCKED-WORK**: the wait goes green when replaced by one `act`-drained macrotask tick, *and* goes red
  when that drain is removed (so it really waited for async state). The awaited work is promises the test resolves.
  Established for the whole suite: every wait was converted and the suite ran green (section 6), then every `await
  settle()` was stripped and the suite rerun: **47 files / 162 tests went red**.
- **DETERMINISTIC**: stays green with the drain removed. The condition was already true at the wait's first synchronous
  check, so the original never waited. 24 run files. Notably `SearchPage.activeFilters` (two of its waits carried a
  bumped 15 s window) and `smokeBookingFlow` (a 30 s window on a button that lives in the navbar shell).
- **WALL-CLOCK-ON-REAL-WORK**: needs a clock the test does not control. One site in the run set: the OTP verify in
  `SelfCheckIn.multiGuest` advances from the page's own `setTimeout(500)`; it was the reason for a 2 s window and now
  uses fake timers for that step plus `advanceTimersByTimeAsync(500)`.
- **NOT RUN**: `App.a11y`, `PropertyDetailsMedia`, `propertyDetailsRouteSmoke` are the `heavyRouteSmokes` that
  `vitest.config.ts` removes from every run. They cannot be collected even by an explicit path (the include list
  omits them and they are in `exclude`), so nothing there can be converted or verified: 8 waits, left in the baseline.
  The config comment saying they can be run with `npx vitest run <file>` is wrong.

Granularity: the load-bearing attribution is per *test* (a test that goes red without the drain marks all its sites), so
a test with several waits may have only one of them truly needed. **The quiet-box measured column (elapsed ms per call,
FRAGILE when over 100 ms of the 1,000 ms) is deferred: this box is shared with other drain agents.** Until it is taken,
treat every load-bearing site as exposed to Cause A; converting removed the clock from all of them, so ranking them no
longer decides anything for the guest suite.

Fake-timer files: DTL cannot see vitest fake timers, so where `setTimeout` is faked a `waitFor` deadline never fires. The five
`Date`-only files (`AvailabilityCalendar.keyboard`, `UnitBookingWidgetAvailabilityRates`,
`UnitBookingWidgetSplitPricingFailure`, `calendarDateBasis.tzeast`, `searchDateBasis.tzeast`) keep real timers, so their waits
had a live deadline and were converted like the rest.

Special cases (each has its reason in the test):

- `SearchPage.availableTonight` "exactly one availability-batch request": the old `waitFor` passed on its first
  synchronous check (only the mount-time batch call existed). After a full drain the follow-up
  `/availability/summary?listingIds=1,2,3` call also matches the test's broad `'/availability'` filter (not a second
  batch). The original assertion is kept at that same moment, unchanged, and a settled-state assertion was **added**
  (exactly one `availability-batch` request, no `listing-availability` fan-out). Mutation: a duplicate batch request one
  microtask after mount leaves the original-form test **green** and turns the new test **red**.
- `Home.test`: the awaited `#our-homes` section is statically imported and driven by a mocked promise, so it is mocked
  work; its `React.lazy` sections are never awaited. `HomeSuspenseIsolation` mocks its lazy modules.
- A `findBy*` promise held un-awaited in two helpers (`findDayCell`) became `await settle()` + `getBy*`.

### 4.1 Per-file verdicts

| File | Sites (waitFor/findBy) | Explicit timeout | Mocked-work (load-bearing) | Deterministic (never waited) | Real-work | Red without the drain | Action |
|---|---|---|---|---|---|---|---|
| `src/App.a11y.test.tsx` | 2 (2/0) |  |  |  |  | n/a | left (baselined) |
| `src/__tests__/SearchPage.accessibility.test.tsx` | 5 (2/3) | 4 | 4 | 1 |  | 3 | converted |
| `src/__tests__/SearchPage.activeFilters.test.tsx` | 4 (4/0) | 2 |  | 4 |  | 0 | converted |
| `src/__tests__/SearchPage.availableTonight.test.tsx` | 2 (2/0) |  | 1 | 1 |  | 1 | converted |
| `src/__tests__/SearchPage.empty.test.tsx` | 4 (2/2) | 2 | 4 |  |  | 3 | converted |
| `src/__tests__/SearchPage.mapView.test.tsx` | 3 (3/0) | 1 | 3 |  |  | 1 | converted |
| `src/components/AvailabilityCalendar.keyboard.test.tsx` | 6 (4/2) |  | 6 |  |  | 5 | converted |
| `src/components/AvailabilityCalendar.task102485.test.tsx` | 5 (2/3) |  | 4 | 1 |  | 2 | converted |
| `src/components/ReviewSummary.provenance.test.tsx` | 3 (3/0) |  | 3 |  |  | 3 | converted |
| `src/components/ShortLinkRedirect.task102019.test.tsx` | 5 (0/5) |  | 4 | 1 |  | 3 | converted |
| `src/components/availability/UnitBookingWidget.test.tsx` | 22 (5/17) |  | 10 | 12 |  | 8 | converted |
| `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx` | 6 (3/3) |  |  | 6 |  | 0 | converted |
| `src/components/availability/UnitBookingWidgetPriceLinesSum.test.tsx` | 2 (1/1) |  |  | 2 |  | 0 | converted |
| `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx` | 10 (9/1) |  | 10 |  |  | 6 | converted |
| `src/components/availability/UnitBookingWidgetSplitPricingFailure.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/components/availability/calendarDateBasis.tzeast.test.tsx` | 6 (3/3) |  |  | 6 |  | 0 | converted |
| `src/components/date/AtlasDateRangePicker.test.tsx` | 3 (3/0) | 1 |  | 3 |  | 0 | converted |
| `src/components/date/searchDateBasis.tzeast.test.tsx` | 8 (7/1) |  |  | 8 |  | 0 | converted |
| `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx` | 6 (1/5) |  | 6 |  |  | 4 | converted |
| `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.checkInTimes.test.tsx` | 2 (2/0) |  | 1 | 1 |  | 1 | converted |
| `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.listingAddress.test.tsx` | 4 (2/2) |  | 2 | 2 |  | 2 | converted |
| `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx` | 5 (3/2) |  |  | 5 |  | 0 | converted |
| `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx` | 7 (7/0) |  |  | 7 |  | 0 | converted |
| `src/components/messaging/GuestMessageThread.issues.test.tsx` | 14 (10/4) |  | 9 | 5 |  | 10 | converted |
| `src/components/support/SupportWidget.assistant.test.tsx` | 4 (1/3) |  | 3 | 1 |  | 5 | converted |
| `src/pages/BecomeHost.test.tsx` | 4 (4/0) |  | 3 | 1 |  | 3 | converted |
| `src/pages/BookingConfirmationPage.calendar.test.tsx` | 4 (0/4) |  | 4 |  |  | 3 | converted |
| `src/pages/BookingConfirmationPage.checkout.test.tsx` | 1 (0/1) |  | 1 |  |  | 13 | converted |
| `src/pages/BookingConfirmationPage.stayDocs.test.tsx` | 4 (1/3) |  | 3 | 1 |  | 3 | converted |
| `src/pages/BookingConfirmationPage.test.tsx` | 4 (1/3) |  | 4 |  |  | 3 | converted |
| `src/pages/CityLandingPage.test.tsx` | 4 (2/2) |  | 4 |  |  | 2 | converted |
| `src/pages/EmbedPage.a11y.test.tsx` | 29 (2/27) | 2 | 29 |  |  | 14 | converted |
| `src/pages/EmbedPage.noSubscriptionDiagnostics.test.tsx` | 2 (0/2) |  | 2 |  |  | 2 | converted |
| `src/pages/EmbedPage.trustBadges.test.tsx` | 3 (0/3) |  | 3 |  |  | 1 | converted |
| `src/pages/GuestLoginPage.a11y.test.tsx` | 1 (0/1) |  | 1 |  |  | 1 | converted |
| `src/pages/GuestLoginPage.sendotp-failure.test.tsx` | 12 (7/5) |  | 12 |  |  | 6 | converted |
| `src/pages/HouseRulesAcceptPage.test.tsx` | 6 (1/5) |  | 6 |  |  | 2 | converted |
| `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx` | 6 (6/0) |  | 5 | 1 |  | 5 | converted |
| `src/pages/MarketplaceHomepageLoadError.test.tsx` | 3 (1/2) |  | 3 |  |  | 3 | converted |
| `src/pages/MarketplaceHomepagePagination.test.tsx` | 9 (9/0) |  | 9 |  |  | 5 | converted |
| `src/pages/MarketplaceHomepageSearchCarry.test.tsx` | 1 (1/0) |  | 1 |  |  | 1 | converted |
| `src/pages/MarketplaceHomepageSeo.test.tsx` | 4 (4/0) |  |  | 4 |  | 0 | converted |
| `src/pages/MarketplaceReviewProvenance.test.tsx` | 4 (4/0) |  | 4 |  |  | 4 | converted |
| `src/pages/MyBookingsPage.dateTz.test.tsx` | 3 (0/3) |  | 3 |  |  | 2 | converted |
| `src/pages/MyBookingsPage.errorStates.test.tsx` | 6 (1/5) |  | 6 |  |  | 5 | converted |
| `src/pages/MyBookingsPage.rebookCta.test.tsx` | 5 (0/5) |  | 5 |  |  | 3 | converted |
| `src/pages/MyBookingsPage.reviewCta.test.tsx` | 5 (1/4) |  | 5 |  |  | 3 | converted |
| `src/pages/MyDataPage.test.tsx` | 1 (1/0) |  | 1 |  |  | 1 | converted |
| `src/pages/SelfCheckIn.a11y.test.tsx` | 3 (1/2) |  | 2 | 1 |  | 1 | converted |
| `src/pages/SelfCheckIn.multiGuest.test.tsx` | 12 (7/5) | 1 | 11 |  | 1 | 3 | converted; 1 via fake timers |
| `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx` | 8 (1/7) |  | 8 |  |  | 4 | converted |
| `src/pages/booking/GuestCheckoutSecurityBadges.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx` | 7 (6/1) |  | 5 | 2 |  | 1 | converted |
| `src/pages/booking/GuestDetailsPage.a11y.test.tsx` | 2 (2/0) |  |  | 2 |  | 0 | converted |
| `src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx` | 4 (4/0) |  |  | 4 |  | 0 | converted |
| `src/pages/booking/GuestDetailsPage.consentHitbox.test.tsx` | 3 (1/2) |  |  | 3 |  | 0 | converted |
| `src/pages/booking/GuestDetailsPage.focusScroll.test.tsx` | 2 (1/1) |  |  | 2 |  | 0 | converted |
| `src/pages/booking/GuestDetailsPage.gstStatement.test.tsx` | 4 (4/0) |  |  | 4 |  | 0 | converted |
| `src/pages/booking/GuestDetailsPage.promoSavingsChip.test.tsx` | 3 (3/0) |  | 3 |  |  | 2 | converted |
| `src/pages/booking/GuestDetailsPage.razorpayPreload.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/pages/home/Home.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/pages/home/__tests__/Home.test.tsx` | 1 (0/1) |  | 1 |  |  | 1 | converted |
| `src/pages/home/__tests__/HomeSuspenseIsolation.test.tsx` | 2 (0/2) |  | 2 |  |  | 1 | converted |
| `src/themes/__tests__/ac7-layout-theme-switch.test.tsx` | 2 (2/0) |  |  | 2 |  | 0 | converted |
| `src/themes/__tests__/coastal-smoke.test.tsx` | 2 (2/0) |  |  | 2 |  | 0 | converted |
| `src/themes/__tests__/editorial-smoke.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/themes/__tests__/noir-layout-theme.test.tsx` | 1 (1/0) |  |  | 1 |  | 0 | converted |
| `src/themes/__tests__/photofirst-smoke.test.tsx` | 3 (3/0) |  |  | 3 |  | 0 | converted |
| `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx` | 6 (1/5) |  | 6 |  |  | 4 | converted |
| `tests/AdvertisedPromoGuard.test.tsx` | 3 (3/0) |  | 1 | 2 |  | 1 | converted |
| `tests/PropertyDetailsMedia.test.tsx` | 2 (0/2) | 1 |  |  |  | n/a | left (baselined) |
| `tests/propertyDetailsRouteSmoke.test.tsx` | 4 (4/0) |  |  |  |  | n/a | left (baselined) |
| `tests/smokeBookingFlow.test.tsx` | 1 (0/1) | 1 |  | 1 |  | 0 | converted |
| **Total (73 files)** | **339** (178/161) | **15** | **223** | **107** | **1** | | |

"Red without the drain" counts tests in that file that fail when every `await settle()` is removed (sum 160 for the
inventory files; the 162 total includes `useTenantProcessingFee.test.tsx`, which the waitFor scan does not list).

The per-call-site table is in Appendix A.

## 5. What changed (commit map on `p0d/task-102734-guest`)

1. `src/test/settle.ts`, `src/test/settle.test.tsx`, `src/test/sharedWorkerHygiene.ts`,
   `src/test/sharedWorkerHygiene.test.ts`, `src/test/setup.ts`, the fee test, and the abandon test (visibility fix).
2. The other 69 converted test files. No assertion removed, skipped or loosened; no `timeout` raised anywhere; the
   explicit-timeout waits (SearchPage.* 15 s, EmbedPage 5 s, SelfCheckIn 2 s, AtlasDateRangePicker 1 s,
   smokeBookingFlow 30 s) are converted too.
3. `eslint-rules/no-wall-clock-wait.cjs` (+ RuleTester harness, baseline JSON, baseline ratchet test) and
   `eslint.config.js`.
4. This document.

## 6. Proof

- Baseline (untouched tree, `--maxWorkers=2`, two `--shard` halves): 268 files, 1,699 tests, green.
- After: `npm run typecheck` clean; 272 files, 1,745 tests, green (+4 files, +46 tests, all from the four new test
  files); `npx eslint . --quiet` exit 0.
- **Drain removal** (all 71 files that use `settle()`): 47 files / 162 tests red.
- **Behaviour mutations** (production code broken, converted test must go red; restored after each):

| Mutation | Covers | Result |
|---|---|---|
| `SearchPage.clearFilters` returns immediately | badge gone after "Clear filters" (negative) | RED |
| stay documents shown for cancelled bookings | buttons hidden on cancelled (negative) | RED |
| promo chip's remove (x) does nothing | chip gone after remove (negative) | RED |
| `OffersPage` shows the DIRECT5 card unconditionally | card hidden when validate says inactive (negative) | RED |
| `AvailabilityCalendar` never clears `loadError` | error gone after successful retry (negative) | RED |
| duplicate `availability-batch` request | exactly one batch request once settled | RED (original form: GREEN) |
| `SelfCheckIn` auto-advance delay 500 to 900 ms | OTP flow, fake timers | RED |
| `ReviewSummary` chip text changed | positive presence | RED (3 tests) |

- **Lint guard is falsifiable:** with `await waitFor(() => expect(first.result.current).toBe(1.25))` put back into
  `useTenantProcessingFee.test.tsx`, `eslint` exits 1 pointing at that line; removed, it exits 0.
- **Leak guard is falsifiable:** section 2.2 table (fails with the leaker first, passes with the fix).

## 7. The guard (spec)

`atlas/no-wall-clock-wait` (`eslint-rules/no-wall-clock-wait.cjs`), enabled for test files only. It reports
`waitFor`, `waitForElementToBeRemoved`, `findBy*` and `findAllBy*` (also `within(x).findBy*` and destructured forms;
not `vi.waitFor`) unless one of:

1. the call has an explicit `timeout` **and** a `// wall-clock: <why>` comment on the line above, its own line, or
   inside the call;
2. the file installs fake timers that fake `setTimeout` (`vi.useFakeTimers()` with no `toFake`, or `toFake` listing
   `'setTimeout'`; not `shouldAdvanceTime: true`, not a `Date`-only fake).

Ratchet: `eslint-rules/no-wall-clock-wait.baseline.json` lists tolerated unjustified waits per file. More than the entry
fails on the extras (an unlisted file has 0); fewer fails as stale, so the number can never sit above reality.
`eslint-rules/no-wall-clock-wait.baseline.test.cjs` pins the ceiling (8) and the frozen file list, so raising a number
or adding a file is a two-file, reviewable edit. Today's baseline is the three not-run smokes (8 waits).

## 8. Not done, and why

| Item | State |
|---|---|
| 1(a) real synthetic load (busy-loop processes + memory pressure) | deferred by instruction (run after the train, box is shared) |
| 1(b) quiet-box measured column | deferred (recipe in section 9.3); note it must be taken on the **pre-conversion** tree (`40645f7f`), or no waits remain to measure |
| Item 4 base rate from the four named guest logs | **blocked**: none of the four files exists at `C:\AtlasHomestays\logs\release-gate\<name>` (stat, no directory listing). Sample from the entry stands: 4 attempts, 1 mock-defect red, 1 timing red, 2 green. Cause B (section 2.2) means the "timing red" may be a leak red |
| Item 5 where guest vitest should run | deferred (needs a quiet box, RAM included) |
| Item 6 ledger lines | not this worktree |
| Admin portal | later dispatch |
| Broader shared-worker hygiene (DOM residue, storage) | not scanned; only global overrides were |

## 9. Hand-offs

### 9.1 TASK-102725 item 2, second classifier fixture (LABEL ONLY)

A default-timeout DTL wait that expires prints, from vitest (captured from a real run):

```
AssertionError: expected null to be 1.25 // Object.is equality

Ignored nodes: comments, script, style
<html> ... </html>                                   (DTL appends a DOM dump)

 ❯ <test file>:24:54                                  (the `await waitFor(` line)
 ❯ runWithExpensiveErrorDiagnosticsDisabled node_modules/@testing-library/dom/dist/config.js:47:12
 ❯ checkCallback node_modules/@testing-library/dom/dist/wait-for.js:124:77
 ❯ Timeout.checkRealTimersCallback node_modules/@testing-library/dom/dist/wait-for.js:118:16
```

Signature: an `AssertionError` (or `TestingLibraryElementError` for `findBy*`) whose non-test frames are in
`node_modules/@testing-library/dom/dist/wait-for.js` (`checkCallback`, `Timeout.checkRealTimersCallback`). Label it "wait
timed out", **not** "load": Cause B produces the identical signature on an idle box, so the label must not imply a slow
worker.

### 9.2 For the admin dispatch: copy this shape

1. `src/test/settle.ts` verbatim (needs `@testing-library/react` and `vitest`).
2. `src/test/sharedWorkerHygiene.ts` + its test + the one-line call in `setup.ts`, **and first grep admin for the same
   leak**: `git grep -n visibilityState -- '*.test.*'`, then check whether each hit's file lands in a `isolate:false`
   project. Admin's config was the origin of the shared-worker partition (commit `736550a7`).
3. `eslint-rules/no-wall-clock-wait.cjs` verbatim; register it in the `atlas` plugin and enable it in the test-file
   block of `eslint.config.js`. Build the baseline from the linter, not by hand:
   `npx eslint . -f json` and count `atlas/no-wall-clock-wait` messages per file into `files`. Copy the ratchet test and
   set `CEILING` / `FROZEN_FILES` to that first snapshot.
4. Conversion recipe (worked here: 328 of 331 sites mechanically, 3 by hand, and 2 of the mechanical ones needed a hand fix afterwards): an AST codemod that rewrites bare `await waitFor(cb)`
   to `await settle(); <body>` and directly-awaited `findBy*` to `await settle(); getBy*` (one settle per statement,
   consecutive pure assertions share one), drops the unused `waitFor` import, adds the `settle` import. Then run the
   suite in `--shard` halves and fix only the reds by hand, with the three patterns below. The codemod and the inventory
   script are saved for the admin dispatch under `C:\AtlasWork\p0-drain-2026-09-30\proposals\`.
   - a wait whose state is a component's own timer: fake timers for that step, `advanceTimersByTimeAsync(<the delay>)`;
   - a wait that was already true at its first check and now sees a later state: keep the original assertion at that
     moment and add the settled-state assertion (never loosen it);
   - `React.lazy` real chunks: `await import(...)` first, then `settle()`.
5. Verify each converted file is live: strip the drains and confirm the file goes red (or list it as "never waited"),
   and mutate production code for every negative assertion.
6. Do not raise any timeout.

### 9.3 The quiet-box measured column (for later)

Take it at `40645f7f`, on an idle box, with a temporary, uncommitted addition to `src/test/setup.ts`:

```ts
import { configure, getConfig } from "@testing-library/dom";
import { appendFileSync } from "node:fs";
const inner = getConfig().asyncWrapper;
configure({
  asyncWrapper: async (cb) => {
    const t0 = performance.now();
    const at = new Error().stack?.split("\n").find((l) => /\.test\.tsx?/.test(l))?.trim() ?? "?";
    try { return await inner(cb); }
    finally { appendFileSync(process.env.WAIT_MS_LOG!, `${(performance.now() - t0).toFixed(1)}\t${at}\n`); }
  },
});
```

`asyncWrapper` wraps both `waitFor` and every `findBy*`. A call over 100 ms is FRAGILE whatever reading says.

## Appendix A: per-call-site table

Line numbers are those of the file at `40645f7f`, before the conversion.

| # | File:line (at 40645f7f) | Call | Explicit timeout | Verdict |
|---|---|---|---|---|
| 1 | `src/App.a11y.test.tsx:9` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 2 | `src/App.a11y.test.tsx:19` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 3 | `src/__tests__/SearchPage.accessibility.test.tsx:72` | findByTestId | 15_000 | DETERMINISTIC (true at first check; the wait never waited) |
| 4 | `src/__tests__/SearchPage.accessibility.test.tsx:84` | findAllByTestId | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 5 | `src/__tests__/SearchPage.accessibility.test.tsx:97` | waitFor | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 6 | `src/__tests__/SearchPage.accessibility.test.tsx:111` | findAllByTestId | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 7 | `src/__tests__/SearchPage.accessibility.test.tsx:114` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 8 | `src/__tests__/SearchPage.activeFilters.test.tsx:43` | waitFor | 15_000 | DETERMINISTIC (true at first check; the wait never waited) |
| 9 | `src/__tests__/SearchPage.activeFilters.test.tsx:58` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 10 | `src/__tests__/SearchPage.activeFilters.test.tsx:73` | waitFor | 15_000 | DETERMINISTIC (true at first check; the wait never waited) |
| 11 | `src/__tests__/SearchPage.activeFilters.test.tsx:83` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 12 | `src/__tests__/SearchPage.availableTonight.test.tsx:68` | waitFor |  | DETERMINISTIC (true at first check); assertion kept at t=0 AND strengthened after a drain |
| 13 | `src/__tests__/SearchPage.availableTonight.test.tsx:91` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 14 | `src/__tests__/SearchPage.empty.test.tsx:80` | waitFor | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 15 | `src/__tests__/SearchPage.empty.test.tsx:96` | waitFor | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 16 | `src/__tests__/SearchPage.empty.test.tsx:132` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 17 | `src/__tests__/SearchPage.empty.test.tsx:148` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 18 | `src/__tests__/SearchPage.mapView.test.tsx:53` | waitFor | 15_000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 19 | `src/__tests__/SearchPage.mapView.test.tsx:62` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 20 | `src/__tests__/SearchPage.mapView.test.tsx:70` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 21 | `src/components/AvailabilityCalendar.keyboard.test.tsx:27` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 22 | `src/components/AvailabilityCalendar.keyboard.test.tsx:28` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 23 | `src/components/AvailabilityCalendar.keyboard.test.tsx:47` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 24 | `src/components/AvailabilityCalendar.keyboard.test.tsx:64` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 25 | `src/components/AvailabilityCalendar.keyboard.test.tsx:89` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 26 | `src/components/AvailabilityCalendar.keyboard.test.tsx:102` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 27 | `src/components/AvailabilityCalendar.task102485.test.tsx:54` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 28 | `src/components/AvailabilityCalendar.task102485.test.tsx:65` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 29 | `src/components/AvailabilityCalendar.task102485.test.tsx:72` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 30 | `src/components/AvailabilityCalendar.task102485.test.tsx:76` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 31 | `src/components/AvailabilityCalendar.task102485.test.tsx:91` | findAllByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 32 | `src/components/ReviewSummary.provenance.test.tsx:46` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 33 | `src/components/ReviewSummary.provenance.test.tsx:61` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 34 | `src/components/ReviewSummary.provenance.test.tsx:70` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 35 | `src/components/ShortLinkRedirect.task102019.test.tsx:33` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 36 | `src/components/ShortLinkRedirect.task102019.test.tsx:66` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 37 | `src/components/ShortLinkRedirect.task102019.test.tsx:68` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 38 | `src/components/ShortLinkRedirect.task102019.test.tsx:101` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 39 | `src/components/ShortLinkRedirect.task102019.test.tsx:118` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 40 | `src/components/availability/UnitBookingWidget.test.tsx:587` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 41 | `src/components/availability/UnitBookingWidget.test.tsx:603` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 42 | `src/components/availability/UnitBookingWidget.test.tsx:706` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 43 | `src/components/availability/UnitBookingWidget.test.tsx:722` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 44 | `src/components/availability/UnitBookingWidget.test.tsx:731` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 45 | `src/components/availability/UnitBookingWidget.test.tsx:838` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 46 | `src/components/availability/UnitBookingWidget.test.tsx:898` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 47 | `src/components/availability/UnitBookingWidget.test.tsx:914` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 48 | `src/components/availability/UnitBookingWidget.test.tsx:959` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 49 | `src/components/availability/UnitBookingWidget.test.tsx:997` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 50 | `src/components/availability/UnitBookingWidget.test.tsx:1032` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 51 | `src/components/availability/UnitBookingWidget.test.tsx:1080` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 52 | `src/components/availability/UnitBookingWidget.test.tsx:1108` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 53 | `src/components/availability/UnitBookingWidget.test.tsx:1168` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 54 | `src/components/availability/UnitBookingWidget.test.tsx:1210` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 55 | `src/components/availability/UnitBookingWidget.test.tsx:1276` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 56 | `src/components/availability/UnitBookingWidget.test.tsx:1287` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 57 | `src/components/availability/UnitBookingWidget.test.tsx:1298` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 58 | `src/components/availability/UnitBookingWidget.test.tsx:1357` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 59 | `src/components/availability/UnitBookingWidget.test.tsx:1432` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 60 | `src/components/availability/UnitBookingWidget.test.tsx:1445` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 61 | `src/components/availability/UnitBookingWidget.test.tsx:1479` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 62 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:188` | findByLabelText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 63 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:192` | findByRole |  | DETERMINISTIC (true at first check; the wait never waited) |
| 64 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:200` | findByRole |  | DETERMINISTIC (true at first check; the wait never waited) |
| 65 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:207` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 66 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:227` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 67 | `src/components/availability/UnitBookingWidgetAvailabilityRates.test.tsx:240` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 68 | `src/components/availability/UnitBookingWidgetPriceLinesSum.test.tsx:136` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 69 | `src/components/availability/UnitBookingWidgetPriceLinesSum.test.tsx:138` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 70 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:119` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing; file-level) |
| 71 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:120` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing; file-level) |
| 72 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:136` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 73 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:161` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 74 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:162` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 75 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:167` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 76 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:178` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 77 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:195` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 78 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:196` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 79 | `src/components/availability/UnitBookingWidgetReserveIdempotencyKey.test.tsx:210` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 80 | `src/components/availability/UnitBookingWidgetSplitPricingFailure.test.tsx:139` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 81 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:225` | findByLabelText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 82 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:229` | findByRole |  | DETERMINISTIC (true at first check; the wait never waited) |
| 83 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:238` | findByRole |  | DETERMINISTIC (true at first check; the wait never waited) |
| 84 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:247` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 85 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:265` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 86 | `src/components/availability/calendarDateBasis.tzeast.test.tsx:277` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 87 | `src/components/date/AtlasDateRangePicker.test.tsx:64` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 88 | `src/components/date/AtlasDateRangePicker.test.tsx:82` | waitFor | 1000 | DETERMINISTIC (true at first check; the wait never waited) |
| 89 | `src/components/date/AtlasDateRangePicker.test.tsx:244` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 90 | `src/components/date/searchDateBasis.tzeast.test.tsx:229` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 91 | `src/components/date/searchDateBasis.tzeast.test.tsx:250` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 92 | `src/components/date/searchDateBasis.tzeast.test.tsx:255` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 93 | `src/components/date/searchDateBasis.tzeast.test.tsx:265` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 94 | `src/components/date/searchDateBasis.tzeast.test.tsx:284` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 95 | `src/components/date/searchDateBasis.tzeast.test.tsx:293` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 96 | `src/components/date/searchDateBasis.tzeast.test.tsx:311` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 97 | `src/components/date/searchDateBasis.tzeast.test.tsx:320` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 98 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:129` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 99 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:145` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 100 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:156` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 101 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:161` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 102 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:171` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 103 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.aboutDescription.test.tsx:177` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 104 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.checkInTimes.test.tsx:118` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 105 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.checkInTimes.test.tsx:160` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 106 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.listingAddress.test.tsx:116` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 107 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.listingAddress.test.tsx:153` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 108 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.listingAddress.test.tsx:191` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 109 | `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.listingAddress.test.tsx:231` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 110 | `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx:49` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 111 | `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx:50` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 112 | `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx:66` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 113 | `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx:89` | findAllByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 114 | `src/components/homepage_components/homepage_locations/HomePage_Locations.test.tsx:102` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 115 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:30` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 116 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:37` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 117 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:45` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 118 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:48` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 119 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:56` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 120 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:60` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 121 | `src/components/marketplace/airbnbSearch/__tests__/airbnb-search-url-sync.test.tsx:75` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 122 | `src/components/messaging/GuestMessageThread.issues.test.tsx:30` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 123 | `src/components/messaging/GuestMessageThread.issues.test.tsx:34` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 124 | `src/components/messaging/GuestMessageThread.issues.test.tsx:35` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 125 | `src/components/messaging/GuestMessageThread.issues.test.tsx:41` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 126 | `src/components/messaging/GuestMessageThread.issues.test.tsx:44` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 127 | `src/components/messaging/GuestMessageThread.issues.test.tsx:49` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 128 | `src/components/messaging/GuestMessageThread.issues.test.tsx:52` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 129 | `src/components/messaging/GuestMessageThread.issues.test.tsx:54` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 130 | `src/components/messaging/GuestMessageThread.issues.test.tsx:62` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 131 | `src/components/messaging/GuestMessageThread.issues.test.tsx:71` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 132 | `src/components/messaging/GuestMessageThread.issues.test.tsx:78` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 133 | `src/components/messaging/GuestMessageThread.issues.test.tsx:87` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 134 | `src/components/messaging/GuestMessageThread.issues.test.tsx:95` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 135 | `src/components/messaging/GuestMessageThread.issues.test.tsx:99` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 136 | `src/components/support/SupportWidget.assistant.test.tsx:52` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 137 | `src/components/support/SupportWidget.assistant.test.tsx:63` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 138 | `src/components/support/SupportWidget.assistant.test.tsx:125` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 139 | `src/components/support/SupportWidget.assistant.test.tsx:138` | findByText |  | DETERMINISTIC (true at first check; the wait never waited) |
| 140 | `src/pages/BecomeHost.test.tsx:100` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 141 | `src/pages/BecomeHost.test.tsx:124` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 142 | `src/pages/BecomeHost.test.tsx:149` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 143 | `src/pages/BecomeHost.test.tsx:179` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 144 | `src/pages/BookingConfirmationPage.calendar.test.tsx:76` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 145 | `src/pages/BookingConfirmationPage.calendar.test.tsx:85` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 146 | `src/pages/BookingConfirmationPage.calendar.test.tsx:106` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 147 | `src/pages/BookingConfirmationPage.calendar.test.tsx:107` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 148 | `src/pages/BookingConfirmationPage.checkout.test.tsx:32` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing; file-level) |
| 149 | `src/pages/BookingConfirmationPage.stayDocs.test.tsx:80` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 150 | `src/pages/BookingConfirmationPage.stayDocs.test.tsx:105` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 151 | `src/pages/BookingConfirmationPage.stayDocs.test.tsx:137` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 152 | `src/pages/BookingConfirmationPage.stayDocs.test.tsx:163` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 153 | `src/pages/BookingConfirmationPage.test.tsx:116` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 154 | `src/pages/BookingConfirmationPage.test.tsx:124` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 155 | `src/pages/BookingConfirmationPage.test.tsx:144` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 156 | `src/pages/BookingConfirmationPage.test.tsx:180` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 157 | `src/pages/CityLandingPage.test.tsx:52` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 158 | `src/pages/CityLandingPage.test.tsx:55` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 159 | `src/pages/CityLandingPage.test.tsx:111` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 160 | `src/pages/CityLandingPage.test.tsx:114` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 161 | `src/pages/EmbedPage.a11y.test.tsx:75` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 162 | `src/pages/EmbedPage.a11y.test.tsx:84` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 163 | `src/pages/EmbedPage.a11y.test.tsx:93` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 164 | `src/pages/EmbedPage.a11y.test.tsx:103` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 165 | `src/pages/EmbedPage.a11y.test.tsx:126` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 166 | `src/pages/EmbedPage.a11y.test.tsx:134` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 167 | `src/pages/EmbedPage.a11y.test.tsx:173` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 168 | `src/pages/EmbedPage.a11y.test.tsx:208` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 169 | `src/pages/EmbedPage.a11y.test.tsx:224` | findByRole | 5000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 170 | `src/pages/EmbedPage.a11y.test.tsx:229` | waitFor | 5000 | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 171 | `src/pages/EmbedPage.a11y.test.tsx:242` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 172 | `src/pages/EmbedPage.a11y.test.tsx:249` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 173 | `src/pages/EmbedPage.a11y.test.tsx:251` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 174 | `src/pages/EmbedPage.a11y.test.tsx:278` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 175 | `src/pages/EmbedPage.a11y.test.tsx:281` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 176 | `src/pages/EmbedPage.a11y.test.tsx:282` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 177 | `src/pages/EmbedPage.a11y.test.tsx:293` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 178 | `src/pages/EmbedPage.a11y.test.tsx:306` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 179 | `src/pages/EmbedPage.a11y.test.tsx:311` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 180 | `src/pages/EmbedPage.a11y.test.tsx:346` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 181 | `src/pages/EmbedPage.a11y.test.tsx:351` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 182 | `src/pages/EmbedPage.a11y.test.tsx:353` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 183 | `src/pages/EmbedPage.a11y.test.tsx:364` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 184 | `src/pages/EmbedPage.a11y.test.tsx:403` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 185 | `src/pages/EmbedPage.a11y.test.tsx:406` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 186 | `src/pages/EmbedPage.a11y.test.tsx:408` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 187 | `src/pages/EmbedPage.a11y.test.tsx:415` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 188 | `src/pages/EmbedPage.a11y.test.tsx:416` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 189 | `src/pages/EmbedPage.a11y.test.tsx:437` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 190 | `src/pages/EmbedPage.noSubscriptionDiagnostics.test.tsx:46` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 191 | `src/pages/EmbedPage.noSubscriptionDiagnostics.test.tsx:54` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 192 | `src/pages/EmbedPage.trustBadges.test.tsx:69` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 193 | `src/pages/EmbedPage.trustBadges.test.tsx:73` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 194 | `src/pages/EmbedPage.trustBadges.test.tsx:75` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 195 | `src/pages/GuestLoginPage.a11y.test.tsx:68` | findByLabelText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 196 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:70` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 197 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:75` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 198 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:83` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 199 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:142` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 200 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:147` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 201 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:180` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 202 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:185` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 203 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:214` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 204 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:260` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 205 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:265` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 206 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:294` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 207 | `src/pages/GuestLoginPage.sendotp-failure.test.tsx:308` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 208 | `src/pages/HouseRulesAcceptPage.test.tsx:51` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 209 | `src/pages/HouseRulesAcceptPage.test.tsx:56` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 210 | `src/pages/HouseRulesAcceptPage.test.tsx:71` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 211 | `src/pages/HouseRulesAcceptPage.test.tsx:87` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 212 | `src/pages/HouseRulesAcceptPage.test.tsx:89` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 213 | `src/pages/HouseRulesAcceptPage.test.tsx:94` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 214 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:78` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 215 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:103` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 216 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:124` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 217 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:148` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 218 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:169` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 219 | `src/pages/MarketplaceHomepageFeeAndVerifiedHonesty.test.tsx:183` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 220 | `src/pages/MarketplaceHomepageLoadError.test.tsx:80` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 221 | `src/pages/MarketplaceHomepageLoadError.test.tsx:89` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 222 | `src/pages/MarketplaceHomepageLoadError.test.tsx:91` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 223 | `src/pages/MarketplaceHomepagePagination.test.tsx:87` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 224 | `src/pages/MarketplaceHomepagePagination.test.tsx:92` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 225 | `src/pages/MarketplaceHomepagePagination.test.tsx:100` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 226 | `src/pages/MarketplaceHomepagePagination.test.tsx:104` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 227 | `src/pages/MarketplaceHomepagePagination.test.tsx:129` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 228 | `src/pages/MarketplaceHomepagePagination.test.tsx:179` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 229 | `src/pages/MarketplaceHomepagePagination.test.tsx:183` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 230 | `src/pages/MarketplaceHomepagePagination.test.tsx:189` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 231 | `src/pages/MarketplaceHomepagePagination.test.tsx:206` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 232 | `src/pages/MarketplaceHomepageSearchCarry.test.tsx:69` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 233 | `src/pages/MarketplaceHomepageSeo.test.tsx:75` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 234 | `src/pages/MarketplaceHomepageSeo.test.tsx:79` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 235 | `src/pages/MarketplaceHomepageSeo.test.tsx:94` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 236 | `src/pages/MarketplaceHomepageSeo.test.tsx:95` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 237 | `src/pages/MarketplaceReviewProvenance.test.tsx:80` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 238 | `src/pages/MarketplaceReviewProvenance.test.tsx:89` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 239 | `src/pages/MarketplaceReviewProvenance.test.tsx:98` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 240 | `src/pages/MarketplaceReviewProvenance.test.tsx:107` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 241 | `src/pages/MyBookingsPage.dateTz.test.tsx:79` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 242 | `src/pages/MyBookingsPage.dateTz.test.tsx:110` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 243 | `src/pages/MyBookingsPage.dateTz.test.tsx:115` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 244 | `src/pages/MyBookingsPage.errorStates.test.tsx:70` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 245 | `src/pages/MyBookingsPage.errorStates.test.tsx:87` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 246 | `src/pages/MyBookingsPage.errorStates.test.tsx:102` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 247 | `src/pages/MyBookingsPage.errorStates.test.tsx:116` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 248 | `src/pages/MyBookingsPage.errorStates.test.tsx:127` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 249 | `src/pages/MyBookingsPage.errorStates.test.tsx:142` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 250 | `src/pages/MyBookingsPage.rebookCta.test.tsx:92` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 251 | `src/pages/MyBookingsPage.rebookCta.test.tsx:99` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 252 | `src/pages/MyBookingsPage.rebookCta.test.tsx:101` | findAllByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 253 | `src/pages/MyBookingsPage.rebookCta.test.tsx:119` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 254 | `src/pages/MyBookingsPage.rebookCta.test.tsx:123` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 255 | `src/pages/MyBookingsPage.reviewCta.test.tsx:91` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 256 | `src/pages/MyBookingsPage.reviewCta.test.tsx:100` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 257 | `src/pages/MyBookingsPage.reviewCta.test.tsx:102` | findAllByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 258 | `src/pages/MyBookingsPage.reviewCta.test.tsx:113` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 259 | `src/pages/MyBookingsPage.reviewCta.test.tsx:115` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 260 | `src/pages/MyDataPage.test.tsx:56` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 261 | `src/pages/SelfCheckIn.a11y.test.tsx:61` | findByRole |  | DETERMINISTIC (true at first check; the wait never waited) |
| 262 | `src/pages/SelfCheckIn.a11y.test.tsx:93` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 263 | `src/pages/SelfCheckIn.a11y.test.tsx:96` | findByLabelText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 264 | `src/pages/SelfCheckIn.multiGuest.test.tsx:62` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 265 | `src/pages/SelfCheckIn.multiGuest.test.tsx:73` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 266 | `src/pages/SelfCheckIn.multiGuest.test.tsx:96` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 267 | `src/pages/SelfCheckIn.multiGuest.test.tsx:104` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 268 | `src/pages/SelfCheckIn.multiGuest.test.tsx:123` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 269 | `src/pages/SelfCheckIn.multiGuest.test.tsx:145` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 270 | `src/pages/SelfCheckIn.multiGuest.test.tsx:153` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 271 | `src/pages/SelfCheckIn.multiGuest.test.tsx:157` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 272 | `src/pages/SelfCheckIn.multiGuest.test.tsx:179` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 273 | `src/pages/SelfCheckIn.multiGuest.test.tsx:185` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 274 | `src/pages/SelfCheckIn.multiGuest.test.tsx:205` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 275 | `src/pages/SelfCheckIn.multiGuest.test.tsx:220` | waitFor | 2000 | WALL-CLOCK-ON-REAL-WORK -> fake timers (the page's own 500 ms timer; was a 2 s window) |
| 276 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:49` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 277 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:53` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 278 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:61` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 279 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:81` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 280 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:93` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 281 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:102` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 282 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:109` | findByRole |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 283 | `src/pages/__tests__/FavoritesPage.reminderAuth.test.tsx:115` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 284 | `src/pages/booking/GuestCheckoutSecurityBadges.test.tsx:48` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 285 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:194` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 286 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:195` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 287 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:202` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 288 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:207` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 289 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:225` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 290 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:283` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 291 | `src/pages/booking/GuestCheckoutTenantSlugParity.test.tsx:295` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 292 | `src/pages/booking/GuestDetailsPage.a11y.test.tsx:45` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 293 | `src/pages/booking/GuestDetailsPage.a11y.test.tsx:94` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 294 | `src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx:46` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 295 | `src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx:82` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 296 | `src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx:94` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 297 | `src/pages/booking/GuestDetailsPage.abandonOnDeparture.test.tsx:117` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 298 | `src/pages/booking/GuestDetailsPage.consentHitbox.test.tsx:47` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 299 | `src/pages/booking/GuestDetailsPage.consentHitbox.test.tsx:53` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 300 | `src/pages/booking/GuestDetailsPage.consentHitbox.test.tsx:60` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 301 | `src/pages/booking/GuestDetailsPage.focusScroll.test.tsx:52` | findByTestId |  | DETERMINISTIC (true at first check; the wait never waited) |
| 302 | `src/pages/booking/GuestDetailsPage.focusScroll.test.tsx:54` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 303 | `src/pages/booking/GuestDetailsPage.gstStatement.test.tsx:57` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 304 | `src/pages/booking/GuestDetailsPage.gstStatement.test.tsx:97` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 305 | `src/pages/booking/GuestDetailsPage.gstStatement.test.tsx:121` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 306 | `src/pages/booking/GuestDetailsPage.gstStatement.test.tsx:144` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 307 | `src/pages/booking/GuestDetailsPage.promoSavingsChip.test.tsx:58` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing; file-level) |
| 308 | `src/pages/booking/GuestDetailsPage.promoSavingsChip.test.tsx:67` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing; file-level) |
| 309 | `src/pages/booking/GuestDetailsPage.promoSavingsChip.test.tsx:112` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 310 | `src/pages/booking/GuestDetailsPage.razorpayPreload.test.tsx:50` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 311 | `src/pages/home/Home.test.tsx:48` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 312 | `src/pages/home/__tests__/Home.test.tsx:109` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 313 | `src/pages/home/__tests__/HomeSuspenseIsolation.test.tsx:67` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 314 | `src/pages/home/__tests__/HomeSuspenseIsolation.test.tsx:70` | findByText |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 315 | `src/themes/__tests__/ac7-layout-theme-switch.test.tsx:176` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 316 | `src/themes/__tests__/ac7-layout-theme-switch.test.tsx:188` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 317 | `src/themes/__tests__/coastal-smoke.test.tsx:134` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 318 | `src/themes/__tests__/coastal-smoke.test.tsx:158` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 319 | `src/themes/__tests__/editorial-smoke.test.tsx:156` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 320 | `src/themes/__tests__/noir-layout-theme.test.tsx:139` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 321 | `src/themes/__tests__/photofirst-smoke.test.tsx:137` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 322 | `src/themes/__tests__/photofirst-smoke.test.tsx:155` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 323 | `src/themes/__tests__/photofirst-smoke.test.tsx:174` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 324 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:123` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 325 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:138` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 326 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:147` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 327 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:152` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 328 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:160` | findByTestId |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 329 | `src/themes/heritage/PropertyDetails.aboutDescription.test.tsx:165` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 330 | `tests/AdvertisedPromoGuard.test.tsx:50` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 331 | `tests/AdvertisedPromoGuard.test.tsx:69` | waitFor |  | WALL-CLOCK-ON-MOCKED-WORK (load-bearing) |
| 332 | `tests/AdvertisedPromoGuard.test.tsx:88` | waitFor |  | DETERMINISTIC (true at first check; the wait never waited) |
| 333 | `tests/PropertyDetailsMedia.test.tsx:138` | findByText |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 334 | `tests/PropertyDetailsMedia.test.tsx:154` | findByText | 5000 | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 335 | `tests/propertyDetailsRouteSmoke.test.tsx:118` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 336 | `tests/propertyDetailsRouteSmoke.test.tsx:135` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 337 | `tests/propertyDetailsRouteSmoke.test.tsx:152` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 338 | `tests/propertyDetailsRouteSmoke.test.tsx:169` | waitFor |  | NOT RUN (heavyRouteSmokes); unverifiable, baselined |
| 339 | `tests/smokeBookingFlow.test.tsx:52` | findByRole | 30_000 | DETERMINISTIC (true at first check; the wait never waited) |

