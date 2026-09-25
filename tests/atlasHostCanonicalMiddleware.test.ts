import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onRequest } from "../functions/_middleware";
import { buildMetaRewriteValues } from "../functions/_lib/tenantSiteMeta";

/**
 * TASK-101940: `functions/_middleware.ts` on the REAL `index.html`, read the way a JS-blind
 * crawler reads it. Companion to `tests/tenantSiteMetaMiddleware.test.ts`, whose fake records
 * which handlers ran; this one applies them to the actual markup, so a test can assert what the
 * served `<head>` contains — including that there is still exactly ONE canonical link.
 *
 * Three guarantees, one describe each:
 *   1. Atlas direct-booking hosts get the canonical/og:url SEO.tsx sets after hydration, on the
 *      routes where that value is a pure function of the URL — and nothing anywhere else.
 *   2. Tenant hosts (custom domain, Worker-proxied subdomain, unresolved host) are byte-for-byte
 *      what they were before this change. These arms were run green against the pre-change
 *      middleware before the Atlas branch was added.
 *   3. Any failure in the Atlas rewrite serves the original response.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_HTML = readFileSync(join(ROOT, "index.html"), "utf8");

type FakeElement = {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
  remove(): void;
};
type Handlers = { element(el: FakeElement): void };

const constructed: string[][] = [];

/**
 * Minimal string-level HTMLRewriter: supports exactly the selector shapes the middleware uses
 * (`tag` and `tag[attr="value"]`). Like the real one, `transform()` returns synchronously and the
 * rewrite happens while the body is read.
 */
class StringHTMLRewriter {
  private readonly rules: Array<{ selector: string; handlers: Handlers }> = [];

  constructor() {
    constructed.push([]);
  }

  on(selector: string, handlers: Handlers) {
    this.rules.push({ selector, handlers });
    constructed[constructed.length - 1].push(selector);
    return this;
  }

  transform(response: Response): Response {
    const rules = this.rules;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let html = await response.text();
        for (const { selector, handlers } of rules) html = applyRule(html, selector, handlers);
        controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
}

function applyRule(html: string, selector: string, handlers: Handlers): string {
  const m = selector.match(/^([a-z]+)(?:\[([a-z:-]+)="([^"]*)"\])?$/i);
  if (!m) throw new Error(`StringHTMLRewriter: unsupported selector ${selector}`);
  const [, tag, attrName, attrValue] = m;

  if (tag === "title") {
    return html.replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title>)/i, (whole, open: string, inner: string, close: string) => {
      let next: string | null = `${open}${inner}${close}`;
      handlers.element({
        setAttribute: () => undefined,
        setInnerContent: (content) => {
          next = `${open}${content}${close}`;
        },
        remove: () => {
          next = null;
        },
      });
      return next ?? "";
    });
  }

  return html.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), (element) => {
    if (attrName && readAttr(element, attrName) !== attrValue) return element;
    let next: string | null = element;
    handlers.element({
      setAttribute: (name, value) => {
        const escaped = value.replace(/"/g, "&quot;");
        const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s/>]+)`, "i");
        next = re.test(next ?? "")
          ? (next ?? "").replace(re, `$1"${escaped}"`)
          : (next ?? "").replace(/\s*\/?>$/, ` ${name}="${escaped}" />`);
      },
      setInnerContent: () => undefined,
      remove: () => {
        next = null;
      },
    });
    return next ?? "";
  });
}

function readAttr(element: string, name: string): string | null {
  const a = element.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s/>]+))`, "i"));
  return a ? (a[2] ?? a[3] ?? a[4] ?? "") : null;
}

class ThrowingHTMLRewriter {
  on() {
    return this;
  }
  transform(): Response {
    throw new Error("simulated HTMLRewriter failure");
  }
}

/**
 * The <head> read of atlas-e2e `tests/og-seo-brand-isolation.e2e.spec.ts` (`parseHead`), reduced
 * to the fields asserted here: first `rel=` / `property=` wins, no JS, no entity decoding.
 */
function crawlerHead(html: string) {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html;
  const linkRel = new Map<string, string>();
  const metaProperty = new Map<string, string>();
  let canonicalLinks = 0;
  const tagRe = /<(meta|link)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(head)) != null) {
    const attrs = m[2];
    const get = (name: string) => readAttr(` ${attrs}`, name);
    if (m[1].toLowerCase() === "link") {
      const rel = get("rel");
      if (rel?.toLowerCase() === "canonical") canonicalLinks += 1;
      if (rel && !linkRel.has(rel.toLowerCase())) linkRel.set(rel.toLowerCase(), get("href") ?? "");
    } else {
      const property = get("property");
      if (property && !metaProperty.has(property.toLowerCase())) metaProperty.set(property.toLowerCase(), get("content") ?? "");
    }
  }
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? "";
  return {
    title,
    canonical: linkRel.get("canonical") ?? "",
    ogUrl: metaProperty.get("og:url") ?? "",
    ogTitle: metaProperty.get("og:title") ?? "",
    canonicalLinks,
  };
}

const WORKER_PROXY_SECRET = "test-worker-proxy-secret";

function htmlResponse(): Response {
  return new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function serve(
  url: string,
  opts: {
    env?: Record<string, string>;
    headers?: Record<string, string>;
    next?: () => Promise<Response>;
  } = {},
) {
  const response = await onRequest({
    request: new Request(url, { headers: opts.headers }),
    env: opts.env ?? { ATLAS_API_BASE_URL: "https://api.example.com", ATLAS_WORKER_PROXY_SECRET: WORKER_PROXY_SECRET },
    next: opts.next ?? (async () => htmlResponse()),
  });
  const body = await response.text();
  return { response, body, head: crawlerHead(body) };
}

function expectFrameProtected(response: Response) {
  expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect((response.headers.get("content-security-policy") ?? "").toLowerCase()).toMatch(/frame-ancestors\s+'none'/);
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  constructed.length = 0;
  fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("HTMLRewriter", StringHTMLRewriter);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("index.html ships one empty canonical + og:url for the edge and SEO.tsx to fill", () => {
  it("has exactly one canonical link and one og:url meta, both empty", () => {
    const head = crawlerHead(INDEX_HTML);
    expect(head.canonicalLinks).toBe(1);
    expect(head.canonical).toBe("");
    expect((INDEX_HTML.match(/property="og:url"/g) ?? []).length).toBe(1);
    expect(head.ogUrl).toBe("");
  });
});

describe("Atlas direct-booking hosts: canonical + og:url before JS (TASK-101940)", () => {
  it.each([
    ["https://atlashomestays.com/", "https://atlashomestays.com/"],
    ["https://dev.atlashomestays.com/", "https://dev.atlashomestays.com/"],
    ["https://qa.atlashomestays.com/", "https://qa.atlashomestays.com/"],
    ["http://localhost:8788/", "http://localhost:8788/"],
    ["http://127.0.0.1:8788/", "http://127.0.0.1:8788/"],
  ])("home %s → %s, satisfying the RA-006/AC-5 Atlas arm", async (url, expected) => {
    const { response, head } = await serve(url);

    expect(head.canonical).toBe(expected);
    expect(head.ogUrl).toBe(expected);
    expect(head.canonicalLinks).toBe(1);
    // The e2e arm's own two assertions, verbatim in meaning.
    expect(head.canonical).not.toEqual("");
    expect(new URL(head.canonical, url).host).toContain(new URL(url).host);
    // Atlas hosts never trigger the tenant-site-meta round-trip, and keep Atlas's own tags.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(head.title).toBe("Atlastays — Book direct with verified hosts");
    expectFrameProtected(response);
  });

  it("home drops the query string, as Home.tsx's `${getPublicSiteOrigin()}/` does after hydration", async () => {
    const { head } = await serve("https://qa.atlashomestays.com/?utm_source=whatsapp&ref=share");
    expect(head.canonical).toBe("https://qa.atlashomestays.com/");
    expect(head.ogUrl).toBe("https://qa.atlashomestays.com/");
  });

  it("property deep link keeps path + query, as the property page's `window.location.href` does", async () => {
    const url = "https://atlashomestays.com/homes/atlas-homes/1?checkin=2026-10-01&checkout=2026-10-03&guests=2";
    const { head } = await serve(url);
    expect(head.canonical).toBe(url);
    expect(head.ogUrl).toBe(url);
    expect(head.canonicalLinks).toBe(1);
  });

  it("property deep link on qa: canonical host is the qa host, never the apex", async () => {
    const { head } = await serve("https://qa.atlashomestays.com/homes/atlas-homes/2");
    expect(head.canonical).toBe("https://qa.atlashomestays.com/homes/atlas-homes/2");
  });

  it("uses VITE_PUBLIC_SITE_ORIGIN for home when configured, mirroring getPublicSiteOrigin()", async () => {
    const env = { ATLAS_API_BASE_URL: "https://api.example.com", VITE_PUBLIC_SITE_ORIGIN: "https://atlashomestays.com/" };
    expect((await serve("https://qa.atlashomestays.com/", { env })).head.canonical).toBe("https://atlashomestays.com/");
    // The property page reads window.location.href, not the configured origin.
    expect((await serve("https://qa.atlashomestays.com/homes/atlas-homes/2", { env })).head.canonical).toBe(
      "https://qa.atlashomestays.com/homes/atlas-homes/2",
    );
  });

  it.each([
    "https://qa.atlashomestays.com/search?city=goa&guests=2",
    "https://atlashomestays.com/faq",
    "https://atlashomestays.com/homestays-in-goa",
    "https://atlashomestays.com/blog/essential-guest-guide",
    "https://atlashomestays.com/homes/101",
    "https://atlashomestays.com/abc123",
  ])("leaves %s exactly as served (SEO.tsx sets no URL-derived canonical there)", async (url) => {
    const { body, response } = await serve(url);
    expect(body).toBe(INDEX_HTML);
    expect(constructed).toEqual([]);
    expectFrameProtected(response);
  });

  it.each([
    "https://atlashomes.in/",
    "https://www.atlashomes.in/homes/atlas-homes/1",
  ])("leaves duplicate alias host %s untouched (no self-canonical duplicate of the apex)", async (url) => {
    const { body } = await serve(url);
    expect(body).toBe(INDEX_HTML);
    expect(constructed).toEqual([]);
  });

  it("301s the www duplicate alias to the apex before any canonical rewrite runs (TASK-102420)", async () => {
    const { response, body } = await serve(
      "https://www.atlashomestays.com/homes/atlas-homes/1?checkin=2026-10-01",
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://atlashomestays.com/homes/atlas-homes/1?checkin=2026-10-01",
    );
    expect(body).toBe("");
    expect(constructed).toEqual([]);
  });

  it.each(["https://atlastays.com/", "https://www.atlastays.com/", "https://dev.atlastays.com/"])(
    "leaves marketplace host %s untouched (not an Atlas direct-booking host)",
    async (url) => {
      const { body } = await serve(url);
      expect(body).toBe(INDEX_HTML);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["text/plain; charset=utf-8", "https://qa.atlashomestays.com/robots.txt"],
    ["application/xml; charset=utf-8", "https://qa.atlashomestays.com/sitemap.xml"],
    ["application/json", "https://qa.atlashomestays.com/.well-known/atlas-runtime-config.json"],
    ["application/javascript", "https://qa.atlashomestays.com/assets/index-abc.js"],
  ])("never rewrites a non-HTML response (%s at %s)", async (contentType, url) => {
    const original = `payload for ${url}`;
    const { body, response } = await serve(url, {
      next: async () => new Response(original, { status: 200, headers: { "content-type": contentType } }),
    });
    expect(body).toBe(original);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(constructed).toEqual([]);
  });

  it("does not trust a Worker-forwarded Atlas host (the request URL is the Pages origin)", async () => {
    const { body } = await serve("https://atlas-guest-portal.pages.dev/", {
      headers: { "x-atlas-worker-proxy": WORKER_PROXY_SECRET, "x-forwarded-host": "qa.atlashomestays.com" },
    });
    expect(body).toBe(INDEX_HTML);
    expect(constructed).toEqual([]);
  });
});

describe("tenant hosts are unchanged (brand isolation)", () => {
  const customDomainMeta = {
    tenantSlug: "starguesthouse",
    propertyName: "Star Guest House",
    description: "Stay with Star Guest House.",
    photoUrl: "https://cdn.example.com/star.jpg",
    // Deliberately a DIFFERENT origin from the request host, so a request-derived Atlas
    // self-canonical is distinguishable from the tenant rewrite's own value.
    canonicalUrl: "https://www.starguesthouse.example/",
  };

  function metaFetch(meta: object) {
    fetchSpy = vi.fn(async () => new Response(JSON.stringify(meta), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
  }

  it.each([
    `https://star-home-${Date.now()}.example/`,
    `https://star-deep-${Date.now()}.example/homes/star-guest-house/7?checkin=2026-10-01`,
    `https://star-search-${Date.now()}.example/search?city=goa`,
  ])("custom domain %s: every tag is the tenant rewrite's value", async (url) => {
    metaFetch(customDomainMeta);
    const expected = buildMetaRewriteValues(customDomainMeta, url);

    const { head, response } = await serve(url);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(head.canonical).toBe(expected.canonical);
    expect(head.ogUrl).toBe(expected.url);
    expect(head.title).toBe("Star Guest House");
    expect(head.ogTitle).toBe("Star Guest House");
    expect(head.canonicalLinks).toBe(1);
    expect(head.canonical).not.toMatch(/atlashomestays|atlashomes\.in/i);
    expect(new URL(head.canonical).host).toBe("www.starguesthouse.example");
    expectFrameProtected(response);
  });

  it("white-label subdomain through the router Worker: canonical is the tenant's, never pages.dev or Atlas", async () => {
    metaFetch({ ...customDomainMeta, canonicalUrl: "https://starguesthouse.atlastays.com/" });
    const publicHost = `wl-${Date.now()}.atlastays.com`;

    const { head } = await serve("https://atlas-guest-portal.pages.dev/homes/star-guest-house/7", {
      headers: { "x-atlas-worker-proxy": WORKER_PROXY_SECRET, "x-forwarded-host": publicHost },
    });

    expect(fetchSpy.mock.calls[0][0]).toContain(encodeURIComponent(publicHost));
    expect(head.canonical).toBe("https://starguesthouse.atlastays.com/homes/star-guest-house/7");
    expect(head.ogUrl).toBe("https://starguesthouse.atlastays.com/homes/star-guest-house/7");
    expect(head.title).toBe("Star Guest House");
  });

  it.each([
    `https://unresolved-${Date.now()}.example/`,
    `https://qa.atlashomestays.com.lookalike-${Date.now()}.example/`,
    `https://atlashomestays-${Date.now()}.example/homes/atlas-homes/1`,
  ])("tenant-eligible host %s with no tenant meta is served byte-identical (never Atlas-canonicalised)", async (url) => {
    const { body, head } = await serve(url);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(body).toBe(INDEX_HTML);
    expect(head.canonical).toBe("");
  });
});

describe("Atlas canonical rewrite: FAIL-OPEN", () => {
  it("serves the original response when HTMLRewriter.transform() throws", async () => {
    vi.stubGlobal("HTMLRewriter", ThrowingHTMLRewriter);
    const { body, response } = await serve("https://qa.atlashomestays.com/");
    expect(body).toBe(INDEX_HTML);
    expect(response.status).toBe(200);
    expectFrameProtected(response);
  });

  it("serves the original response when the HTMLRewriter global is absent", async () => {
    vi.stubGlobal("HTMLRewriter", undefined);
    const { body, response } = await serve("https://atlashomestays.com/homes/atlas-homes/1");
    expect(body).toBe(INDEX_HTML);
    expect(response.status).toBe(200);
    expectFrameProtected(response);
  });
});
