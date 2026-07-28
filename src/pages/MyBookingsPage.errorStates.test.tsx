import { useEffect } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthProvider, useGuestAuth } from "../contexts/GuestAuthContext";

// TASK-6056: a signed-in guest whose JWT had simply expired was shown "Bookings not found" —
// indistinguishable from an actually-empty account — because the error screen picked its
// headline from `auth.isAuthenticated` (still true for a dead token) rather than from *why*
// the load failed. These tests pin down the fix: session-expired, load-failed (5xx/404), and
// genuinely-empty must each render distinct copy, a 401 must offer re-authentication (not
// "Browse homes"), and no error path may claim the guest's bookings don't exist.
//
// Written to FAIL against the pre-fix code: the pre-fix branch was
// `title={auth.isAuthenticated ? "Bookings not found" : "Sign in to view your bookings"}`, which
// rendered the literal string "Bookings not found" for BOTH the 401 and the 500 case below
// (since a stale-but-present token keeps `auth.isAuthenticated` true).

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Logs a guest in via the real context (not localStorage priming — guestAuthStorage's cache is
 * only read once at module-import time) so MyBookingsPage's JWT branch (`hasJwt`) is genuinely
 * exercised, matching how a real signed-in guest with a live-but-expired token reaches this
 * screen. */
function AuthedBookingsPage() {
  const { login } = useGuestAuth();
  useEffect(() => {
    login("stale-jwt-token", "guest@example.com", 3001);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <MyBookingsPage />;
}

function renderAuthed() {
  return render(
    <MemoryRouter initialEntries={["/my-bookings"]}>
      <GuestAuthProvider>
        <Routes>
          <Route path="/my-bookings" element={<AuthedBookingsPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </GuestAuthProvider>
    </MemoryRouter>,
  );
}

describe("MyBookingsPage — TASK-6056 error-kind-driven messaging (signed-in guest)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("401 (expired session) shows session-expired copy, offers re-authentication, and never says 'not found'", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return new Response(null, { status: 401 });
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderAuthed();

    const state = await screen.findByTestId("my-bookings-error-state");
    expect(within(state).getByText("Your session expired")).toBeInTheDocument();
    expect(state.textContent?.toLowerCase()).not.toContain("not found");

    const cta = within(state).getByText("Log in again");
    expect(cta.closest("a")).toHaveAttribute("href", "/login");
  });

  test("500 (server error) shows a distinct load-failed copy, offers retry, and never says 'not found'", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return new Response(null, { status: 500 });
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderAuthed();

    const state = await screen.findByTestId("my-bookings-error-state");
    expect(within(state).getByText("We couldn't load your bookings")).toBeInTheDocument();
    expect(state.textContent?.toLowerCase()).not.toContain("not found");
    expect(within(state).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  test("404 on the authenticated endpoint is treated as a load failure, not proof the account has no bookings", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return new Response(null, { status: 404 });
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderAuthed();

    const state = await screen.findByTestId("my-bookings-error-state");
    // Must render the same "load failed" headline as the 500 case above, not a bespoke
    // "bookings not found"/"no bookings for your account" message.
    expect(within(state).getByText("We couldn't load your bookings")).toBeInTheDocument();
    expect(state.textContent?.toLowerCase()).not.toContain("not found");
  });

  test("session-expired (401) and load-failed (500) render genuinely different headlines from each other", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return new Response(null, { status: 401 });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderAuthed();
    const expiredState = await screen.findByTestId("my-bookings-error-state");
    const expiredTitle = within(expiredState).getByRole("heading").textContent;
    cleanup();
    vi.restoreAllMocks();

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return new Response(null, { status: 500 });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    renderAuthed();
    const failedState = await screen.findByTestId("my-bookings-error-state");
    const failedTitle = within(failedState).getByRole("heading").textContent;

    expect(expiredTitle).not.toBe(failedTitle);
  });

  test("a genuinely successful empty response still renders the honest empty state, not an error", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/auth/bookings")) return jsonResponse([]);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderAuthed();

    await waitFor(() => {
      expect(screen.getByTestId("my-bookings-empty-state")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("my-bookings-error-state")).not.toBeInTheDocument();
  });
});
