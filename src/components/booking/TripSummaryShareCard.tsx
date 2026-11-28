import React, { useState } from "react";
import { api } from "../../api/client";

export interface TripSummaryShareCardProps {
  bookingId: number | string;
  token?: string | null;
  propertyName?: string | null;
  initialShareToken?: string | null;
}

export const TripSummaryShareCard: React.FC<TripSummaryShareCardProps> = ({
  bookingId,
  token,
  propertyName,
  initialShareToken = null,
}) => {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/trip-summary/${encodeURIComponent(shareToken)}`
      : shareToken
        ? `/trip-summary/${encodeURIComponent(shareToken)}`
        : null;

  const handleGenerate = async () => {
    setBusy(true);
    setErrorMsg(null);
    setCopied(false);
    try {
      const res = await api.post<{
        shareToken?: string;
        tripSummaryShareToken?: string;
        token?: string;
      }>(
        `/public/bookings/${bookingId}/trip-summary-link`,
        {},
        { params: token ? { t: token } : undefined },
      );
      const nextToken: string | undefined =
        res?.data?.shareToken ?? res?.data?.tripSummaryShareToken ?? res?.data?.token;
      if (nextToken) {
        setShareToken(nextToken);
      } else {
        setErrorMsg("Could not create a share link right now.");
      }
    } catch {
      setErrorMsg("Could not create a share link right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setErrorMsg(null);
    setCopied(false);
    try {
      await api.delete(`/public/bookings/${bookingId}/trip-summary-link`, {
        params: token ? { t: token } : undefined,
      });
      setShareToken(null);
    } catch {
      setErrorMsg("Could not disable the link right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const whatsappHref = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Here are the address, map directions, and stay dates for ${propertyName || "my stay"}: ${shareUrl}`,
      )}`
    : null;

  return (
    <div
      data-testid="trip-summary-share-card"
      className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Share trip summary (hides codes &amp; prices)
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Safe to send to cab drivers, family, or your travel desk — only shares address, map, dates, and host phone.
          </p>
        </div>
        {!shareUrl && (
          <button
            type="button"
            disabled={busy}
            onClick={handleGenerate}
            data-testid="trip-summary-generate-btn"
            className="min-h-[44px] rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 transition"
          >
            {busy ? "Creating link…" : "Share trip summary (hides codes & prices)"}
          </button>
        )}
      </div>

      {shareUrl && (
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
          <div
            data-testid="trip-summary-share-url"
            className="rounded-lg bg-bg-page border border-border-subtle px-3 py-2 text-xs text-text-primary break-all"
          >
            {shareUrl}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              data-testid="trip-summary-copy-btn"
              className="min-h-[44px] rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-95 transition"
            >
              {copied ? "✓ Copied link" : "Copy link"}
            </button>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="trip-summary-whatsapp-btn"
                className="min-h-[44px] inline-flex items-center rounded-xl border border-border-subtle bg-bg-page px-4 py-2 text-xs font-semibold text-text-primary hover:border-brand-primary transition"
              >
                Share on WhatsApp
              </a>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleDisable}
              data-testid="trip-summary-disable-btn"
              className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition"
            >
              Disable link
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <p data-testid="trip-summary-share-error" className="mt-2 text-xs text-red-600">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

export default TripSummaryShareCard;
