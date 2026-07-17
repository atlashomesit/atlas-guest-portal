import { onRequest } from "../functions/_middleware";

/**
 * TASK-4905 / ADR-0018 (2026-07-16 amendment): exercises the root Pages Function middleware's
 * FAIL-OPEN CONTRACT directly (`functions/_middleware.ts`'s hard requirement — see the file's own
 * doc comment) plus the happy-path wiring from a tenant-site-meta payload to the actual
 * HTMLRewriter `.on(selector, handlers)` calls.
 *
 * `HTMLRewriter` is a Cloudflare Workers runtime global with no Node/vitest equivalent, so this
 * file stubs a minimal fake via `vi.stubGlobal` (cleaned up in `afterEach` — required because this
 * file runs in vitest's shared-fast, isolate:false project alongside other test files, and a
 * dangling global stub would leak across files). One test deliberately does NOT stub it, proving
 * the middleware survives even a completely absent HTMLRewriter global (the worst-case real-world
 * failure this contract exists for).
 */

class FakeHTMLRewriter {
  private handlers: Array<{ selector: string; handlers: { element(el: unknown): void } }> = [];

  on(selector: string, handlers: { element(el: unknown): void }) {
    this.handlers.push({ selector, handlers });
    return this;
  }

  transform(response: Response) {
    const appliedAttrs: Record<string, string> = {};
    let innerContent: string | undefined;

    for (const { selector, handlers } of this.handlers) {
      const el = {
        setAttribute: (name: string, value: string) => {
          appliedAttrs[`${selector}::${name}`] = value;
        },
        setInnerContent: (content: string) => {
          innerContent = content;
        },
      };
      handlers.element(el);
    }

    return new Response(JSON.stringify({ appliedAttrs, innerContent }), {
      status: response.status,
      headers: { "content-type": "application/json", "x-fake-rewritten": "true" },
    });
  }
}

/** A "the rewrite step itself blows up" fake — simulates a real HTMLRewriter bug/edge failure. */
class ThrowingHTMLRewriter {
  on() {
    return this;
  }
  transform(): Response {
    throw new Error("simulated HTMLRewriter failure");
  }
}

function makeHtmlResponse(): Response {
  return new Response("<!doctype html><html><head><title>Atlastays</title></head><body></body></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function makeContext(overrides: {
  url: string;
  next: () => Promise<Response>;
  env?: { ATLAS_API_BASE_URL?: string };
}) {
  return {
    request: new Request(overrides.url),
    env: overrides.env ?? { ATLAS_API_BASE_URL: "https://api.example.com" },
    next: overrides.next,
  };
}

const tenantMetaPayload = {
  tenantSlug: "gaurav",
  propertyName: "Gaurav's Lake View Villa",
  description: "Stay lakeside at Gaurav's Lake View Villa.",
  photoUrl: "https://cdn.example.com/gaurav-cover.jpg",
  canonicalUrl: "https://gauravsguesthouse.example.com/",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("_middleware onRequest — non-HTML / excluded-host short-circuits (no API call)", () => {
  it("passes a non-HTML response through untouched without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);

    const jsonResponse = new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    const result = await onRequest(
      makeContext({ url: "https://tenant-a.example.com/api/whatever", next: async () => jsonResponse }),
    );

    expect(result).toBe(jsonResponse);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes the marketplace apex through untouched without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);

    const html = makeHtmlResponse();
    const result = await onRequest(makeContext({ url: "https://atlastays.com/", next: async () => html }));

    expect(result).toBe(html);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes an Atlas direct-booking domain through untouched without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: "https://www.atlashomestays.com/", next: async () => html }),
    );

    expect(result).toBe(html);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("_middleware onRequest — happy path (tenant host, HTML response, meta resolves)", () => {
  it("rewrites og/twitter/canonical/title tag values from the resolved tenant meta", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(tenantMetaPayload), { status: 200 })),
    );

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: "https://gauravsguesthouse.example.com/", next: async () => html }),
    );

    expect(result.headers.get("x-fake-rewritten")).toBe("true"); // proves the rewrite path ran, not fail-open
    const body = await result.json();
    expect(body.innerContent).toBe("Gaurav's Lake View Villa");
    expect(body.appliedAttrs['meta[property="og:title"]::content']).toBe("Gaurav's Lake View Villa");
    expect(body.appliedAttrs['meta[property="og:description"]::content']).toBe(
      "Stay lakeside at Gaurav's Lake View Villa.",
    );
    expect(body.appliedAttrs['meta[property="og:image"]::content']).toBe(
      "https://cdn.example.com/gaurav-cover.jpg",
    );
    expect(body.appliedAttrs['link[rel="canonical"]::href']).toBe("https://gauravsguesthouse.example.com/");
    expect(body.appliedAttrs['meta[name="twitter:title"]::content']).toBe("Gaurav's Lake View Villa");
  });

  it("calls the API with the request host and only once across two requests within the TTL (cache hit)", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify(tenantMetaPayload), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const uniqueHost = `cache-hit-${Date.now()}.example.com`;
    await onRequest(
      makeContext({ url: `https://${uniqueHost}/`, next: async () => makeHtmlResponse() }),
    );
    await onRequest(
      makeContext({ url: `https://${uniqueHost}/homes/1`, next: async () => makeHtmlResponse() }),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain(encodeURIComponent(uniqueHost));
  });
});

describe("_middleware onRequest — FAIL-OPEN CONTRACT", () => {
  it("fails open when the API fetch rejects (network error)", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: `https://fail-fetch-${Date.now()}.example.com/`, next: async () => html }),
    );

    expect(result).toBe(html);
  });

  it("fails open when the API returns 404 (unresolved host)", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: `https://unresolved-${Date.now()}.example.com/`, next: async () => html }),
    );

    expect(result).toBe(html);
  });

  it("fails open when the API returns malformed JSON", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json{{{", { status: 200 })),
    );

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: `https://malformed-json-${Date.now()}.example.com/`, next: async () => html }),
    );

    expect(result).toBe(html);
  });

  it("fails open when ATLAS_API_BASE_URL is not configured (never a 500)", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({
        url: `https://no-api-base-${Date.now()}.example.com/`,
        next: async () => html,
        env: {},
      }),
    );

    expect(result).toBe(html);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails open when HTMLRewriter.transform() itself throws (real edge-bug simulation)", async () => {
    vi.stubGlobal("HTMLRewriter", ThrowingHTMLRewriter);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(tenantMetaPayload), { status: 200 })),
    );

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: `https://throwing-rewriter-${Date.now()}.example.com/`, next: async () => html }),
    );

    expect(result).toBe(html);
  });

  it("fails open when the HTMLRewriter global is entirely absent (worst case — no stub at all)", async () => {
    // Deliberately no `vi.stubGlobal("HTMLRewriter", ...)` here.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(tenantMetaPayload), { status: 200 })),
    );

    const html = makeHtmlResponse();
    const result = await onRequest(
      makeContext({ url: `https://no-rewriter-global-${Date.now()}.example.com/`, next: async () => html }),
    );

    expect(result).toBe(html);
  });

  it("fails open when context.next() itself throws (never swallowed into a 500 by this Function)", async () => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      onRequest(
        makeContext({
          url: `https://next-throws-${Date.now()}.example.com/`,
          next: async () => {
            throw new Error("upstream Pages routing failure");
          },
        }),
      ),
    ).rejects.toThrow("upstream Pages routing failure");
    // Note: next()'s own failure is intentionally NOT caught by this Function's try/catch — there
    // is no "original response" to fall back to yet. This is Cloudflare Pages' own routing/asset
    // layer failing, outside this Function's fail-open contract (which only covers the
    // tenant-resolution + rewrite step once a response already exists).
  });
});
