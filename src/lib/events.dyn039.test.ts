import { afterEach, describe, expect, test, vi } from "vitest";
import { track } from "./events";

describe("DYN-039 track funnel event with checkIn/checkOut and tenantSlug", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  test("posts checkIn/checkOut and tenant header when supplied", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    track("select_dates", 42, { checkIn: "2030-06-10", checkOut: "2030-06-12", tenantSlug: "hillstay" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/funnel-events");
    const body = JSON.parse(String(init.body));
    expect(body.eventName).toBe("select_dates");
    expect(body.listingId).toBe(42);
    expect(body.checkIn).toBe("2030-06-10");
    expect(body.checkOut).toBe("2030-06-12");
  });

  test("omits checkIn/checkOut when either date is absent", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    track("view_listing", 42);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.checkIn).toBeUndefined();
    expect(body.checkOut).toBeUndefined();
  });
});
