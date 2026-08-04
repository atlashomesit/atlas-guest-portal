/**
 * Regression cover for the `tenantKey` emitted by the /.well-known/atlas-runtime-config.json
 * Pages Function. The Function used to GUESS the slug from the subdomain label, which emitted a
 * slug that 404s for any tenant whose subdomain differs from its slug (the live case:
 * millionairesmansion.atlastays.com -> guessed `millionairesmansion`, real slug `mahesh-wagh`).
 *
 * Lives under tests/ rather than next to the Function because vitest.config.ts only scans
 * ["src", "tests"] — a test file under functions/ is never collected (functions/sitemap.xml.test.ts
 * is silently uncollected for exactly this reason).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { onRequestGet } from "../functions/.well-known/atlas-runtime-config.json";
import { _resetTenantSlugCacheForTests } from "../functions/_lib/tenantSlug";

const API = "https://api.example.com";

type FetchArgs = Parameters<typeof fetch>;

/** Stubs global fetch to answer /tenants/from-domain for the hosts in `slugByHost`. */
function stubFromDomain(slugByHost: Record<string, string>, status = 404) {
  const spy = vi.fn(async (input: FetchArgs[0]) => {
    const href = String(input);
    const domain = new URL(href).searchParams.get("domain") ?? "";
    const slug = slugByHost[domain];
    if (!slug) return new Response("{}", { status });
    return new Response(JSON.stringify({ tenantSlug: slug }), { status: 200 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function getConfig(host: string, env: Record<string, string> = {}) {
  const res = await onRequestGet({
    env: { ATLAS_API_BASE_URL: API, ...env },
    request: new Request(`https://${host}/.well-known/atlas-runtime-config.json`),
  });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  _resetTenantSlugCacheForTests();
  vi.unstubAllGlobals();
});

describe("atlas-runtime-config tenantKey", () => {
  it("emits the authoritative slug, not the subdomain label", async () => {
    stubFromDomain({ "millionairesmansion.atlastays.com": "mahesh-wagh" });

    const { body } = await getConfig("millionairesmansion.atlastays.com");

    expect(body.tenantKey).toBe("mahesh-wagh");
    expect(body.tenantKey).not.toBe("millionairesmansion");
  });

  it("omits tenantKey for an unresolvable third-party host rather than defaulting to atlas", async () => {
    stubFromDomain({});

    const { body } = await getConfig("someone-elses-domain.com");

    // Emitting "atlas" here would render Atlas branding on a stranger's domain.
    expect(body).not.toHaveProperty("tenantKey");
  });

  it("falls back to ATLAS_TENANT_KEY when the API cannot resolve the host", async () => {
    stubFromDomain({});

    const { body } = await getConfig("staging-preview.pages.dev", {
      ATLAS_TENANT_KEY: "mahesh-wagh",
    });

    expect(body.tenantKey).toBe("mahesh-wagh");
  });

  it("keeps the marketplace sentinel for the apex and never calls the API", async () => {
    const spy = stubFromDomain({});

    const { body } = await getConfig("atlastays.com");

    expect(body.tenantKey).toBe("marketplace");
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps atlas for Atlas's own direct-booking hosts without an API call", async () => {
    const spy = stubFromDomain({});

    const { body } = await getConfig("atlashomestays.com");

    expect(body.tenantKey).toBe("atlas");
    expect(spy).not.toHaveBeenCalled();
  });

  it("caches a resolved slug so repeat config fetches cost one API call", async () => {
    const spy = stubFromDomain({ "millionairesmansion.atlastays.com": "mahesh-wagh" });

    await getConfig("millionairesmansion.atlastays.com");
    const { body } = await getConfig("millionairesmansion.atlastays.com");

    expect(body.tenantKey).toBe("mahesh-wagh");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not cache a transient upstream failure as 'no tenant'", async () => {
    // First call: API is down (500). Second: recovered.
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? new Response("boom", { status: 500 })
          : new Response(JSON.stringify({ tenantSlug: "mahesh-wagh" }), { status: 200 });
      }),
    );

    const first = await getConfig("millionairesmansion.atlastays.com");
    expect(first.body).not.toHaveProperty("tenantKey");

    const second = await getConfig("millionairesmansion.atlastays.com");
    expect(second.body.tenantKey).toBe("mahesh-wagh");
  });

  it("still 500s when ATLAS_API_BASE_URL is unset", async () => {
    const res = await onRequestGet({
      env: {},
      request: new Request("https://millionairesmansion.atlastays.com/.well-known/atlas-runtime-config.json"),
    });

    expect(res.status).toBe(500);
  });
});
