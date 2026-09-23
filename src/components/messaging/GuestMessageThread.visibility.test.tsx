/**
 * TASK-102401 — chat polling suspends while the tab is hidden (battery/data),
 * and resumes with an immediate refresh when visible again.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import GuestMessageThread from "./GuestMessageThread";
import { fetchGuestMessages, fetchGuestTypingState } from "@/api/guestMessagesClient";

vi.mock("@/api/guestMessagesClient", () => ({
  fetchGuestMessages: vi.fn(),
  sendGuestMessage: vi.fn(),
  fetchGuestTypingState: vi.fn(),
  sendGuestTypingHeartbeat: vi.fn(),
}));

const fetchMock = vi.mocked(fetchGuestMessages);
const typingMock = vi.mocked(fetchGuestTypingState);

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  fetchMock.mockResolvedValue({ conversationId: 9, messages: [], hasUnreadMessages: false });
  typingMock.mockResolvedValue({ hostTyping: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GuestMessageThread background suspension (TASK-102401)", () => {
  test("hidden tab: poll ticks make no network calls", async () => {
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();
    const baseline = fetchMock.mock.calls.length;
    setVisibility("hidden");
    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });
    // typing poll (5s cadence) must also stay quiet while hidden
    expect(typingMock.mock.calls.length).toBeLessThanOrEqual(1);
    expect(fetchMock.mock.calls.length).toBe(baseline);
  });

  test("visible tab: message poll fires on its 30s cadence", async () => {
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();
    const baseline = fetchMock.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(baseline);
  });
});
