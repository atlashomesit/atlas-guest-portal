import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useParams } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";

/**
 * REV-046 (founder ruling 2026-10-28): the page a guest reaches by scanning the host's review QR code,
 * `/rate/:tenantSlug/:code`.
 *
 * CATCH FIRST, GOOGLE OPEN TO EVERY GUEST. Google's contribution policy bars merchants from discouraging
 * negative reviews or selectively soliciting positive ones, so this page never gates:
 *   - 1-3 stars: the guest is invited to tell the owner what went wrong (private), AND a readable
 *     "Post a public review on Google" link is on the same screen before anything is sent;
 *   - 4-5 stars: a big "Post on Google" button first, then an optional "Leave a note on our website too" box.
 * Wording invites and never pressures: nothing here asks for a particular star count.
 *
 * API (anonymous; the unguessable code identifies the host):
 *   GET  /api/public/review-qr/{code}  -> property/room names, rooms to pick from, the host's Google link
 *   POST /api/public/review-qr/{code}  -> { clientSubmissionId, rating, roomListingId?, comment?, guestName?, guestPhone? }
 * One clientSubmissionId is made per page load and reused for every POST, so tapping Google, sending and
 * changing the star all update ONE row on the server (later calls fill fields in and never blank them).
 */

const MAX_COMMENT = 2000;
const MAX_NAME = 100;
const MAX_PHONE = 32;

interface QrRoom {
  listingId: number;
  name: string;
}

interface QrConfig {
  propertyName: string;
  /** Set for a room code, null for a property code. */
  listingName: string | null;
  /** Non-empty only for a property code on a property with 2+ rooms. */
  rooms: QrRoom[];
  googleReviewUrl: string | null;
}

interface QrSubmitResult {
  googleReviewUrl: string | null;
  showsOnWebsite: boolean | null;
}

interface QrSubmitBody {
  clientSubmissionId: string;
  rating: number;
  roomListingId?: number;
  comment?: string;
  guestName?: string;
  guestPhone?: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "inactive" }
  | { kind: "error" }
  | { kind: "ready"; config: QrConfig };

type SentState = { kind: "low" } | { kind: "note"; showsOnWebsite: boolean };

type PostOutcome =
  | { ok: true; result: QrSubmitResult }
  | { ok: false; reason: "inactive" | "invalid" | "retry" };

/** The host's own link. Only http(s) ever reaches an href. */
function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const protocol = new URL(trimmed).protocol;
    return protocol === "https:" || protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

function parseConfig(data: unknown): QrConfig | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const rooms: QrRoom[] = [];
  if (Array.isArray(d.rooms)) {
    for (const raw of d.rooms) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const listingId = Number(r.listingId);
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (Number.isInteger(listingId) && listingId > 0 && name) rooms.push({ listingId, name });
    }
  }
  const listingName = typeof d.listingName === "string" ? d.listingName.trim() : "";
  return {
    propertyName: typeof d.propertyName === "string" ? d.propertyName.trim() : "",
    listingName: listingName || null,
    rooms,
    googleReviewUrl: d.hasGoogleReviewLink === false ? null : safeHttpUrl(d.googleReviewUrl),
  };
}

function parseSubmitResult(data: unknown): QrSubmitResult {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    googleReviewUrl: d.hasGoogleReviewLink === false ? null : safeHttpUrl(d.googleReviewUrl),
    showsOnWebsite: typeof d.showsOnWebsite === "boolean" ? d.showsOnWebsite : null,
  };
}

/**
 * `crypto.randomUUID()` exists only in secure contexts (https / localhost). A QR page opened over plain http
 * on a LAN host would otherwise have no submission id at all, so fall back to a v4 UUID built from
 * `getRandomValues`, and last of all `Math.random`.
 */
function newSubmissionId(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

const fieldClassName =
  "w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary";
const labelClassName = "block text-sm font-medium text-text-primary";
const optionalClassName = "font-normal text-text-muted";
const primaryButtonClassName =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60";
const panelClassName = "space-y-5 rounded-2xl border border-border-subtle bg-bg-surface p-5";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-testid="review-qr-page" className="min-h-screen px-4 py-8 sm:py-12">
      {/* A QR landing page is for the guest holding the phone: keep it out of search results. */}
      <SEO title={title} description="Tell us how your stay was." robots="noindex, nofollow" />
      <div className="mx-auto w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}

export default function ReviewQrPage() {
  const { tenantSlug = "", code = "" } = useParams<{ tenantSlug: string; code: string }>();

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  // The room is held as the <select>'s own string value and turned into a number only when sending.
  const [roomValue, setRoomValue] = useState("");
  // 1-3 stars: "What went wrong?". 4-5 stars: the website note. Separate boxes, so a typed complaint is never
  // quietly turned into a public note (or the other way round) when the guest changes the stars.
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");

  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState<SentState | null>(null);

  // One id per page load, reused for every POST (see the header comment).
  const submissionIdRef = useRef<string | null>(null);
  if (submissionIdRef.current === null) submissionIdRef.current = newSubmissionId();
  // True once any POST has been made under the current id (see postSubmission).
  const hasPostedRef = useRef(false);
  // True once a 1-3 star comment has been sent under the current id.
  const lowCommentSentRef = useRef(false);
  const thanksRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!code) {
      setLoad({ kind: "inactive" });
      return;
    }
    const controller = new AbortController();
    setLoad({ kind: "loading" });
    void (async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/public/review-qr/${encodeURIComponent(code)}`), {
          headers: { Accept: "application/json", ...getApiHeaders(tenantSlug) },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // An unknown or switched-off code is a 404; a malformed one is treated the same way.
        if (res.status === 404 || res.status === 400 || res.status === 410) {
          setLoad({ kind: "inactive" });
          return;
        }
        if (!res.ok) {
          setLoad({ kind: "error" });
          return;
        }
        const config = parseConfig(await res.json());
        if (controller.signal.aborted) return;
        if (!config) {
          setLoad({ kind: "error" });
          return;
        }
        setGoogleUrl(config.googleReviewUrl);
        setLoad({ kind: "ready", config });
      } catch {
        if (!controller.signal.aborted) setLoad({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [code, tenantSlug, reloadKey]);

  useEffect(() => {
    if (sent) thanksRef.current?.focus();
  }, [sent]);

  if (load.kind === "loading") {
    return (
      <Shell title="How was your stay?">
        <div role="status" data-testid="review-qr-loading" className="py-16 text-center text-sm text-text-secondary">
          Loading&hellip;
        </div>
      </Shell>
    );
  }

  if (load.kind === "inactive") {
    return (
      <Shell title="Review code not active">
        <div data-testid="review-qr-inactive" className="space-y-2 py-12 text-center">
          <p className="text-lg font-semibold text-text-primary">
            This review code is not active. Please ask the front desk.
          </p>
        </div>
      </Shell>
    );
  }

  if (load.kind === "error") {
    return (
      <Shell title="How was your stay?">
        <div data-testid="review-qr-load-error" role="alert" className="space-y-4 py-12 text-center">
          <p className="text-base text-text-primary">
            We couldn&apos;t load this page just now. Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className={`${primaryButtonClassName} mx-auto max-w-xs`}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const { config } = load;
  const propertyLine = [config.propertyName, config.listingName].filter(Boolean).join(" · ");

  /** What the guest has typed so far, in the shape the API takes. Anything empty is left out. */
  const buildBody = (ratingValue: number): QrSubmitBody => {
    const isLowRating = ratingValue <= 3;
    const body: QrSubmitBody = { clientSubmissionId: submissionIdRef.current as string, rating: ratingValue };
    const roomListingId = Number.parseInt(roomValue, 10);
    if (Number.isInteger(roomListingId) && roomListingId > 0) body.roomListingId = roomListingId;
    const text = (isLowRating ? comment : note).trim();
    if (text) body.comment = text.slice(0, MAX_COMMENT);
    const guestName = name.trim();
    if (guestName) body.guestName = guestName.slice(0, MAX_NAME);
    const guestPhone = phone.trim();
    if (isLowRating && guestPhone) body.guestPhone = guestPhone.slice(0, MAX_PHONE);
    return body;
  };

  const postSubmission = async (ratingValue: number): Promise<PostOutcome> => {
    if (ratingValue >= 4 && lowCommentSentRef.current) {
      // A "what went wrong" comment is already stored under this id and the server never blanks a stored comment.
      // Re-using the id for a 4-5 star rating would publish that complaint as a "Guest feedback" card. A fresh id
      // starts a fresh row; the complaint stays where it was sent, private.
      submissionIdRef.current = newSubmissionId();
      lowCommentSentRef.current = false;
      hasPostedRef.current = false;
    }
    const body = buildBody(ratingValue);
    // Marked when the request is made, not when it succeeds: a request still in flight (or lost on a bad connection)
    // may have reached the server, so a later change of star must follow it with an update to the same row.
    hasPostedRef.current = true;
    if (ratingValue <= 3 && body.comment) lowCommentSentRef.current = true;
    try {
      const res = await fetch(buildApiUrl(`/api/public/review-qr/${encodeURIComponent(code)}`), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...getApiHeaders(tenantSlug) },
        body: JSON.stringify(body),
      });
      if (res.status === 404) return { ok: false, reason: "inactive" };
      if (res.status === 400) return { ok: false, reason: "invalid" };
      if (!res.ok) return { ok: false, reason: "retry" };
      const result = parseSubmitResult(await res.json().catch(() => null));
      return { ok: true, result };
    } catch {
      return { ok: false, reason: "retry" };
    }
  };

  const applyResult = (result: QrSubmitResult) => {
    if (result.googleReviewUrl) setGoogleUrl(result.googleReviewUrl);
  };

  const showFailure = (reason: "inactive" | "invalid" | "retry") => {
    if (reason === "inactive") {
      // The code was switched off while the page was open: nothing can be saved against it any more.
      setLoad({ kind: "inactive" });
      return;
    }
    setMessage(
      reason === "invalid"
        ? "We couldn't save that. Please check what you entered and try again."
        : "We couldn't send that just now. Please check your connection and try again. What you typed is still here.",
    );
  };

  const handlePickStar = (value: number) => {
    if (sent || value === rating) return;
    setRating(value);
    setMessage(null);
    // Once something has been sent, a changed star updates that same row (same clientSubmissionId).
    if (hasPostedRef.current) {
      void (async () => {
        const outcome = await postSubmission(value);
        if (outcome.ok) applyResult(outcome.result);
        else showFailure(outcome.reason);
      })();
    }
  };

  /**
   * Any tap on a Google link. The link is a real anchor (target=_blank), so the browser opens Google by itself;
   * this only saves what the guest has so far and never waits for the answer or holds the link back.
   */
  const handleGoogleTap = () => {
    if (rating < 1) return;
    void (async () => {
      const outcome = await postSubmission(rating);
      if (outcome.ok) applyResult(outcome.result);
      else showFailure(outcome.reason);
    })();
  };

  const submitAndFinish = async (finish: (result: QrSubmitResult) => SentState) => {
    setPosting(true);
    setMessage(null);
    const outcome = await postSubmission(rating);
    setPosting(false);
    if (!outcome.ok) {
      showFailure(outcome.reason);
      return;
    }
    applyResult(outcome.result);
    setSent(finish(outcome.result));
  };

  const handleSendToOwner = async (event: FormEvent) => {
    event.preventDefault();
    if (posting) return;
    if (!comment.trim() && !phone.trim()) {
      setMessage("Please tell us what went wrong, or leave your phone number, so the owner can help.");
      return;
    }
    await submitAndFinish(() => ({ kind: "low" }));
  };

  const handlePostNote = async (event: FormEvent) => {
    event.preventDefault();
    if (posting) return;
    if (!note.trim()) {
      setMessage("Please write a short note first.");
      return;
    }
    await submitAndFinish((result) => ({ kind: "note", showsOnWebsite: result.showsOnWebsite !== false }));
  };

  const isLow = rating >= 1 && rating <= 3;
  const isHigh = rating >= 4;
  const activeStars = hoverRating || rating;

  const errorBlock = message ? (
    <p
      role="alert"
      data-testid="review-qr-error"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </p>
  ) : null;

  const nameField = (
    <div className="space-y-1.5">
      <label htmlFor="review-qr-name" className={labelClassName}>
        Your name <span className={optionalClassName}>(optional)</span>
      </label>
      <input
        id="review-qr-name"
        data-testid="review-qr-name"
        type="text"
        autoComplete="name"
        maxLength={MAX_NAME}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={fieldClassName}
      />
    </div>
  );

  /** 1-3 stars: a readable link in the open, next to the private form. Never behind a toggle or behind sending. */
  const googleSecondaryLink = googleUrl ? (
    <div className="space-y-1 border-t border-border-subtle pt-4 text-center">
      <p className="text-sm text-text-secondary">Prefer to post publicly?</p>
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleGoogleTap}
        data-testid="review-qr-google-link"
        className="inline-flex min-h-11 items-center text-base font-semibold text-text-primary underline underline-offset-4"
      >
        Post a public review on Google
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  ) : null;

  /** 4-5 stars: the big primary button. */
  const googleCta = googleUrl ? (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleGoogleTap}
      data-testid="review-qr-google-cta"
      className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <span>Post on Google</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : null;

  const lowPanel = (
    <section
      data-testid="review-qr-low-form"
      aria-labelledby="review-qr-low-heading"
      className={panelClassName}
    >
      <div className="space-y-1">
        <h2 id="review-qr-low-heading" className="text-xl font-bold text-text-primary">
          Sorry your stay wasn&apos;t perfect.
        </h2>
        <p className="text-base text-text-secondary">Tell us what went wrong &mdash; the owner will contact you.</p>
      </div>
      <form onSubmit={handleSendToOwner} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="review-qr-comment" className={labelClassName}>
            What went wrong?
          </label>
          <textarea
            id="review-qr-comment"
            data-testid="review-qr-comment"
            rows={4}
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${fieldClassName} resize-none`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="review-qr-phone" className={labelClassName}>
            Your phone number <span className={optionalClassName}>(optional)</span> &mdash; so the owner can call you back
          </label>
          <input
            id="review-qr-phone"
            data-testid="review-qr-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={MAX_PHONE}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClassName}
          />
        </div>
        {nameField}
        {errorBlock}
        <button
          type="submit"
          data-testid="review-qr-send"
          disabled={posting}
          aria-busy={posting}
          className={primaryButtonClassName}
        >
          {posting ? "Sending…" : "Send to the owner"}
        </button>
      </form>
      {googleSecondaryLink}
    </section>
  );

  const highPanel = (
    <section data-testid="review-qr-high" aria-labelledby="review-qr-high-heading" className={panelClassName}>
      <div className="space-y-1 text-center">
        <h2 id="review-qr-high-heading" className="text-2xl font-bold text-text-primary">
          Thank you!
        </h2>
        <p className="text-base text-text-secondary">We&apos;re so glad you enjoyed your stay.</p>
      </div>
      {googleCta}
      <form
        onSubmit={handlePostNote}
        noValidate
        className={`space-y-4 ${googleCta ? "border-t border-border-subtle pt-5" : ""}`}
      >
        <div className="space-y-1.5">
          <label htmlFor="review-qr-note" className={labelClassName}>
            Leave a note on our website too <span className={optionalClassName}>(optional)</span>
          </label>
          <textarea
            id="review-qr-note"
            data-testid="review-qr-note"
            rows={3}
            maxLength={MAX_COMMENT}
            aria-describedby="review-qr-note-help"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${fieldClassName} resize-none`}
          />
          <p id="review-qr-note-help" className="text-xs text-text-muted">
            Your note will be shown on our website, with your first name if you add one.
          </p>
        </div>
        {nameField}
        {errorBlock}
        <button
          type="submit"
          data-testid="review-qr-note-submit"
          disabled={posting}
          aria-busy={posting}
          className={primaryButtonClassName}
        >
          {posting ? "Posting…" : "Post note"}
        </button>
      </form>
    </section>
  );

  const thanksPanel = sent ? (
    <section
      ref={thanksRef}
      tabIndex={-1}
      data-testid="review-qr-thanks"
      aria-live="polite"
      className={`${panelClassName} text-center focus:outline-none`}
    >
      <p className="text-lg font-semibold text-text-primary">
        {sent.kind === "low"
          ? "Thank you. The owner has your feedback and will contact you."
          : sent.showsOnWebsite
            ? "Thanks! Your note will appear on our website."
            : "Thanks! The owner has your note."}
      </p>
      {sent.kind === "low" ? googleSecondaryLink : googleCta}
    </section>
  ) : null;

  const showRoomPicker = config.rooms.length > 1 && !sent;

  return (
    <Shell title={config.propertyName ? `How was your stay? | ${config.propertyName}` : "How was your stay?"}>
      <header className="space-y-2 text-center">
        {propertyLine ? (
          <p data-testid="review-qr-property" className="text-base font-semibold text-text-secondary">
            {propertyLine}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold text-text-primary">How was your stay?</h1>
      </header>

      <div className="space-y-2 text-center">
        <div role="group" aria-label="Your rating" className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              data-testid={`review-qr-star-${value}`}
              aria-label={`Overall rating: ${value} of 5 stars`}
              aria-pressed={value === rating}
              disabled={sent !== null}
              onClick={() => handlePickStar(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="flex h-12 w-12 items-center justify-center rounded-full text-4xl leading-none transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:hover:scale-100 sm:h-14 sm:w-14 sm:text-5xl"
            >
              <span className={value <= activeStars ? "text-amber-400" : "text-gray-300"} aria-hidden="true">
                ★
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-text-secondary" aria-live="polite">
          {rating ? `Selected: ${rating} of 5` : "Tap a star to rate your stay"}
        </p>
      </div>

      {showRoomPicker ? (
        <div className="space-y-1.5">
          <label htmlFor="review-qr-room" className={labelClassName}>
            Which room did you stay in? <span className={optionalClassName}>(optional)</span>
          </label>
          <select
            id="review-qr-room"
            data-testid="review-qr-room-select"
            value={roomValue}
            onChange={(e) => setRoomValue(e.target.value)}
            className={fieldClassName}
          >
            <option value="">Choose a room</option>
            {config.rooms.map((room) => (
              <option key={room.listingId} value={String(room.listingId)}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {thanksPanel}
      {!sent && isLow ? lowPanel : null}
      {!sent && isHigh ? highPanel : null}
    </Shell>
  );
}
