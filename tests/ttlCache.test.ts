import { TtlCache } from "../functions/_lib/ttlCache";

describe("TtlCache (TASK-4905)", () => {
  it("returns undefined for a key that was never set", () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("returns the stored value before expiry", () => {
    const cache = new TtlCache<string>(5000);
    cache.set("host-a", "value-a", 1000);
    expect(cache.get("host-a", 1000)).toBe("value-a");
    expect(cache.get("host-a", 5999)).toBe("value-a"); // still within TTL window
  });

  it("expires and evicts the entry once the TTL elapses", () => {
    const cache = new TtlCache<string>(5000);
    cache.set("host-a", "value-a", 1000);

    expect(cache.get("host-a", 6001)).toBeUndefined(); // 1000 + 5000 = 6000, so 6001 is expired
    expect(cache.size()).toBe(0); // eviction on read
  });

  it("caches a null value distinctly from a cache miss", () => {
    const cache = new TtlCache<string | null>(5000);
    cache.set("unresolved-host", null, 0);

    // get() returns `undefined` only for a true miss; a cached `null` comes back as `null`.
    expect(cache.get("unresolved-host", 100)).toBeNull();
  });

  it("keeps distinct keys independent", () => {
    const cache = new TtlCache<string>(5000);
    cache.set("a", "value-a", 0);
    cache.set("b", "value-b", 0);

    expect(cache.get("a", 100)).toBe("value-a");
    expect(cache.get("b", 100)).toBe("value-b");
  });

  it("overwrites an existing key's value and TTL window", () => {
    const cache = new TtlCache<string>(5000);
    cache.set("host-a", "first", 0);
    cache.set("host-a", "second", 1000);

    expect(cache.get("host-a", 1500)).toBe("second");
  });

  it("evicts oldest entries once maxEntries is reached (TASK-7207)", () => {
    const cache = new TtlCache<string>(60_000, 3);
    cache.set("a", "1", 0);
    cache.set("b", "2", 0);
    cache.set("c", "3", 0);
    expect(cache.size()).toBe(3);

    cache.set("d", "4", 0);
    expect(cache.size()).toBe(3);
    expect(cache.get("a", 0)).toBeUndefined();
    expect(cache.get("d", 0)).toBe("4");
  });
});
