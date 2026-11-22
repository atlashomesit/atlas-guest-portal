import React, { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/runtime-config";
import { getApiHeaders } from "@/api/client";

/**
 * Website "Talk to us" live browser voice widget (founder ruling 2026-11-19, point 4).
 * Renders NOTHING unless GET /api/public/voice/config?surface=guest answers { enabled: true }:
 * a disabled flag, a 404 or a network error all leave the page untouched (no dead button).
 */

type Turn = { role: "guest" | "agent"; text: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export const VOICE_DISCLOSURE = "Atlas AI voice assistant — answers stay & availability questions.";

const newSessionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function pickIndianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang?.toLowerCase().startsWith("en-in"));
}

export interface TalkToUsVoiceWidgetProps {
  listingId?: number | string | null;
}

export default function TalkToUsVoiceWidget({ listingId }: TalkToUsVoiceWidgetProps): React.ReactElement | null {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [followUpUrl, setFollowUpUrl] = useState<string | null>(null);
  const sessionId = useRef<string>(newSessionId());
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/public/voice/config?surface=guest`, { headers: getApiHeaders() });
        if (!res.ok) return;
        const body = (await res.json()) as { enabled?: boolean };
        if (!cancelled && body?.enabled === true) setEnabled(true);
      } catch {
        /* fail-safe: stay hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopAudio = useCallback(() => {
    const rec = recognition.current;
    recognition.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        (rec.abort ?? rec.stop).call(rec);
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  const send = useCallback(
    async (raw: string) => {
      const transcript = raw.trim();
      if (!transcript) return;
      setTurns((t) => [...t, { role: "guest", text: transcript }]);
      setDraft("");
      setBusy(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/public/voice/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ surface: "guest", sessionId: sessionId.current, transcript, listingId: listingId ?? null }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { reply?: string; text?: string; followUpUrl?: string | null };
        const reply = body.reply ?? body.text ?? "";
        if (reply) {
          setTurns((t) => [...t, { role: "agent", text: reply }]);
          if (typeof window !== "undefined" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
            const u = new SpeechSynthesisUtterance(reply);
            u.lang = "en-IN";
            const v = pickIndianVoice();
            if (v) u.voice = v;
            window.speechSynthesis.speak(u);
          }
        }
        if (body.followUpUrl) setFollowUpUrl(body.followUpUrl);
      } catch {
        setTurns((t) => [...t, { role: "agent", text: "Sorry, I could not reach the assistant. Please try again or use WhatsApp." }]);
      } finally {
        setBusy(false);
      }
    },
    [listingId],
  );

  const startListening = useCallback(() => {
    const w = window as unknown as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      void send(text);
    };
    rec.onerror = () => setListening(false); // mic denied: the text box below keeps working
    rec.onend = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [send]);

  const hangUp = useCallback(() => {
    stopAudio();
    setOpen(false);
    setTurns([]);
    setFollowUpUrl(null);
    sessionId.current = newSessionId();
  }, [stopAudio]);

  if (!enabled) return null;

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean((window as unknown as SpeechWindow).SpeechRecognition ?? (window as unknown as SpeechWindow).webkitSpeechRecognition);

  return (
    <div data-testid="guest-voice-widget" style={{ position: "fixed", left: 16, bottom: "calc(var(--pp-sticky-bar-offset, 0px) + 16px)", zIndex: 1000 }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ minHeight: 44, minWidth: 44, padding: "0 18px", borderRadius: 999, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Talk to us
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Talk to us" style={{ width: "min(360px, calc(100vw - 32px))", background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,.2)", padding: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#475569" }}>{VOICE_DISCLOSURE}</p>
          <div aria-live="polite" style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {turns.map((t, i) => (
              <div key={i} data-testid={`voice-turn-${t.role}`} style={{ alignSelf: t.role === "guest" ? "flex-end" : "flex-start", background: t.role === "guest" ? "#e0f2fe" : "#f1f5f9", borderRadius: 12, padding: "6px 10px", fontSize: 14 }}>
                {t.text}
              </div>
            ))}
          </div>
          {followUpUrl && (
            <a
              data-testid="voice-follow-up"
              href={followUpUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", marginTop: 8, minHeight: 44, lineHeight: "44px", textAlign: "center", borderRadius: 10, background: "#16a34a", color: "#fff", fontWeight: 600, textDecoration: "none" }}
            >
              {/wa\.me|whatsapp/i.test(followUpUrl) ? "Send link on WhatsApp" : "Continue to pre-filled checkout"}
            </a>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            style={{ display: "flex", gap: 6, marginTop: 8 }}
          >
            <input
              aria-label="Type your question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              style={{ flex: 1, minHeight: 44, padding: "0 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
            <button type="submit" disabled={busy || !draft.trim()} style={{ minHeight: 44, padding: "0 14px" }}>
              Send
            </button>
          </form>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {speechSupported && (
              <button type="button" data-testid="voice-mic" onClick={startListening} disabled={listening || busy} style={{ minHeight: 44, flex: 1 }}>
                {listening ? "Listening…" : "Speak"}
              </button>
            )}
            <button type="button" data-testid="voice-hangup" onClick={hangUp} style={{ minHeight: 44, flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 10 }}>
              End call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
