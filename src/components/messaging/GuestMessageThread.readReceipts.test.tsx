/**
 * TASK-101313: guest-portal read receipts + host-typing indicator.
 * Fails-first coverage: no tick/typing assertion existed before this task.
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
  status?: string,
): GuestConversationMessage {
  return { id, sender, body, sentAtUtc: "2026-09-11T10:00:00.000Z", status };
}

function thread(messages: GuestConversationMessage[], hasUnreadMessages = false) {
  return { conversationId: 9, messages, hasUnreadMessages };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceTypingPoll() {
  await act(async () => {
    vi.advanceTimersByTime(5_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("GuestMessageThread read receipts + typing (TASK-101313)", () => {
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

  test("guest messages render distinct tick states for read vs delivered vs sent", async () => {
    fetchMock.mockResolvedValue(thread([
      msg(1, "Guest", "read by host", "read"),
      msg(2, "Guest", "on its way", "delivered"),
      msg(3, "Guest", "just sent", "pending"),
      msg(4, "Host", "hello from host", "read"),
    ]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const ticks = screen.getAllByTestId("guest-message-ticks");
    // Only the three guest messages carry ticks — the host message must not.
    expect(ticks).toHaveLength(3);
    expect(ticks[0]).toHaveAttribute("data-state", "read");
    expect(ticks[1]).toHaveAttribute("data-state", "delivered");
    expect(ticks[2]).toHaveAttribute("data-state", "sent");

    // Read is the blue double-tick; delivered the plain double-tick; sent a single tick.
    expect(ticks[0]).toHaveTextContent("✓✓");
    expect(ticks[0].getAttribute("class")).toMatch(/sky/);
    expect(ticks[0]).toHaveAttribute("aria-label", "Message read");
    expect(ticks[1]).toHaveTextContent("✓✓");
    expect(ticks[1]).toHaveAttribute("aria-label", "Message delivered");
    expect(ticks[2]).toHaveTextContent("✓");
    expect(ticks[2]).toHaveAttribute("aria-label", "Message sent");
  });

  test("absent status falls back to sent rather than rendering no ticks", async () => {
    fetchMock.mockResolvedValue(thread([msg(1, "Guest", "legacy payload")]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const ticks = screen.getAllByTestId("guest-message-ticks");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]).toHaveAttribute("data-state", "sent");
  });

  test("host typing indicator appears while the host types and clears after", async () => {
    fetchMock.mockResolvedValue(thread([msg(1, "Guest", "Hello?")]));
    typingMock.mockResolvedValue({ hostTyping: true, guestTyping: false });
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const indicator = screen.getByTestId("host-typing-indicator");
    expect(indicator).toHaveTextContent(/Host typing/i);
    expect(indicator).toHaveAttribute("role", "status");

    typingMock.mockResolvedValue({ hostTyping: false, guestTyping: false });
    await advanceTypingPoll();

    expect(screen.queryByTestId("host-typing-indicator")).toBeNull();
  });

  test("no typing indicator before a conversation exists", async () => {
    fetchMock.mockResolvedValue({ conversationId: null, messages: [], hasUnreadMessages: false });
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    expect(screen.queryByTestId("host-typing-indicator")).toBeNull();
    expect(typingMock).not.toHaveBeenCalled();
  });

  test("composing sends a throttled guest typing heartbeat", async () => {
    fetchMock.mockResolvedValue(thread([msg(1, "Host", "Hi")]));
    render(<GuestMessageThread bookingId={1} token="t" />);
    await flush();

    const input = screen.getByTestId("guest-message-input");
    fireEvent.change(input, { target: { value: "hel" } });
    expect(heartbeatMock).toHaveBeenCalledTimes(1);
    expect(heartbeatMock).toHaveBeenCalledWith(1, "t");

    // Immediate further keystrokes stay throttled.
    fireEvent.change(input, { target: { value: "hell" } });
    fireEvent.change(input, { target: { value: "hello" } });
    expect(heartbeatMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    fireEvent.change(input, { target: { value: "hello!" } });
    expect(heartbeatMock).toHaveBeenCalledTimes(2);
  });
});
