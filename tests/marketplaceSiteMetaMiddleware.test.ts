import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onRequest } from "../functions/_middleware";

class FakeHTMLRewriter {
  private handlers: Array<{ selector: string; handlers: { element(el: unknown): void } }> = [];

  on(selector: string, handlers: { element(el: unknown): void }) {
    this.handlers.push({ selector, handlers });
    return this;
  }

  transform(response: Response) {
    const appliedAttrs: Record<string, string> = {};
    const innerContents: Record<string, string> = {};
    const appended: Record<string, string[]> = {};
    const afterContent: Record<string, string[]> = {};

    for (const { selector, handlers } of this.handlers) {
      const el = {
        setAttribute: (name: string, value: string) => {
          appliedAttrs[`${selector}::${name}`] = value;
        },
        setInnerContent: (content: string) => {
          innerContents[selector] = content;
        },
        append: (content: string) => {
          appended[selector] = appended[selector] || [];
          appended[selector].push(content);
        },
        after: (content: string) => {
          afterContent[selector] = afterContent[selector] || [];
          afterContent[selector].push(content);
        },
      };
      handlers.element(el);
    }

    return new Response(
      JSON.stringify({ appliedAttrs, innerContents, appended, afterContent }),
      {
        status: response.status,
        headers: { "content-type": "application/json", "x-fake-rewritten": "true" },
      },
    );
  }
}

function makeHtmlResponse(): Response {
  return new Response(
    "<!doctype html><html><head><title>Atlastays</title><link rel='canonical' href='' /></head><body></body></html>",
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

describe("marketplaceSiteMetaMiddleware (MKT-013)", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rewrites head tags on marketplace host for homepage /", async () => {
    const request = new Request("https://atlastays.com/", {
      headers: { Accept: "text/html" },
    });
    const env = {
      ATLAS_API_BASE_URL: "https://api.test.in",
    };

    const res = await onRequest({
      request,
      env,
      next: async () => makeHtmlResponse(),
    });

    expect(res.headers.get("x-fake-rewritten")).toBe("true");
    const body = (await res.json()) as {
      appliedAttrs: Record<string, string>;
      innerContents: Record<string, string>;
    };

    expect(body.innerContents["title"]).toBe("Atlastays — Book Homestays Directly with Verified Owners");
    expect(body.appliedAttrs['link[rel="canonical"]::href']).toBe("https://atlastays.com/");
    expect(body.appliedAttrs['meta[property="og:url"]::content']).toBe("https://atlastays.com/");
    expect(body.appliedAttrs['meta[property="og:image"]::content']).toBe("https://atlastays.com/icons/logo512.png");
  });

  it("rewrites head tags on marketplace host for city landing /homestays-in-bengaluru", async () => {
    const request = new Request("https://atlastays.com/homestays-in-bengaluru", {
      headers: { Accept: "text/html" },
    });
    const env = {
      ATLAS_API_BASE_URL: "https://api.test.in",
    };

    const res = await onRequest({
      request,
      env,
      next: async () => makeHtmlResponse(),
    });

    expect(res.headers.get("x-fake-rewritten")).toBe("true");
    const body = (await res.json()) as {
      appliedAttrs: Record<string, string>;
      innerContents: Record<string, string>;
    };

    expect(body.innerContents["title"]).toContain("Bengaluru");
    expect(body.appliedAttrs['link[rel="canonical"]::href']).toBe("https://atlastays.com/homestays-in-bengaluru");
    expect(body.appliedAttrs['meta[property="og:url"]::content']).toBe("https://atlastays.com/homestays-in-bengaluru");
    expect(body.appliedAttrs['meta[property="og:image"]::content']).toBe("https://atlastays.com/icons/logo512.png");
  });

  it("rewrites head tags and injects LodgingBusiness JSON-LD on marketplace host for /homes/*", async () => {
    const mockListings = [
      {
        id: 676,
        title: "The Estate by Grove & Co.",
        city: "Hyderabad",
        coverPhotoUrl: "https://imagedelivery.net/abc/hero.jpg",
        tenantSlug: "grove-and-co",
        pricePerNight: 15000,
      },
    ];

    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockListings }),
    });
    vi.stubGlobal("fetch", globalFetch);

    const request = new Request(
      "https://atlastays.com/homes/the-estate-by-grove-co/676?tenant=grove-and-co",
      { headers: { Accept: "text/html" } },
    );
    const env = {
      ATLAS_API_BASE_URL: "https://api.test.in",
    };

    const res = await onRequest({
      request,
      env,
      next: async () => makeHtmlResponse(),
    });

    expect(res.headers.get("x-fake-rewritten")).toBe("true");
    const body = (await res.json()) as {
      appliedAttrs: Record<string, string>;
      innerContents: Record<string, string>;
      appended: Record<string, string[]>;
    };

    expect(body.innerContents["title"]).toContain("The Estate by Grove & Co.");
    expect(body.appliedAttrs['link[rel="canonical"]::href']).toBe(
      "https://atlastays.com/homes/the-estate-by-grove-co/676?tenant=grove-and-co",
    );
    expect(body.appliedAttrs['meta[property="og:image"]::content']).toBe("https://imagedelivery.net/abc/hero.jpg");

    // Check JSON-LD injection
    const headAppended = body.appended["head"] || [];
    expect(headAppended.some((s) => s.includes("LodgingBusiness") && s.includes("The Estate by Grove & Co."))).toBe(true);
  });

  it("fails open if HTMLRewriter throws", async () => {
    class ThrowingHTMLRewriter {
      on() {
        return this;
      }
      transform(): Response {
        throw new Error("simulated failure");
      }
    }
    vi.stubGlobal("HTMLRewriter", ThrowingHTMLRewriter);

    const request = new Request("https://atlastays.com/homestays-in-goa", {
      headers: { Accept: "text/html" },
    });
    const env = {
      ATLAS_API_BASE_URL: "https://api.test.in",
    };

    const res = await onRequest({
      request,
      env,
      next: async () => makeHtmlResponse(),
    });

    // Should return original framed response, not throw a 500
    expect(res.status).toBe(200);
    expect(res.headers.get("x-fake-rewritten")).toBeNull();
  });
});
