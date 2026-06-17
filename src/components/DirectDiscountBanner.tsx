/**
 * TASK-1708: Direct booking discount nudge banner.
 *
 * Shown when the user's traffic is direct (no OTA UTM source detected).
 * Promotes the DIRECT5 promo code — 5% off for direct bookings.
 * The code is injected via ?promo=DIRECT5 URL param when the user clicks
 * "Book now", which UnitBookingWidget picks up and auto-fills.
 */

import { useEffect, useState } from "react";

const PROMO_CODE = "DIRECT5";
const OTA_UTM_SOURCES = ["booking.com", "airbnb", "makemytrip", "mmt", "goibibo", "agoda", "expedia", "tripadvisor"];
const DISMISS_KEY = "directDiscountBannerDismissed";

function isDirectTraffic(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = (params.get("utm_source") || "").toLowerCase();
    if (OTA_UTM_SOURCES.some((ota) => utmSource.includes(ota))) return false;

    // Also check referrer
    const ref = document.referrer.toLowerCase();
    if (OTA_UTM_SOURCES.some((ota) => ref.includes(ota))) return false;

    return true;
  } catch {
    return true; // assume direct if we can't check
  }
}

export default function DirectDiscountBanner() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isDirectTraffic()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch { /* ignore */ }
    setVisible(true);
  }, []);

  function handleDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(PROMO_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback: select text
    });
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Direct booking discount"
      className="relative flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-lg">🎁</span>
        <span className="font-semibold">You&apos;re booking direct — save 5%!</span>
        <span className="text-emerald-700">Use code</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-mono font-bold tracking-widest text-emerald-700 ring-1 ring-emerald-300 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
          aria-label={`Copy promo code ${PROMO_CODE}`}
          title="Click to copy"
        >
          {PROMO_CODE}
          <span className="ml-1 text-xs font-normal text-emerald-700">{copied ? "Copied!" : "Copy"}</span>
        </button>
        <span className="text-xs text-emerald-800">at checkout — auto-applied when you tap "Book now"</span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-auto flex-shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded text-emerald-600 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
        aria-label="Dismiss direct discount banner"
      >
        ✕
      </button>
    </div>
  );
}
