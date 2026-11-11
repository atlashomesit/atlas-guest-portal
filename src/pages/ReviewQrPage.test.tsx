/** @vitest-environment jsdom */

/**
 * REV-046 (founder ruling 2026-10-28): the review-QR page, `/rate/:tenantSlug/:code`.
 *
 * The rule under test is "catch first, Google open to every guest": 1-3 stars get the private form AND a
 * readable Google link on the same screen before anything is sent; 4-5 stars get the big Google button first,
 * then an optional website note. The page must never become a screen with no route to Google.
 */

import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewQrPage from "./ReviewQrPage";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

vi.mock("../api/client", () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: (tenant?: string | null) => (tenant ? { "X-Tenant-Slug": tenant } : {}),
}));

const TENANT = "coorg-resort";
const CODE = "ABCD2345WXYZ";
const GOOGLE_URL = "https://g.page/r/coorg-resort/review";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROOMS = [
  { listingId: 11, name: "Villa 101" },
  { listingId: 12, name: "Villa 102" },
];

const qrConfig = (overrides: Record<string, unknown> = {}) => ({
  code: CODE,
  propertyId: 7,
  propertyName: "Coorg Plantation Resort",
  listingId: null,
  listingName: null,
  rooms: [],
  hasGoogleReviewLink: true,
  googleReviewUrl: GOOGLE_URL,
  ...overrides,
});

const submitResult = (overrides: Record<string, unknown> = {}) => ({
  hasGoogleReviewLink: true,
  googleReviewUrl: GOOGLE_URL,
  savedPrivately: false,
  showsOnWebsite: false,
  ...overrides,
});

interface ApiCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

interface ApiState {
  config: unknown;
  getStatus: number;
  postStatus: number;
  postBody: unknown;
  postNetworkError: boolean;
}

function stubApi(initial: Partial<ApiState> = {}) {
  const state: ApiState = {
    config: qrConfig(),
    getStatus: 200,
    postStatus: 200,
    postBody: submitResult(),
    postNetworkError: false,
    ...initial,
  };
  const calls: ApiCall[] = [];
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({
        method,
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
      });
      if (!url.startsWith("https://api.example.test/api/public/review-qr/")) {
        throw new Error(`Unexpected fetch: ${url}`);
      }
      if (method === "GET") return respond(state.getStatus, state.getStatus === 200 ? state.config : {});
      if (state.postNetworkError) throw new TypeError("Failed to fetch");
      return respond(state.postStatus, state.postBody);
    }),
  );

  return {
    state,
    calls,
    posts: () => calls.filter((call) => call.method === "POST"),
    gets: () => calls.filter((call) => call.method === "GET"),
  };
}

const flush = async () => {
  await settle();
  await settle();
};

function renderPage(path = `/rate/${TENANT}/${CODE}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/rate/:tenantSlug/:code" element={<ReviewQrPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openPage(initial: Partial<ApiState> = {}) {
  const api = stubApi(initial);
  renderPage();
  await flush();
  return api;
}

const star = (value: number) => screen.getByTestId(`review-qr-star-${value}`);

async function pickStar(value: number) {
  fireEvent.click(star(value));
  await flush();
}

/**
 * Click an anchor the way a browser would, and report whether anything cancelled it. The listener sits on
 * `document`, above React's root, so it sees the event after the page's own handlers have run; it then cancels
 * the click so jsdom does not try to navigate.
 */
function tapAnchor(anchor: HTMLElement) {
  let defaultPrevented = false;
  const guard = (event: Event) => {
    defaultPrevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", guard);
  fireEvent.click(anchor);
  document.removeEventListener("click", guard);
  return { defaultPrevented };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReviewQrPage — load (REV-046)", () => {
  it("asks for the code with the tenant header and shows the property, the question and five stars", async () => {
    const api = await openPage();

    expect(api.gets()).toHaveLength(1);
    expect(api.gets()[0].url).toBe(`https://api.example.test/api/public/review-qr/${CODE}`);
    expect(api.gets()[0].headers).toMatchObject({ "X-Tenant-Slug": TENANT });

    expect(screen.getByTestId("review-qr-page")).toBeInTheDocument();
    expect(screen.getByTestId("review-qr-property")).toHaveTextContent("Coorg Plantation Resort");
    expect(screen.getByRole("heading", { level: 1, name: "How was your stay?" })).toBeInTheDocument();
    for (const value of [1, 2, 3, 4, 5]) expect(star(value)).toBeInTheDocument();

    // Nothing to fill in or sent until a star is chosen.
    expect(screen.queryByTestId("review-qr-low-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-note")).not.toBeInTheDocument();
    expect(api.posts()).toHaveLength(0);
  });

  it("adds the room name for a room code", async () => {
    await openPage({ config: qrConfig({ listingId: 11, listingName: "Villa 101" }) });
    expect(screen.getByTestId("review-qr-property")).toHaveTextContent("Coorg Plantation Resort · Villa 101");
  });

  it("shows the inactive page for an unknown or switched-off code (404)", async () => {
    await openPage({ getStatus: 404 });

    expect(screen.getByTestId("review-qr-inactive")).toHaveTextContent(
      "This review code is not active. Please ask the front desk.",
    );
    expect(screen.getByTestId("review-qr-page")).toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-star-5")).not.toBeInTheDocument();
  });

  it("shows a short retry message when the page cannot load, and Try again loads it", async () => {
    const api = await openPage({ getStatus: 503 });

    const failed = screen.getByTestId("review-qr-load-error");
    expect(failed).toHaveTextContent("We couldn't load this page just now");
    expect(screen.queryByTestId("review-qr-inactive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-star-5")).not.toBeInTheDocument();

    api.state.getStatus = 200;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flush();

    expect(api.gets()).toHaveLength(2);
    expect(star(5)).toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-load-error")).not.toBeInTheDocument();
  });

  it("shows the retry message when the network is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    renderPage();
    await flush();
    expect(screen.getByTestId("review-qr-load-error")).toBeInTheDocument();
  });
});

describe("ReviewQrPage — 1-3 stars: catch first, Google still open", () => {
  it.each([1, 2, 3])(
    "%i stars: shows the private form AND a readable Google link before anything is sent",
    async (value) => {
      const api = await openPage();
      await pickStar(value);

      expect(star(value)).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Sorry your stay wasn't perfect.")).toBeInTheDocument();
      expect(screen.getByText("Tell us what went wrong — the owner will contact you.")).toBeInTheDocument();

      const form = screen.getByTestId("review-qr-low-form");
      expect(form).toBeVisible();
      expect(screen.getByLabelText("What went wrong?")).toBe(screen.getByTestId("review-qr-comment"));
      expect(
        screen.getByLabelText("Your phone number (optional) — so the owner can call you back"),
      ).toBe(screen.getByTestId("review-qr-phone"));
      expect(screen.getByTestId("review-qr-phone")).toHaveAttribute("type", "tel");
      expect(screen.getByLabelText("Your name (optional)")).toBe(screen.getByTestId("review-qr-name"));
      expect(screen.getByTestId("review-qr-send")).toHaveTextContent("Send to the owner");

      // The Google link: in the open, on the same screen, nothing sent yet.
      const link = screen.getByTestId("review-qr-google-link");
      expect(link).toBeVisible();
      expect(link).toHaveTextContent("Post a public review on Google");
      expect(link).toHaveAttribute("href", GOOGLE_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.closest("details")).toBeNull();
      expect(link.closest("[hidden]")).toBeNull();
      expect(link.closest("[aria-hidden='true']")).toBeNull();
      expect(link).not.toBeDisabled();

      // 4-5 star furniture stays away, and nothing has been posted.
      expect(screen.queryByTestId("review-qr-google-cta")).not.toBeInTheDocument();
      expect(screen.queryByTestId("review-qr-note")).not.toBeInTheDocument();
      expect(api.posts()).toHaveLength(0);
    },
  );

  it("a Google tap saves the rating and what is typed so far, and does not hold the link back", async () => {
    const api = await openPage();
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "  The geyser was broken  " } });
    fireEvent.change(screen.getByTestId("review-qr-phone"), { target: { value: " 9876543210 " } });

    const tap = tapAnchor(screen.getByTestId("review-qr-google-link"));
    // Not cancelled: the browser still opens Google in its new tab, whatever the save does.
    expect(tap.defaultPrevented).toBe(false);
    await flush();

    expect(api.posts()).toHaveLength(1);
    expect(api.posts()[0].url).toBe(`https://api.example.test/api/public/review-qr/${CODE}`);
    expect(api.posts()[0].headers).toMatchObject({ "X-Tenant-Slug": TENANT, "Content-Type": "application/json" });
    expect(api.posts()[0].body).toEqual({
      clientSubmissionId: expect.stringMatching(UUID_V4),
      rating: 2,
      comment: "The geyser was broken",
      guestPhone: "9876543210",
    });
    // Tapping Google is not "sending": the guest is still on the form.
    expect(screen.getByTestId("review-qr-low-form")).toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-thanks")).not.toBeInTheDocument();
  });

  it("opens Google even when saving fails, and says so once the guest is back", async () => {
    const api = await openPage({ postNetworkError: true });
    await pickStar(1);

    const tap = tapAnchor(screen.getByTestId("review-qr-google-link"));
    expect(tap.defaultPrevented).toBe(false);
    await flush();

    expect(api.posts()).toHaveLength(1);
    expect(screen.getByTestId("review-qr-error")).toHaveTextContent("We couldn't send that just now");
  });

  it("Send to the owner posts comment, phone, name and room, then thanks the guest and keeps the Google link", async () => {
    const api = await openPage({
      config: qrConfig({ rooms: ROOMS }),
      postBody: submitResult({ savedPrivately: true }),
    });
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-room-select"), { target: { value: "12" } });
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "The AC was loud all night" } });
    fireEvent.change(screen.getByTestId("review-qr-phone"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByTestId("review-qr-name"), { target: { value: "Asha Rao" } });

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(api.posts()).toHaveLength(1);
    expect(api.posts()[0].body).toEqual({
      clientSubmissionId: expect.stringMatching(UUID_V4),
      rating: 2,
      roomListingId: 12,
      comment: "The AC was loud all night",
      guestName: "Asha Rao",
      guestPhone: "9876543210",
    });

    expect(screen.getByTestId("review-qr-thanks")).toHaveTextContent(
      "Thank you. The owner has your feedback and will contact you.",
    );
    expect(screen.queryByTestId("review-qr-low-form")).not.toBeInTheDocument();
    // Still one tap from Google after sending.
    const link = screen.getByTestId("review-qr-google-link");
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", GOOGLE_URL);
    // The answer is in: the stars no longer change it.
    expect(star(5)).toBeDisabled();
  });

  it("asks for something to send before posting", async () => {
    const api = await openPage();
    await pickStar(3);

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(api.posts()).toHaveLength(0);
    expect(screen.getByTestId("review-qr-error")).toHaveTextContent("Please tell us what went wrong");
    expect(screen.queryByTestId("review-qr-thanks")).not.toBeInTheDocument();
  });

  it("accepts a phone number alone, so the owner can call the guest back", async () => {
    const api = await openPage();
    await pickStar(1);
    fireEvent.change(screen.getByTestId("review-qr-phone"), { target: { value: "9876543210" } });

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(api.posts()[0].body).toEqual({
      clientSubmissionId: expect.stringMatching(UUID_V4),
      rating: 1,
      guestPhone: "9876543210",
    });
    expect(screen.getByTestId("review-qr-thanks")).toBeInTheDocument();
  });

  it("keeps everything the guest typed when sending fails, and lets them try again", async () => {
    const api = await openPage({ postNetworkError: true });
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "No hot water" } });
    fireEvent.change(screen.getByTestId("review-qr-phone"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByTestId("review-qr-name"), { target: { value: "Asha" } });

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(screen.getByTestId("review-qr-error")).toHaveTextContent("We couldn't send that just now");
    expect(screen.getByTestId("review-qr-comment")).toHaveValue("No hot water");
    expect(screen.getByTestId("review-qr-phone")).toHaveValue("9876543210");
    expect(screen.getByTestId("review-qr-name")).toHaveValue("Asha");
    expect(screen.getByTestId("review-qr-send")).toBeEnabled();
    expect(screen.queryByTestId("review-qr-thanks")).not.toBeInTheDocument();
    // The Google link is still there for a guest whose message did not go through.
    expect(screen.getByTestId("review-qr-google-link")).toBeVisible();

    api.state.postNetworkError = false;
    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(api.posts()).toHaveLength(2);
    expect(api.posts()[1].body).toMatchObject({ comment: "No hot water", guestPhone: "9876543210" });
    expect(screen.getByTestId("review-qr-thanks")).toBeInTheDocument();
  });

  it("treats a server error on send like a lost connection and keeps the text", async () => {
    await openPage({ postStatus: 503, postBody: {} });
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "Noisy road" } });

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(screen.getByTestId("review-qr-error")).toBeInTheDocument();
    expect(screen.getByTestId("review-qr-comment")).toHaveValue("Noisy road");
  });

  it("shows the inactive page if the code is switched off before the guest sends", async () => {
    await openPage({ postStatus: 404, postBody: {} });
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "Noisy road" } });

    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();

    expect(screen.getByTestId("review-qr-inactive")).toBeInTheDocument();
  });
});

describe("ReviewQrPage — 4-5 stars: Google first, then an optional website note", () => {
  it.each([4, 5])("%i stars: the big Google button, then the optional note, and no private form", async (value) => {
    const api = await openPage();
    await pickStar(value);

    expect(screen.getByRole("heading", { name: "Thank you!" })).toBeInTheDocument();

    const cta = screen.getByTestId("review-qr-google-cta");
    expect(cta).toBeVisible();
    expect(cta).toHaveTextContent("Post on Google");
    expect(cta).toHaveAttribute("href", GOOGLE_URL);
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");

    const note = screen.getByTestId("review-qr-note");
    expect(screen.getByLabelText("Leave a note on our website too (optional)")).toBe(note);
    expect(screen.getByLabelText("Your name (optional)")).toBe(screen.getByTestId("review-qr-name"));
    expect(screen.getByTestId("review-qr-note-submit")).toHaveTextContent("Post note");
    // Google comes first, the note after it.
    expect(cta.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByTestId("review-qr-low-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-phone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-google-link")).not.toBeInTheDocument();
    expect(api.posts()).toHaveLength(0);
  });

  it("a Google tap posts just the rating and opens the link", async () => {
    const api = await openPage();
    await pickStar(5);

    const tap = tapAnchor(screen.getByTestId("review-qr-google-cta"));
    expect(tap.defaultPrevented).toBe(false);
    await flush();

    expect(api.posts()).toHaveLength(1);
    expect(api.posts()[0].body).toEqual({ clientSubmissionId: expect.stringMatching(UUID_V4), rating: 5 });
    // Still on the page, note box still there.
    expect(screen.getByTestId("review-qr-note")).toBeInTheDocument();
  });

  it("Post note sends the rating, the note and the first name, then says it will appear on the website", async () => {
    const api = await openPage({ postBody: submitResult({ showsOnWebsite: true }) });
    await pickStar(5);
    fireEvent.change(screen.getByTestId("review-qr-note"), { target: { value: "Lovely garden breakfast" } });
    fireEvent.change(screen.getByTestId("review-qr-name"), { target: { value: "Asha" } });

    fireEvent.click(screen.getByTestId("review-qr-note-submit"));
    await flush();

    expect(api.posts()).toHaveLength(1);
    expect(api.posts()[0].body).toEqual({
      clientSubmissionId: expect.stringMatching(UUID_V4),
      rating: 5,
      comment: "Lovely garden breakfast",
      guestName: "Asha",
    });
    expect(screen.getByTestId("review-qr-thanks")).toHaveTextContent("Thanks! Your note will appear on our website.");
    expect(screen.queryByTestId("review-qr-note")).not.toBeInTheDocument();
    // The Google button stays after the note.
    expect(screen.getByTestId("review-qr-google-cta")).toBeVisible();
  });

  it("does not promise the website when the server says the note will not show", async () => {
    await openPage({ postBody: submitResult({ showsOnWebsite: false }) });
    await pickStar(4);
    fireEvent.change(screen.getByTestId("review-qr-note"), { target: { value: "Nice stay" } });

    fireEvent.click(screen.getByTestId("review-qr-note-submit"));
    await flush();

    const thanks = screen.getByTestId("review-qr-thanks");
    expect(thanks).toHaveTextContent("Thanks! The owner has your note.");
    expect(thanks).not.toHaveTextContent("website");
  });

  it("asks for a note before posting one", async () => {
    const api = await openPage();
    await pickStar(5);

    fireEvent.click(screen.getByTestId("review-qr-note-submit"));
    await flush();

    expect(api.posts()).toHaveLength(0);
    expect(screen.getByTestId("review-qr-error")).toHaveTextContent("Please write a short note first.");
  });

  it("keeps the note when posting fails", async () => {
    await openPage({ postNetworkError: true });
    await pickStar(5);
    fireEvent.change(screen.getByTestId("review-qr-note"), { target: { value: "Lovely garden breakfast" } });

    fireEvent.click(screen.getByTestId("review-qr-note-submit"));
    await flush();

    expect(screen.getByTestId("review-qr-error")).toBeInTheDocument();
    expect(screen.getByTestId("review-qr-note")).toHaveValue("Lovely garden breakfast");
    expect(screen.queryByTestId("review-qr-thanks")).not.toBeInTheDocument();
  });
});

describe("ReviewQrPage — no Google link saved", () => {
  it("1-3 stars: the private form works without a Google link", async () => {
    await openPage({ config: qrConfig({ hasGoogleReviewLink: false, googleReviewUrl: null }) });
    await pickStar(2);

    expect(screen.getByTestId("review-qr-low-form")).toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-google-link")).not.toBeInTheDocument();
  });

  it("4-5 stars: only the note box", async () => {
    await openPage({ config: qrConfig({ hasGoogleReviewLink: false, googleReviewUrl: null }) });
    await pickStar(5);

    expect(screen.queryByTestId("review-qr-google-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-qr-google-link")).not.toBeInTheDocument();
    expect(screen.getByTestId("review-qr-note")).toBeInTheDocument();
    expect(screen.getByTestId("review-qr-note-submit")).toBeInTheDocument();
  });

  it("never puts a non-http link in the page", async () => {
    await openPage({ config: qrConfig({ googleReviewUrl: "javascript:alert(1)" }) });
    await pickStar(2);
    expect(screen.queryByTestId("review-qr-google-link")).not.toBeInTheDocument();
  });
});

describe("ReviewQrPage — room picker", () => {
  it.each([
    ["no rooms (a room code)", []],
    ["one room", [ROOMS[0]]],
  ])("is not shown for %s", async (_label, rooms) => {
    await openPage({ config: qrConfig({ rooms }) });
    await pickStar(2);
    expect(screen.queryByTestId("review-qr-room-select")).not.toBeInTheDocument();
  });

  it("is an optional select when the property has two or more rooms, and its value is sent as roomListingId", async () => {
    const api = await openPage({ config: qrConfig({ rooms: ROOMS }) });

    const select = screen.getByTestId("review-qr-room-select");
    expect(screen.getByLabelText("Which room did you stay in? (optional)")).toBe(select);
    expect(select).toHaveValue("");
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      "Choose a room",
      "Villa 101",
      "Villa 102",
    ]);

    // Skipping it is fine: nothing about a room is sent.
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()[0].body).not.toHaveProperty("roomListingId");

    fireEvent.change(select, { target: { value: "11" } });
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()[1].body).toMatchObject({ rating: 5, roomListingId: 11 });
  });
});

describe("ReviewQrPage — one clientSubmissionId per page load", () => {
  it("reuses it for every POST, and a changed star re-posts it", async () => {
    const api = await openPage();

    // 1. a Google tap at 5 stars
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()).toHaveLength(1);

    // 2. the guest changes the star: the same row is updated
    await pickStar(2);
    expect(api.posts()).toHaveLength(2);
    expect(api.posts()[1].body).toEqual({ clientSubmissionId: api.posts()[0].body?.clientSubmissionId, rating: 2 });

    // 3. then sends a complaint
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "Cold shower" } });
    fireEvent.click(screen.getByTestId("review-qr-send"));
    await flush();
    expect(api.posts()).toHaveLength(3);
    expect(api.posts()[2].body).toMatchObject({ rating: 2, comment: "Cold shower" });

    const ids = new Set(api.posts().map((post) => post.body?.clientSubmissionId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(UUID_V4);
  });

  it("after a save that did not go through, a changed star tries again on the same row", async () => {
    const api = await openPage({ postNetworkError: true });
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()).toHaveLength(1);

    api.state.postNetworkError = false;
    await pickStar(2);

    expect(api.posts()).toHaveLength(2);
    expect(api.posts()[1].body).toEqual({ clientSubmissionId: api.posts()[0].body?.clientSubmissionId, rating: 2 });
    expect(screen.queryByTestId("review-qr-error")).not.toBeInTheDocument();
  });

  it("does not post when the star changes before anything was saved", async () => {
    const api = await openPage();
    await pickStar(5);
    await pickStar(2);
    await pickStar(2);
    expect(api.posts()).toHaveLength(0);
  });

  it("makes a different id for a different page load", async () => {
    const first = await openPage();
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    cleanup();

    const second = await openPage();
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();

    expect(first.posts()[0].body?.clientSubmissionId).not.toBe(second.posts()[0].body?.clientSubmissionId);
  });

  it("starts a new row, instead of re-using the id, when a sent complaint would end up under 4-5 stars", async () => {
    const api = await openPage();
    await pickStar(2);
    fireEvent.change(screen.getByTestId("review-qr-comment"), { target: { value: "Cold shower" } });
    tapAnchor(screen.getByTestId("review-qr-google-link"));
    await flush();
    const firstId = api.posts()[0].body?.clientSubmissionId;
    expect(api.posts()[0].body).toMatchObject({ rating: 2, comment: "Cold shower" });

    // The server never blanks a comment, so moving this row to 5 stars would publish the complaint as a website
    // card. The 4-5 star rating goes on a fresh row and carries no comment.
    await pickStar(5);
    expect(api.posts()).toHaveLength(2);
    expect(api.posts()[1].body).toEqual({ clientSubmissionId: expect.stringMatching(UUID_V4), rating: 5 });
    expect(api.posts()[1].body?.clientSubmissionId).not.toBe(firstId);

    // Back to a low rating, the complaint box still holds the text.
    await pickStar(1);
    expect(screen.getByTestId("review-qr-comment")).toHaveValue("Cold shower");
  });

  it("falls back to getRandomValues when crypto.randomUUID is missing (plain http)", async () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => webcrypto.getRandomValues(bytes) });
    const api = await openPage();
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()[0].body?.clientSubmissionId).toMatch(UUID_V4);
  });

  it("still makes a valid id with no crypto at all", async () => {
    vi.stubGlobal("crypto", {});
    const api = await openPage();
    await pickStar(5);
    tapAnchor(screen.getByTestId("review-qr-google-cta"));
    await flush();
    expect(api.posts()[0].body?.clientSubmissionId).toMatch(UUID_V4);
  });
});

describe("ReviewQrPage — wording", () => {
  it("never pressures the guest to give a particular rating", async () => {
    await openPage({ config: qrConfig({ rooms: ROOMS }) });
    const pressure = /(give|rate|leave) us\b|\b5\s*[-\s]?stars?\b|\bfive\s*[-\s]?stars?\b|\b5\s*★/i;

    expect(document.body.textContent ?? "").not.toMatch(pressure);
    await pickStar(2);
    expect(document.body.textContent ?? "").not.toMatch(pressure);
    await pickStar(5);
    expect(document.body.textContent ?? "").not.toMatch(pressure);
  });

  it("marks the chosen star for assistive tech and names every star", async () => {
    await openPage();
    await pickStar(4);

    expect(screen.getByRole("button", { name: "Overall rating: 4 of 5 stars" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Overall rating: 5 of 5 stars" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Selected: 4 of 5")).toBeInTheDocument();
  });
});
