import { vi } from "vitest";

/**
 * Per-file reset of the state that a REUSED test worker carries from one test file to the next.
 *
 * WHY THIS EXISTS (TASK-102734, cause C in docs/testing/waitfor-audit-2026-09-30.md).
 * Two of the four projects in vitest.config.ts run many files on ONE thread: `shared-fast` (`isolate: false`) and,
 * under `npm run test:gate` (ATLAS_VITEST_GATE_BATCH=1), `mocked-isolated` through scripts/vitest-isolated-batch-pool.mjs.
 * The batch pool forces `isolate: true` into every message it sends, and in Vitest 4.1 that resets exactly two things
 * before each file: the module registry (`resetModules`) and the mocker's per-file registry (`mocker.reset()`).
 * The jsdom environment is built ONCE when the thread starts (`setupBaseEnvironment`), so every file inherits the
 * previous file's `window`, `document`, storage, cookies and URL, and so does anything that lives outside the module
 * registry. Normal mode (a fresh thread per file) has none of this, which is why only the gate topology went red:
 *
 *   victim                                   left behind by                          state that crossed the boundary
 *   ---------------------------------------  --------------------------------------  ---------------------------------------
 *   tests/orderRequestHeaders                pages/__tests__/favorites-sync-and-...  four queued `vi.mock`s (see drain below)
 *   UnitBookingWidgetReserveIdempotencyKey   pages/booking/GuestCheckoutTenantSlug... jsdom URL `?tenant=qa-bot-c59de6`
 *   GuestDetailsPage.razorpayPreload         pages/booking/GuestCheckoutTenantSlug... `window.Razorpay`
 *   MyBookingsPage.rebookCta                 pages/MyBookingsPage.errorStates        `atlas_guest_auth` in localStorage
 *   UnitBookingWidgetPriceLinesSum           tests/smokeBookingFlow (1 run in 2)     route imports still in flight (see drain)
 *
 * Whether a run is red depends only on which file the single batch thread happened to run just before the victim.
 * The default sequencer orders files by cached duration, failed first, so that predecessor moves with load without the
 * machine ever being slow: it reads as "a load flake" and is not one.
 *
 * TWO HALVES.
 *  - `resetSharedWorkerState()` runs at the START of every file, from the FIRST setup file (see
 *    sharedWorkerResetSetup.ts) so it precedes every module that reads the URL or storage while it is being evaluated
 *    (`guestAuthStorage` reads localStorage at import). It puts the shared jsdom back to what the thread started with.
 *  - `drainCrossFileAsyncState()` runs at the END of every file. It cannot run at the start: both things it drains are
 *    flushed by the next file's first module fetch, which happens BEFORE any setup file executes.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not clear timers, remove listeners or restore DOM prototypes. A blanket
 * clear would also kill timers and listeners owned by externalised libraries that are evaluated once per thread
 * (react-dom's scheduler captures `setTimeout`; React registers `selectionchange` once per document), and that would
 * wedge them for every later file. See the "not fixed" list in the audit for the measured leftovers.
 */

const g = globalThis as unknown as Record<string, unknown>;

/**
 * `window` properties that tests redefine or assign and then forget. Evidence (grep of the suite, 2026-09-30):
 * `Object.defineProperty(window, "innerWidth" | "innerHeight" | "location")`, `window.scrollTo = vi.fn()`,
 * `vi.stubGlobal("IntersectionObserver" | "confirm" | "alert")`. `fetch`, `matchMedia` and `ResizeObserver` are
 * intentionally absent: src/test/setup.ts re-arms them at the start of every file.
 */
const RESTORED_WINDOW_PROPS = [
  "location",
  "innerWidth",
  "innerHeight",
  "outerWidth",
  "outerHeight",
  "scrollTo",
  "scroll",
  "scrollBy",
  "open",
  "alert",
  "confirm",
  "IntersectionObserver",
] as const;

/**
 * Third-party SDK globals the app feature-detects (`if (window.Razorpay) ...`) and tests stub by plain assignment.
 * They are absent when a worker starts, so restoring means deleting.
 */
const SDK_GLOBALS = ["Razorpay", "gtag", "dataLayer", "google"] as const;

/** Head elements that describe a page (SEO, analytics loaders). Styles are left alone: see resetDocument(). */
const REMOVABLE_HEAD_TAGS = new Set(["SCRIPT", "META", "TITLE", "BASE", "NOSCRIPT"]);

const BASELINE_KEY = "__atlasSharedWorkerBaseline__";

interface PropBaseline {
  descriptor: PropertyDescriptor | undefined;
  value: unknown;
}

interface WorkerBaseline {
  href: string;
  props: Map<string, PropBaseline>;
  headKeep: Set<Element>;
  bodyKeep: Set<Element>;
  htmlAttrs: Map<string, string>;
  bodyAttrs: Map<string, string>;
}

function attributesOf(el: Element): Map<string, string> {
  return new Map(Array.from(el.attributes, (a): [string, string] => [a.name, a.value]));
}

/**
 * The thread's starting state, captured by the FIRST call in a thread and kept on `globalThis` (this module is
 * re-created for every file when the registry is reset, so module scope cannot hold it).
 */
function baseline(): WorkerBaseline {
  const existing = g[BASELINE_KEY] as WorkerBaseline | undefined;
  if (existing) return existing;
  const props = new Map<string, PropBaseline>();
  for (const name of [...RESTORED_WINDOW_PROPS, ...SDK_GLOBALS]) {
    props.set(name, { descriptor: Object.getOwnPropertyDescriptor(g, name), value: g[name] });
  }
  const created: WorkerBaseline = {
    href: window.location.href,
    props,
    headKeep: new Set(Array.from(document.head.children)),
    bodyKeep: new Set(Array.from(document.body.children)),
    htmlAttrs: attributesOf(document.documentElement),
    bodyAttrs: attributesOf(document.body),
  };
  Object.defineProperty(g, BASELINE_KEY, { value: created, enumerable: false, configurable: true, writable: true });
  return created;
}

function sameDescriptor(a: PropertyDescriptor | undefined, b: PropertyDescriptor | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.get === b.get &&
    a.set === b.set &&
    a.value === b.value &&
    a.writable === b.writable &&
    a.enumerable === b.enumerable &&
    a.configurable === b.configurable
  );
}

function restoreWindowProp(name: string, base: PropBaseline): void {
  const current = Object.getOwnPropertyDescriptor(g, name);
  if (base.descriptor === undefined) {
    if (current !== undefined) Reflect.deleteProperty(g, name);
    return;
  }
  if (!sameDescriptor(current, base.descriptor)) Object.defineProperty(g, name, base.descriptor);
  // Vitest's jsdom bridge stores an assignment to an accessor-backed window key in a side map, so the descriptor can
  // be untouched while the value read through it is not (`window.innerWidth = 375`). Compare the value as well.
  if (g[name] !== base.value) {
    try {
      g[name] = base.value;
    } catch {
      /* read-only in this environment: nothing more can be done */
    }
  }
}

function syncAttributes(el: Element, wanted: Map<string, string>): void {
  for (const attr of Array.from(el.attributes)) {
    if (!wanted.has(attr.name)) el.removeAttribute(attr.name);
  }
  for (const [name, value] of wanted) {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
}

function clearCookies(): void {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function resetDocument(base: WorkerBaseline): void {
  for (const el of Array.from(document.head.children)) {
    if (base.headKeep.has(el)) continue;
    // Stylesheets are kept: a library that injects its CSS once per thread would otherwise lose it for every later
    // file, and no assertion in this suite reads a page-level tag from a stylesheet another file injected.
    const isStylesheetLink = el.tagName === "LINK" && /\bstylesheet\b/i.test(el.getAttribute("rel") ?? "");
    if (REMOVABLE_HEAD_TAGS.has(el.tagName) || (el.tagName === "LINK" && !isStylesheetLink)) el.remove();
  }
  for (const el of Array.from(document.body.children)) {
    if (!base.bodyKeep.has(el)) el.remove();
  }
  syncAttributes(document.documentElement, base.htmlAttrs);
  syncAttributes(document.body, base.bodyAttrs);
}

/** Every step is independent: one that throws must neither stop the rest nor be the reason a test file fails. */
function attempt(step: () => void): void {
  try {
    step();
  } catch {
    /* the guard (scripts/vitest-gate-batch-hygiene.self-test.mjs) proves the effect, not the absence of a throw */
  }
}

/**
 * Undo a per-instance override of `document.visibilityState` left behind by an earlier test file.
 *
 * `GuestDetailsPage.abandonOnDeparture.test.tsx` simulates a hidden tab with
 * `Object.defineProperty(document, "visibilityState", { value: "hidden" })` and its last test never put it back, so the
 * NEXT file that worker ran started with a hidden tab. `useTenantProcessingFee` returns early from `refresh()` while
 * the tab is hidden, so `src/hooks/useTenantProcessingFee.test.tsx` then read `null` forever and failed after two
 * 1,000 ms `waitFor` timeouts: the release-gate STEP 1 signature of 2026-09-30 ("expected null to be 1.25",
 * `(7 tests | 2 failed) 2095ms`). Reproduced with `ATLAS_GUEST_VITEST_MAX_WORKERS=1 npx vitest run --project shared-fast
 * --maxWorkers=1 <abandonOnDeparture test> <useTenantProcessingFee test>`; `settle()` does not cure it.
 *
 * Deleting the own property restores jsdom's prototype getter ("visible").
 */
export function restoreDocumentVisibility(): void {
  if (typeof document === "undefined") return;
  if (Object.prototype.hasOwnProperty.call(document, "visibilityState")) {
    delete (document as unknown as { visibilityState?: unknown }).visibilityState;
  }
}

/** Put the shared jsdom and the window/global surface back to what the worker thread started with. Idempotent. */
export function resetSharedWorkerState(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const base = baseline();

  attempt(restoreDocumentVisibility);
  // Timers and stubs a previous file left installed. `vi` is one singleton per thread, so these are not per-file.
  attempt(() => {
    if (vi.isFakeTimers()) vi.useRealTimers();
  });
  attempt(() => {
    vi.unstubAllGlobals();
  });
  attempt(() => {
    vi.unstubAllEnvs();
  });

  // Replaced or assigned window properties (a test that swaps `window.location` for a plain object, sets a viewport
  // width, stubs `scrollTo`, or leaves a `Razorpay` mock behind).
  for (const [name, propBase] of base.props) attempt(() => restoreWindowProp(name, propBase));

  // The URL. App code moves it (`history.replaceState` adds `?tenant=` on the checkout pages; BrowserRouter pushes).
  attempt(() => {
    if (window.location.href !== base.href) window.history.replaceState(null, "", base.href);
  });

  // Web storage and cookies persist for the life of the jsdom, i.e. the whole thread.
  attempt(() => window.localStorage.clear());
  attempt(() => window.sessionStorage.clear());
  attempt(clearCookies);

  attempt(() => resetDocument(base));
}

interface ModuleMocker {
  resolveMocks?: () => Promise<void>;
}

/**
 * The module mocker hangs on the worker global as `__vitest_mocker__` (this is how `vi.mock` itself finds it). Read only
 * here, and pinned by src/test/sharedWorkerHygiene.pendingMocks.test.ts so a Vitest upgrade that moves it fails loudly.
 */
export function moduleMocker(): ModuleMocker | undefined {
  return (g as { __vitest_mocker__?: ModuleMocker }).__vitest_mocker__;
}

/**
 * How many `vi.mock`/`vi.doMock`/`vi.unmock` registrations are queued and not yet flushed by a module fetch.
 * `BareModuleMocker.pendingIds` is a STATIC field, so it is read through the mocker's constructor.
 */
export function queuedMockCount(): number {
  const mockerClass = (moduleMocker() as { constructor?: { pendingIds?: unknown[] } } | undefined)?.constructor;
  return mockerClass?.pendingIds?.length ?? 0;
}

/**
 * Finish the asynchronous work that would otherwise cross the boundary into the next file. Register with
 * `afterAll(drainCrossFileAsyncState)` (sharedWorkerResetSetup.ts does).
 *
 * 1. Route imports in flight. A whole-`App` render (`tests/smokeBookingFlow.test.tsx`) ends with `React.lazy` chunk
 *    imports still resolving. They finish inside the NEXT file's fresh module registry, before that file has
 *    registered its mocks, and cache REAL modules (a widget bound to the real tenant context) that the next file's
 *    `vi.mock` then cannot replace: `UnitBookingWidgetPriceLinesSum` lost its 3% fee row 1 run in 2 behind it.
 *    `vi.dynamicImportSettled()` waits for them to land while this file's registry is still the current one.
 * 2. Queued mocks. `vi.mock`/`vi.doMock` only QUEUE the registration on `BareModuleMocker.pendingIds`, a STATIC list;
 *    the next module fetch flushes it. `mocker.reset()` clears the per-file registry but not that list. A file that
 *    queues mocks and never imports anything afterwards (`favorites-sync-and-reminder.test.tsx` mocks four modules and
 *    imports none) leaves them queued, and the next file's first fetch (the setup file itself) registers them in ITS
 *    registry: `orderRequestHeaders` received another file's `@/api/client`. Flushing here registers them in this
 *    file's registry, which is discarded.
 */
export async function drainCrossFileAsyncState(): Promise<void> {
  await vi.dynamicImportSettled();
  await moduleMocker()?.resolveMocks?.();
}
