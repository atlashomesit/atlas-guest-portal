/**
 * TASK-10088: polite live-region announcement for a newly polled host reply.
 * Must not announce history, echoed guest sends, or poll no-ops, and must not
 * steal focus or auto-scroll a composing / manually-scrolled guest.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import GuestMessageThread from "./GuestMessageThread";
import {
  fetchGuestMessages,
  fetchGuestTypingState,
  sendGuestMessage,
  sendGuestTypingHeartbeat,
  type GuestConversationMessage,
} from "@/api/guestMessagesClient";

vi.mock("@/api/guestMessagesClient", () => ({
  fetchGuestMessages: vi.fn(),
  sendGuestMessage: vi.fn(),
  // TASK-101313: typing presence — default to nobody typing so older scenarios are unaffected.
  fetchGuestTypingState: vi.fn(),
  sendGuestTypingHeartbeat: vi.fn(),
}));

const fetchMock = vi.mocked(fetchGuestMessages);
const sendMock = vi.mocked(sendGuestMessage);
const typingMock = vi.mocked(fetchGuestTypingState);
const heartbeatMock = vi.mocked(sendGuestTypingHeartbeat);

function msg(
  id: number,
  sender: "Guest" | "Host",
  body: string,
): GuestConversationMessage {
  return { id, sender, body, sentAtUtc: "2026-09-11T10:00:00.000Z" };
}

function thread(messages: GuestConversationMessage[], hasUnreadMessages = false) {
  return { conversationId: 9, messages, hasUnreadMessages };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advancePoll() {
  await act(async () => {
    vi.advanceTimersByTime(30_000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("GuestMessageThread a11y (TASK-10088)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    fetchMock.mockReset();
    sendMock.mockReset();
    typingMock.mockReset();
    heartbeatMock.mockReset();
    typingMock.mockResolvedValue({ hostTyping: false, guestTyping: false });
    heartbeatMock.mockResolvedValue({ hostTyping: false, guestTyping: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("live region is mounted, named, polite, and visually hidden", async () => {
    fetchMock.mockResolvedValue(thread([]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const region = screen.getByTestId("guest-messages-live-region");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveAttribute("aria-label", "Host reply announcements");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("");
  });

  test("initial history with a host message does not announce", async () => {
    fetchMock.mockResolvedValue(thread([msg(1, "Host", "Welcome to the stay")]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    expect(screen.getByText("Welcome to the stay")).toBeInTheDocument();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");
  });

  test("a post-load host reply announces once without reading the body", async () => {
    fetchMock
      .mockResolvedValueOnce(thread([msg(1, "Guest", "What time is check-in?")]))
      .mockResolvedValue(thread([
        msg(1, "Guest", "What time is check-in?"),
        msg(2, "Host", "Anytime after 2pm — secret gate code 1234"),
      ], true));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");

    await advancePoll();

    const region = screen.getByTestId("guest-messages-live-region");
    expect(region).toHaveTextContent("New reply from your host");
    expect(region).not.toHaveTextContent("Anytime after 2pm");
    expect(region).not.toHaveTextContent("secret gate code");
    expect(screen.getByTestId("messages-unread-badge")).toHaveTextContent("New reply");
    expect(screen.getByText(/Anytime after 2pm/)).toBeInTheDocument();
  });

  test("two new host replies use a safe count and still omit bodies", async () => {
    fetchMock
      .mockResolvedValueOnce(thread([]))
      .mockResolvedValue(thread([
        msg(10, "Host", "body-one-secret"),
        msg(11, "Host", "body-two-secret"),
      ], true));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    await advancePoll();

    const region = screen.getByTestId("guest-messages-live-region");
    expect(region).toHaveTextContent("2 new replies from your host");
    expect(region).not.toHaveTextContent("body-one-secret");
    expect(region).not.toHaveTextContent("body-two-secret");
  });

  test("the guest's own send is not announced", async () => {
    fetchMock.mockResolvedValue(thread([]));
    sendMock.mockResolvedValue(msg(50, "Guest", "On my way"));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const input = screen.getByTestId("guest-message-input");
    fireEvent.change(input, { target: { value: "On my way" } });
    fireEvent.click(screen.getByTestId("guest-message-send"));
    await flush();

    expect(screen.getByText("On my way")).toBeInTheDocument();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");
  });

  test("a poll with no new host message does not announce", async () => {
    fetchMock.mockResolvedValue(thread([msg(1, "Host", "Already seen")]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");

    await advancePoll();

    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("a refetch after retry does not announce historical host messages", async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { name: "Error" }))
      .mockResolvedValue(thread([msg(1, "Host", "Historical")]));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();
    expect(screen.getByTestId("guest-messages-error")).toBeInTheDocument();

    await advancePoll();

    expect(screen.getByText("Historical")).toBeInTheDocument();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("");
  });

  test("a poll does not steal focus or scroll while the guest is composing", async () => {
    fetchMock
      .mockResolvedValueOnce(thread([msg(1, "Guest", "Hello")]))
      .mockResolvedValue(thread([
        msg(1, "Guest", "Hello"),
        msg(2, "Host", "Hi there"),
      ], true));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const input = screen.getByTestId("guest-message-input");
    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "still typing" } });
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    const scrollMock = window.HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();

    await advancePoll();

    expect(focusSpy).not.toHaveBeenCalled();
    expect(input).toHaveValue("still typing");
    expect(scrollMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("guest-messages-live-region")).toHaveTextContent("New reply from your host");
  });

  test("a poll does not pull a manually scrolled thread to the bottom", async () => {
    fetchMock
      .mockResolvedValueOnce(thread([msg(1, "Guest", "Hello")]))
      .mockResolvedValue(thread([
        msg(1, "Guest", "Hello"),
        msg(2, "Host", "Hi there"),
      ], true));

    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const list = screen.getByTestId("guest-messages-list");
    Object.defineProperty(list, "scrollHeight", { configurable: true, value: 800 });
    Object.defineProperty(list, "scrollTop", { configurable: true, value: 0 });
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 200 });
    fireEvent.scroll(list);

    const scrollMock = window.HTMLElement.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();

    await advancePoll();

    expect(scrollMock).not.toHaveBeenCalled();
  });
});
