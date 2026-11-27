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

export type VoiceLanguage = "en-IN" | "hi-IN" | "te-IN";

export type VoicePersonaKey =
  | "saanvi_warm_in"
  | "arjun_concise_in"
  | "meera_hospitality_in"
  | "rohan_friendly_in";

export interface VoicePersonaProfile {
  label: string;
  rate: number;
  pitch: number;
  preferredGender: "female" | "male";
}

export const VOICE_PERSONA_PROFILES: Record<VoicePersonaKey, VoicePersonaProfile> = {
  saanvi_warm_in: { label: "Saanvi", rate: 0.98, pitch: 1.06, preferredGender: "female" },
  arjun_concise_in: { label: "Arjun", rate: 1.05, pitch: 0.92, preferredGender: "male" },
  meera_hospitality_in: { label: "Meera", rate: 0.96, pitch: 1.04, preferredGender: "female" },
  rohan_friendly_in: { label: "Rohan", rate: 1.02, pitch: 0.96, preferredGender: "male" },
};

export function resolveVoicePersona(key?: string | null): VoicePersonaProfile | null {
  if (!key) return null;
  return (VOICE_PERSONA_PROFILES as Record<string, VoicePersonaProfile | undefined>)[key] ?? null;
}

export const VOICE_LANGUAGE_OPTIONS: ReadonlyArray<{ code: VoiceLanguage; label: string }> = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "te-IN", label: "తెలుగు" },
];

export const VOICE_DISCLOSURE =
  "Hi, I'm the AI voice assistant for this property — you can ask for a person or a human callback at any time.";

const newSessionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function pickIndianVoice(lang: VoiceLanguage = "en-IN"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const lower = lang.toLowerCase();
  const prefix = lower.split("-")[0];
  return (
    voices.find((v) => v.lang?.toLowerCase() === lower) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(`${prefix}-`)) ??
    voices.find((v) => v.lang?.toLowerCase() === "en-in") ??
    voices.find((v) => v.lang?.toLowerCase().startsWith("en-in"))
  );
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
  const [slowLookup, setSlowLookup] = useState(false);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState<VoiceLanguage>("en-IN");
  const [personaKey, setPersonaKey] = useState<string | null>(null);
  const [followUpUrl, setFollowUpUrl] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const sessionId = useRef<string>(newSessionId());
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const inFlightController = useRef<AbortController | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/public/voice/config?surface=guest`, { headers: getApiHeaders() });
        if (!res.ok) return;
        const body = (await res.json()) as { enabled?: boolean; voicePersonaKey?: string | null };
        if (!cancelled && body?.enabled === true) {
          setEnabled(true);
          if (body.voicePersonaKey) setPersonaKey(body.voicePersonaKey);
        }
      } catch {
        /* fail-safe: stay hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const interruptPlaybackAndPending = useCallback(() => {
    window.speechSynthesis?.cancel?.();
    if (inFlightController.current) {
      inFlightController.current.abort();
      inFlightController.current = null;
    }
    if (slowTimer.current) {
      clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
    setSlowLookup(false);
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
    interruptPlaybackAndPending();
  }, [interruptPlaybackAndPending]);

  useEffect(() => stopAudio, [stopAudio]);

  const send = useCallback(
    async (raw: string) => {
      const transcript = raw.trim();
      if (!transcript) return;
      interruptPlaybackAndPending();
      const controller = new AbortController();
      inFlightController.current = controller;
      setTurns((t) => [...t, { role: "guest", text: transcript }]);
      setDraft("");
      setBusy(true);
      slowTimer.current = setTimeout(() => {
        setSlowLookup(true);
      }, 1200);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/public/voice/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          signal: controller.signal,
          body: JSON.stringify({ surface: "guest", sessionId: sessionId.current, transcript, listingId: listingId ?? null, language }),
        });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { reply?: string; text?: string; followUpUrl?: string | null };
        if (controller.signal.aborted) return;
        const reply = body.reply ?? body.text ?? "";
        if (reply) {
          setTurns((t) => [...t, { role: "agent", text: reply }]);
          if (typeof window !== "undefined" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
            const u = new SpeechSynthesisUtterance(reply);
            u.lang = language;
            const persona = resolveVoicePersona(personaKey);
            if (persona) {
              u.rate = persona.rate;
              u.pitch = persona.pitch;
            }
            const v = pickIndianVoice(language);
            if (v) u.voice = v;
            window.speechSynthesis.speak(u);
          }
        }
        if (body.followUpUrl) setFollowUpUrl(body.followUpUrl);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError" || controller.signal.aborted) return;
        setTurns((t) => [...t, { role: "agent", text: "Sorry, I could not reach the assistant. Please try again or use WhatsApp." }]);
      } finally {
        if (inFlightController.current === controller) {
          inFlightController.current = null;
          if (slowTimer.current) {
            clearTimeout(slowTimer.current);
            slowTimer.current = null;
          }
          setSlowLookup(false);
          setBusy(false);
        }
      }
    },
    [listingId, language, personaKey, interruptPlaybackAndPending],
  );

  const startListening = useCallback(() => {
    interruptPlaybackAndPending();
    const w = window as unknown as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = language;
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
  }, [send, language, interruptPlaybackAndPending]);

  const closeAndReset = useCallback(() => {
    stopAudio();
    setOpen(false);
    setTurns([]);
    setFollowUpUrl(null);
    setShowRating(false);
    setRating(0);
    setRatingComment("");
    setRatingSubmitting(false);
    setRatingSubmitted(false);
    sessionId.current = newSessionId();
  }, [stopAudio]);

  const hangUp = useCallback(() => {
    stopAudio();
    if (turns.length > 0 && !showRating) {
      setShowRating(true);
      return;
    }
    closeAndReset();
  }, [stopAudio, turns.length, showRating, closeAndReset]);

  const submitRating = useCallback(async () => {
    if (rating < 1 || rating > 5 || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/public/voice/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          sessionId: sessionId.current,
          rating,
          comment: ratingComment.trim().slice(0, 300) || null,
        }),
      });
    } catch {
      /* fail-safe: never trap caller on rating error */
    } finally {
      setRatingSubmitting(false);
      setRatingSubmitted(true);
    }
  }, [rating, ratingComment, ratingSubmitting]);

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
          {showRating ? (
            <div data-testid="voice-csat-card">
              {ratingSubmitted ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Thanks for your feedback!</p>
                  <button type="button" data-testid="voice-csat-done" onClick={closeAndReset} style={{ minHeight: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>How was your voice call?</p>
                  <div role="group" aria-label="Call satisfaction rating" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        data-testid={`voice-csat-star-${star}`}
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        aria-pressed={rating === star}
                        onClick={() => setRating(star)}
                        style={{
                          flex: 1,
                          minHeight: 40,
                          borderRadius: 10,
                          border: rating >= star ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                          background: rating >= star ? "#fef3c7" : "#f8fafc",
                          color: rating >= star ? "#b45309" : "#64748b",
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {star}★
                      </button>
                    ))}
                  </div>
                  <textarea
                    aria-label="Optional call feedback"
                    data-testid="voice-csat-comment"
                    maxLength={300}
                    rows={2}
                    placeholder="Optional comment (up to 300 characters)"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: 8, borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      data-testid="voice-csat-submit"
                      disabled={rating < 1 || ratingSubmitting}
                      onClick={() => void submitRating()}
                      style={{ flex: 1, minHeight: 40, borderRadius: 10, border: "none", background: rating >= 1 ? "#0f172a" : "#94a3b8", color: "#fff", fontWeight: 600, cursor: rating >= 1 ? "pointer" : "not-allowed" }}
                    >
                      {ratingSubmitting ? "Sending…" : "Submit rating"}
                    </button>
                    <button
                      type="button"
                      data-testid="voice-csat-skip"
                      onClick={closeAndReset}
                      style={{ minHeight: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
          <div role="group" aria-label="Voice language" data-testid="voice-language-picker" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {VOICE_LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  data-testid={`voice-lang-${opt.code}`}
                  aria-pressed={active}
                  onClick={() => setLanguage(opt.code)}
                  style={{
                    flex: 1,
                    minHeight: 36,
                    borderRadius: 999,
                    border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                    background: active ? "#0f172a" : "#f8fafc",
                    color: active ? "#fff" : "#334155",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#475569" }}>{VOICE_DISCLOSURE}</p>
          <div aria-live="polite" style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {turns.map((t, i) => (
              <div key={i} data-testid={`voice-turn-${t.role}`} style={{ alignSelf: t.role === "guest" ? "flex-end" : "flex-start", background: t.role === "guest" ? "#e0f2fe" : "#f1f5f9", borderRadius: 12, padding: "6px 10px", fontSize: 14 }}>
                {t.text}
              </div>
            ))}
            {slowLookup && (
              <div data-testid="voice-slow-indicator" style={{ alignSelf: "flex-start", fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                Checking live availability…
              </div>
            )}
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
              <button type="button" data-testid="voice-mic" onClick={startListening} disabled={listening} style={{ minHeight: 44, flex: 1 }}>
                {listening ? "Listening…" : "Speak"}
              </button>
            )}
            <button type="button" data-testid="voice-hangup" onClick={hangUp} style={{ minHeight: 44, flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 10 }}>
              End call
            </button>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
