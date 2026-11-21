import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import SEO from "../components/SEO";

/**
 * HSL-031: the lobby poster page, opened from the QR on the property's printed poster (`/lobby/:token`). A guest who lost the check-in link types the booking reference
 * and last name; if they match, the property sends the check-in link to the phone ON THE BOOKING. This is a shared screen, so it holds and shows nothing private:
 * the answer is always the same neutral sentence (match or not), no name, balance, bunk, door code or link is ever returned or drawn, nothing is kept in storage, and the form
 * clears itself after 30 seconds without a touch.
 */
export const LOBBY_IDLE_RESET_MS = 30_000;

interface LobbyPage {
  propertyName: string;
  available: boolean;
  frontDeskLine: string | null;
}

type Phase = "loading" | "ready" | "notfound" | "error";

export default function LobbyCheckinLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [page, setPage] = useState<LobbyPage | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [bookingRef, setBookingRef] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setBookingRef("");
    setLastName("");
    setMessage(null);
    setProblem(null);
  }, []);

  // 30-second idle reset: any touch, key or pointer move restarts the clock.
  const touch = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(reset, LOBBY_IDLE_RESET_MS);
  }, [reset]);

  useEffect(() => {
    touch();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch));
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [touch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/public/checkin/lobby/${encodeURIComponent(token ?? "")}`), { headers: getApiHeaders() });
        if (cancelled) return;
        if (res.status === 404) { setPhase("notfound"); return; }
        if (!res.ok) { setPhase("error"); return; }
        setPage((await res.json()) as LobbyPage);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRef.trim() || !lastName.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(buildApiUrl(`/api/public/checkin/lobby/${encodeURIComponent(token ?? "")}/request-link`), {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bookingRef: bookingRef.trim(), lastName: lastName.trim() }),
      });
      if (res.status === 429) {
        setProblem("Please wait a few minutes and try again, or ask the front desk.");
        return;
      }
      if (!res.ok) {
        setProblem("We could not do that right now. Please ask the front desk.");
        return;
      }
      const body = (await res.json()) as { message?: string };
      setMessage(body.message ?? "If these match, we sent a message to the phone on your booking.");
      // The typed details are cleared the moment they are used: nothing stays on a shared screen.
      setBookingRef("");
      setLastName("");
    } catch {
      setProblem("We could not do that right now. Please ask the front desk.");
    } finally {
      setBusy(false);
    }
  };

  const desk = page?.frontDeskLine ? `Ask the front desk: ${page.frontDeskLine}` : "Please ask the front desk.";

  return (
    <main className="mx-auto max-w-md p-4" data-testid="lobby-page">
      <SEO title="Get your check-in link" robots="noindex, nofollow" />
      {phase === "loading" && <p data-testid="lobby-loading">Loading...</p>}
      {phase === "notfound" && <p data-testid="lobby-notfound">This page is not available. Please ask the front desk.</p>}
      {phase === "error" && <p data-testid="lobby-error">We could not load this page. Please ask the front desk.</p>}
      {phase === "ready" && page && (
        <>
          <h1 className="text-xl font-semibold" data-testid="lobby-heading">{page.propertyName}</h1>
          <p className="mt-1 text-sm text-slate-600">Lost your check-in link? We can send it to the phone on your booking.</p>
          {!page.available ? (
            <p className="mt-4" data-testid="lobby-unavailable">{desk}</p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3" autoComplete="off" data-testid="lobby-form">
              <label className="block text-sm">
                Booking reference
                <input
                  className="mt-1 w-full rounded border p-3 text-base"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  autoCapitalize="characters"
                  data-testid="lobby-ref"
                />
              </label>
              <label className="block text-sm">
                Last name
                <input
                  className="mt-1 w-full rounded border p-3 text-base"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  data-testid="lobby-lastname"
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] w-full rounded bg-teal-700 px-4 py-3 text-white disabled:opacity-50"
                disabled={busy || !bookingRef.trim() || !lastName.trim()}
                data-testid="lobby-submit"
              >
                Send me my check-in link
              </button>
            </form>
          )}
          {message && <p className="mt-4 rounded bg-slate-100 p-3" role="status" data-testid="lobby-message">{message} {desk}</p>}
          {problem && <p className="mt-4 text-red-700" role="alert" data-testid="lobby-problem">{problem}</p>}
        </>
      )}
    </main>
  );
}
