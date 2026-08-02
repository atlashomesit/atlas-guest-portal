import worker from "../workers/tenant-subdomain-router/src/index";

/**
 * TASK-7170 / ADR-0096: unit contract for the `tenant-subdomain-router` Cloudflare Worker
 * (`workers/tenant-subdomain-router/`), the thin passthrough attached to route
 * `*.atlastays.com/*` that proxies tenant subdomains to the existing `atlas-guest-portal`
 * Pages project.
 *
 * The pinned contract:
 *  1. The origin fetch targets `https://atlas-guest-portal.pages.dev<path>?<query>` — path and
 *     querystring preserved byte-for-byte.
 *  2. The public host is conveyed ONLY via `X-Forwarded-Host` / `X-Public-Origin` — never via
 *     the `Host` header, which would loop the request back to this Worker through the zone.
 *  3. Zero tenant logic: method/body and the origin response pass through untouched, so the
 *     Worker's only failure modes are Cloudflare-platform failures.
 *
 * The Worker module imports nothing and touches no Cloudflare-only globals, so it runs under
 * plain vitest with `fetch` stubbed (same pattern as `tenantSiteMetaMiddleware.test.ts`).
 */

const PAGES_ORIGIN = "https://atlas-guest-portal.pages.dev";

function stubFetchCapturingRequests(): Request[] {
  const captured: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      captured.push(input);
      return new Response("origin-body", { status: 200 });
    }),
  );
  return captured;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tenant-subdomain-router Worker — origin fetch", () => {
  it("fetches the same path + querystring on the Pages origin", async () => {
    const captured = stubFetchCapturingRequests();

    await worker.fetch(
      new Request("https://starguesthouse.atlastays.com/homes/12?checkin=2026-08-10&checkout=2026-08-14&adults=2"),
    );

    expect(captured).toHaveLength(1);
    const originUrl = new URL(captured[0].url);
    expect(originUrl.origin).toBe(PAGES_ORIGIN);
    expect(originUrl.pathname).toBe("/homes/12");
    expect(originUrl.search).toBe("?checkin=2026-08-10&checkout=2026-08-14&adults=2");
  });

  it("preserves an empty path + absent querystring as the origin root", async () => {
    const captured = stubFetchCapturingRequests();

    await worker.fetch(new Request("https://starguesthouse.atlastays.com"));

    const originUrl = new URL(captured[0].url);
    expect(originUrl.origin).toBe(PAGES_ORIGIN);
    expect(originUrl.pathname).toBe("/");
    expect(originUrl.search).toBe("");
  });
});

describe("tenant-subdomain-router Worker — host conveyance (ADR-0096 loop guard)", () => {
  it("conveys the public host via X-Forwarded-Host and X-Public-Origin", async () => {
    const captured = stubFetchCapturingRequests();

    await worker.fetch(new Request("https://starguesthouse.atlastays.com/homes/12"));

    expect(captured[0].headers.get("x-forwarded-host")).toBe("starguesthouse.atlastays.com");
    expect(captured[0].headers.get("x-public-origin")).toBe("https://starguesthouse.atlastays.com");
  });

  it("never forwards the public host as the Host header (the zone would loop back to the Worker)", async () => {
    const captured = stubFetchCapturingRequests();

    // The edge presents the public Host on the incoming request; simulate it explicitly so the
    // assertion below proves the Worker strips it rather than relying on the test runtime's
    // header filtering.
    const incoming = new Request("https://starguesthouse.atlastays.com/", {
      headers: { host: "starguesthouse.atlastays.com" },
    });
    await worker.fetch(incoming);

    expect(captured[0].headers.get("host")).not.toBe("starguesthouse.atlastays.com");
  });
});

describe("tenant-subdomain-router Worker — logic-free passthrough", () => {
  it("passes method + body through to the origin (POST)", async () => {
    const captured = stubFetchCapturingRequests();
    const body = JSON.stringify({ name: "Gaurav", nights: 3 });

    await worker.fetch(
      new Request("https://starguesthouse.atlastays.com/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );

    expect(captured[0].method).toBe("POST");
    expect(captured[0].headers.get("content-type")).toBe("application/json");
    expect(await captured[0].text()).toBe(body);
  });

  it("returns the origin response untouched (status, headers, body)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("tenant-html", {
            status: 404,
            headers: { "content-type": "text/html", "x-origin-marker": "pages" },
          }),
      ),
    );

    const result = await worker.fetch(new Request("https://no-such-tenant.atlastays.com/nope"));

    expect(result.status).toBe(404);
    expect(result.headers.get("x-origin-marker")).toBe("pages");
    expect(await result.text()).toBe("tenant-html");
  });
});
