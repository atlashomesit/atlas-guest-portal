import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { buildApiUrl, getApiHeaders } from "../api/client";

export interface SavedPriceAlert {
  id: string;
  listingId: number;
  listingName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  baselineTotalInr: number;
  channel: "email" | "whatsapp";
  email?: string;
  phone?: string;
  consentGranted: boolean;
  createdAtUtc: string;
}

const STORAGE_KEY = "atlas_guest_price_alerts_v1";

export function loadPriceAlerts(): SavedPriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePriceAlerts(alerts: SavedPriceAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore storage quota errors
  }
}

function defaultDateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export interface PriceDropAlertControlProps {
  listingId: number;
  listingName: string;
  nightlyRateInr: number;
  maxGuests?: number;
  initialEmail?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

export const PriceDropAlertControl: React.FC<PriceDropAlertControlProps> = ({
  listingId,
  listingName,
  nightlyRateInr,
  maxGuests = 6,
  initialEmail = "",
  initialCheckIn,
  initialCheckOut,
  initialGuests = 2,
}) => {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<SavedPriceAlert[]>(() => loadPriceAlerts());
  const activeAlert = useMemo(
    () => alerts.find((a) => a.listingId === listingId) ?? null,
    [alerts, listingId],
  );

  const [checkIn, setCheckIn] = useState(initialCheckIn || defaultDateOffset(7));
  const [checkOut, setCheckOut] = useState(initialCheckOut || defaultDateOffset(9));
  const [guests, setGuests] = useState(Math.max(1, Math.min(maxGuests || 6, initialGuests)));
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail && !email) setEmail(initialEmail);
  }, [initialEmail, email]);

  const nights = nightsBetween(checkIn, checkOut);
  const baselineTotalInr = Math.max(0, Math.round(nightlyRateInr * nights));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (channel === "whatsapp" && phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit WhatsApp number.");
      return;
    }
    if (!consent) {
      setError("Please confirm opt-in consent to receive price-drop alerts.");
      return;
    }

    setSubmitting(true);
    let serverId = `local-${listingId}-${Date.now()}`;
    try {
      const res = await fetch(buildApiUrl("/api/guest-price-alerts"), {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          checkIn,
          checkOut,
          guests,
          baselineTotalInr,
          channel,
          email: channel === "email" ? email.trim() : undefined,
          phone: channel === "whatsapp" ? phone.trim() : undefined,
          consentGranted: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { id?: string | number } | null;
        if (data?.id != null) serverId = String(data.id);
      }
    } catch {
      // Fall back to local persistence when API is unavailable
    } finally {
      setSubmitting(false);
    }

    const nextAlert: SavedPriceAlert = {
      id: serverId,
      listingId,
      listingName,
      checkIn,
      checkOut,
      guests,
      baselineTotalInr,
      channel,
      email: channel === "email" ? email.trim() : undefined,
      phone: channel === "whatsapp" ? phone.trim() : undefined,
      consentGranted: true,
      createdAtUtc: new Date().toISOString(),
    };
    const updated = [...alerts.filter((a) => a.listingId !== listingId), nextAlert];
    setAlerts(updated);
    savePriceAlerts(updated);
    setOpen(false);
  };

  const handleRemove = async () => {
    if (!activeAlert) return;
    setSubmitting(true);
    try {
      if (!activeAlert.id.startsWith("local-")) {
        await fetch(buildApiUrl(`/api/guest-price-alerts/${encodeURIComponent(activeAlert.id)}`), {
          method: "DELETE",
          headers: getApiHeaders(),
        });
      }
    } catch {
      // best effort
    } finally {
      setSubmitting(false);
    }
    const updated = alerts.filter((a) => a.listingId !== listingId);
    setAlerts(updated);
    savePriceAlerts(updated);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        data-testid={`price-alert-toggle-${listingId}`}
        aria-pressed={Boolean(activeAlert)}
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          activeAlert
            ? "border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-border-subtle bg-bg-surface text-text-primary hover:bg-bg-muted"
        }`}
      >
        {activeAlert ? <BellRing className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        <span>{activeAlert ? "Tracking price" : "Track price"}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`price-alert-title-${listingId}`}
          data-testid={`price-alert-modal-${listingId}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-bg-surface p-5 shadow-xl border border-border-subtle space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`price-alert-title-${listingId}`} className="text-base font-bold text-text-primary">
                  Price-drop alert
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">{listingName}</p>
              </div>
              <button
                type="button"
                aria-label="Close price alert modal"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeAlert ? (
              <div className="space-y-4" data-testid="price-alert-active-summary">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">Alert active for {activeAlert.checkIn} to {activeAlert.checkOut}</p>
                  <p>
                    {activeAlert.guests} guest{activeAlert.guests === 1 ? "" : "s"} · Baseline: ₹
                    {activeAlert.baselineTotalInr.toLocaleString("en-IN")}
                  </p>
                  <p>
                    Notify via {activeAlert.channel === "whatsapp" ? `WhatsApp (${activeAlert.phone})` : `Email (${activeAlert.email})`} when price drops 5% or more.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    data-testid="price-alert-remove-btn"
                    disabled={submitting}
                    onClick={handleRemove}
                    className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Stop tracking
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-text-secondary">
                    Check-in
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      data-testid="price-alert-checkin"
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-2 text-sm text-text-primary"
                      required
                    />
                  </label>
                  <label className="block text-xs font-medium text-text-secondary">
                    Check-out
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      data-testid="price-alert-checkout"
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-2 text-sm text-text-primary"
                      required
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-medium text-text-secondary flex-1">
                    Guests
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, maxGuests)}
                      value={guests}
                      onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                      data-testid="price-alert-guests"
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-2 text-sm text-text-primary"
                    />
                  </label>
                  {baselineTotalInr > 0 && (
                    <div className="text-right pt-4">
                      <div className="text-[11px] text-text-muted">Current est. ({nights}n)</div>
                      <div className="text-sm font-bold text-text-primary">
                        ₹{baselineTotalInr.toLocaleString("en-IN")}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2" role="radiogroup" aria-label="Notification channel">
                  <button
                    type="button"
                    data-testid="price-alert-channel-email"
                    onClick={() => setChannel("email")}
                    className={`flex-1 min-h-10 rounded-lg border text-xs font-semibold ${
                      channel === "email"
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-subtle text-text-secondary"
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    data-testid="price-alert-channel-whatsapp"
                    onClick={() => setChannel("whatsapp")}
                    className={`flex-1 min-h-10 rounded-lg border text-xs font-semibold ${
                      channel === "whatsapp"
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-subtle text-text-secondary"
                    }`}
                  >
                    WhatsApp
                  </button>
                </div>

                {channel === "email" ? (
                  <label className="block text-xs font-medium text-text-secondary">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      data-testid="price-alert-email-input"
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
                      required
                    />
                  </label>
                ) : (
                  <label className="block text-xs font-medium text-text-secondary">
                    WhatsApp number
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      data-testid="price-alert-phone-input"
                      className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
                      required
                    />
                  </label>
                )}

                <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    data-testid="price-alert-consent-checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border-subtle"
                  />
                  <span>
                    I opt in to receive a one-time {channel === "whatsapp" ? "WhatsApp" : "email"} alert when the rate
                    drops by 5% or more. Unsubscribe anytime.
                  </span>
                </label>

                {error && (
                  <p role="alert" className="text-xs font-medium text-red-600" data-testid="price-alert-error">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="price-alert-submit-btn"
                    className="min-h-11 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save alert"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
