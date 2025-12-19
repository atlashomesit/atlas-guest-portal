import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";

import { submitCallbackRequest } from "./callbackService";

interface Props {
  open: boolean;
  onClose: () => void;
  route: string;
  unitCode?: string | null;
  source?: string;
}

const PHONE_MASK = /[^0-9+\-\s]/g;

const CallbackRequestBar = ({ open, onClose, route, unitCode, source = "support_launcher" }: Props) => {
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const buttonLabel = useMemo(() => {
    if (status === "sending") return "Requesting...";
    if (status === "success") return "Callback queued";
    return "Request callback";
  }, [status]);

  useEffect(() => {
    if (!open) {
      setPhone("");
      setNote("");
      setStatus("idle");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const sanitizedPhone = phone.replace(PHONE_MASK, "").trim();
    if (!sanitizedPhone) {
      setError("Add a phone number so we can reach you.");
      return;
    }

    try {
      setStatus("sending");
      await submitCallbackRequest({
        phone: sanitizedPhone,
        note: note.trim() || undefined,
        route,
        unitCode,
        source,
      });
      setStatus("success");
      setTimeout(() => onClose(), 1600);
    } catch (err) {
      console.error("[callback] request failed", err);
      setStatus("error");
      setError("Could not send the request. Try again or WhatsApp us instead.");
    }
  };

  const bottomSpacing = "calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 1rem)";

  return (
    <div
      className="fixed inset-x-4 z-[var(--z-floating)] md:inset-x-auto md:right-5 md:left-auto"
      style={{ bottom: bottomSpacing }}
      role="dialog"
      aria-label="Callback request"
      aria-live="polite"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-[color-mix(in_srgb,var(--bg-surface)_96%,white)] px-4 py-3 shadow-level2 backdrop-blur md:min-w-[380px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-text-primary">Prefer a callback?</p>
            <p className="text-xs text-text-muted">Share your number and we&apos;ll ring you within a few minutes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
            aria-label="Close callback bar"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-text-primary" htmlFor="callback-phone">
            Phone number
          </label>
          <input
            id="callback-phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary shadow-inner focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-text-primary" htmlFor="callback-notes">
            Notes (optional)
          </label>
          <textarea
            id="callback-notes"
            name="notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[70px] w-full resize-none rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary shadow-inner focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="Share a time window or details about your booking"
          />
        </div>

        {error && <div className="text-xs font-semibold text-support-error">{error}</div>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 transition hover:bg-cta-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
          >
            {status === "success" ? <FiCheck aria-hidden="true" /> : null}
            {buttonLabel}
          </button>
          {status === "error" ? (
            <button
              type="button"
              className="rounded-full px-3 py-2 text-xs font-semibold text-text-muted underline underline-offset-2"
              onClick={onClose}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
};

export default CallbackRequestBar;
