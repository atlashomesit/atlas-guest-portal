import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TalkToUsVoiceWidget from "./TalkToUsVoiceWidget";
import { settle } from "@/test/settle";

vi.mock("@/runtime-config", () => ({ getApiBaseUrl: () => "https://api.test" }));
vi.mock("@/api/client", () => ({ getApiHeaders: () => ({ "X-Tenant-Slug": "t1" }) }));

type Json = Record<string, unknown>;
const res = (ok: boolean, body: Json = {}) => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

describe("TalkToUsVoiceWidget", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const abort = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    abort.mockClear();
    cancel.mockClear();
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel, speak: vi.fn(), getVoices: () => [] } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Json).webkitSpeechRecognition;
  });

  it("renders nothing when disabled", async () => {
    fetchMock.mockResolvedValueOnce(res(true, { enabled: false }));
    render(<TalkToUsVoiceWidget />);
    await settle();
    expect(screen.queryByTestId("guest-voice-widget")).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/public/voice/config?surface=guest");
  });

  it("renders nothing on 404 or network error", async () => {
    fetchMock.mockResolvedValueOnce(res(false));
    const a = render(<TalkToUsVoiceWidget />);
    await settle();
    expect(screen.queryByTestId("guest-voice-widget")).toBeNull();
    a.unmount();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<TalkToUsVoiceWidget />);
    await settle();
    expect(screen.queryByTestId("guest-voice-widget")).toBeNull();
  });

  it("runs a text turn and surfaces the checkout follow-up CTA", async () => {
    fetchMock
      .mockResolvedValueOnce(res(true, { enabled: true }))
      .mockResolvedValueOnce(res(true, { reply: "Yes, those dates are free.", followUpUrl: "https://atlastays.com/checkout?x=1" }));
    render(<TalkToUsVoiceWidget listingId={42} />);
    await settle();
    fireEvent.click(screen.getByText("Talk to us"));
    expect(screen.getByText(/AI voice assistant/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Type your question"), { target: { value: "Is 5 Dec free?" } });
    fireEvent.click(screen.getByText("Send"));
    await settle();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.test/api/public/voice/turn");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ surface: "guest", transcript: "Is 5 Dec free?", listingId: 42 });
    expect(typeof body.sessionId).toBe("string");
    expect(screen.getByText("Yes, those dates are free.")).toBeTruthy();
    const cta = screen.getByTestId("voice-follow-up");
    expect(cta.getAttribute("href")).toBe("https://atlastays.com/checkout?x=1");
    expect(cta.textContent).toBe("Continue to pre-filled checkout");
  });

  it("stops mic and speech on hang up", async () => {
    const rec = { lang: "", interimResults: false, continuous: false, onresult: null, onerror: null, onend: null, start: vi.fn(), stop: vi.fn(), abort };
    (window as unknown as Json).webkitSpeechRecognition = function () {
      return rec;
    };
    fetchMock.mockResolvedValueOnce(res(true, { enabled: true }));
    render(<TalkToUsVoiceWidget />);
    await settle();
    fireEvent.click(screen.getByText("Talk to us"));
    fireEvent.click(screen.getByTestId("voice-mic"));
    expect(rec.start).toHaveBeenCalled();
    expect(rec.lang).toBe("en-IN");
    fireEvent.click(screen.getByTestId("voice-hangup"));
    expect(abort).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches SpeechRecognition and SpeechSynthesis lang via language pills (TVOI-012)", async () => {
    const rec = { lang: "", interimResults: false, continuous: false, onresult: null, onerror: null, onend: null, start: vi.fn(), stop: vi.fn(), abort };
    (window as unknown as Json).webkitSpeechRecognition = function () {
      return rec;
    };
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, speak, getVoices: () => [{ lang: "hi-IN", name: "Google हिन्दी" }] },
    });
    class FakeUtterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      constructor(t: string) {
        this.text = t;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    fetchMock
      .mockResolvedValueOnce(res(true, { enabled: true }))
      .mockResolvedValueOnce(res(true, { reply: "जी हाँ, कमरा उपलब्ध है।" }));

    render(<TalkToUsVoiceWidget />);
    await settle();
    fireEvent.click(screen.getByText("Talk to us"));
    fireEvent.click(screen.getByTestId("voice-lang-hi-IN"));
    fireEvent.click(screen.getByTestId("voice-mic"));
    expect(rec.lang).toBe("hi-IN");

    fireEvent.change(screen.getByLabelText("Type your question"), { target: { value: "क्या कमरा खाली है?" } });
    fireEvent.click(screen.getByText("Send"));
    await settle();
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ language: "hi-IN" });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].lang).toBe("hi-IN");
  });

  it("applies configured voicePersonaKey rate and pitch to web TTS (TVOI-024)", async () => {
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, speak, getVoices: () => [] },
    });
    class FakeUtterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      constructor(t: string) {
        this.text = t;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    fetchMock
      .mockResolvedValueOnce(res(true, { enabled: true, voicePersonaKey: "arjun_concise_in" }))
      .mockResolvedValueOnce(res(true, { reply: "Welcome!" }));

    render(<TalkToUsVoiceWidget />);
    await settle();
    fireEvent.click(screen.getByText("Talk to us"));
    fireEvent.change(screen.getByLabelText("Type your question"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByText("Send"));
    await settle();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].rate).toBe(1.05);
    expect(speak.mock.calls[0][0].pitch).toBe(0.92);
  });

  it("cancels active speechSynthesis and aborts in-flight turn on barge-in (TVOI-032)", async () => {
    const rec = { lang: "", interimResults: false, continuous: false, onresult: null, onerror: null, onend: null, start: vi.fn(), stop: vi.fn(), abort };
    (window as unknown as Json).webkitSpeechRecognition = function () {
      return rec;
    };
    let capturedSignal: AbortSignal | undefined;
    fetchMock
      .mockResolvedValueOnce(res(true, { enabled: true }))
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal | undefined;
        return new Promise(() => {
          /* pending in-flight request */
        });
      });

    render(<TalkToUsVoiceWidget />);
    await settle();
    fireEvent.click(screen.getByText("Talk to us"));
    fireEvent.change(screen.getByLabelText("Type your question"), { target: { value: "Check availability" } });
    fireEvent.click(screen.getByText("Send"));
    expect(capturedSignal?.aborted).toBe(false);

    // Tapping Speak while busy/speaking interrupts playback and aborts stale turn
    fireEvent.click(screen.getByTestId("voice-mic"));
    expect(cancel).toHaveBeenCalled();
    expect(capturedSignal?.aborted).toBe(true);
    expect(rec.start).toHaveBeenCalled();
  });
});
