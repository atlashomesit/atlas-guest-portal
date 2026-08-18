import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDedupedJsonFetchForTests, dedupedJsonFetch } from "./dedupedJsonFetch";

describe("dedupedJsonFetch (TASK-7824)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    _resetDedupedJsonFetchForTests();
  });

  afterEach(() => {
    _resetDedupedJsonFetchForTests();
    vi.unstubAllGlobals();
  });

  it("shares one GET across concurrent callers of the same URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 2 }),
    });

    const [a, b] = await Promise.all([
      dedupedJsonFetch("https://api.test/listings/2"),
      dedupedJsonFetch("https://api.test/listings/2"),
    ]);

    expect(a.body).toEqual({ id: 2 });
    expect(b.body).toEqual({ id: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not abort the shared GET when one caller signal aborts", async () => {
    let resolveFetch: (value: {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const ac = new AbortController();
    const aborted = dedupedJsonFetch("https://api.test/listings/2", { signal: ac.signal });
    const kept = dedupedJsonFetch("https://api.test/listings/2");

    ac.abort();
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: 2 }),
    });

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    await expect(kept).resolves.toMatchObject({ ok: true, body: { id: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });
});
