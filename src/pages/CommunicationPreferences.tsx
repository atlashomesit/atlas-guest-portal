import React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "@/api/client";
import { formatDisplayNumber, getContactEmail, getWhatsAppLink } from "@/config/contact";
import SEO from "@/components/SEO";
import { LoadingState } from "@/components/LoadingState";
import { getTenantBrandName } from "@/tenant/displayBrand";
import { messageFromApiResponse } from "@/utils/serverErrorFromResponse";

type PurposeRow = {
  purpose: string;
  label: string;
  displayText: string;
  isGranted: boolean;
  canWithdraw: boolean;
};

/**
 * Landing page after one-click unsubscribe from marketing email (API redirects here).
 * TASK-5138: also lists itemized DPDP consent purposes with one-tap withdrawal.
 */
export default function CommunicationPreferences() {
  const brandName = getTenantBrandName();
  const { guestToken } = useParams();
  const [params] = useSearchParams();
  const unsubscribed = params.get("unsubscribed");
  const channel = params.get("channel");
  const [loading, setLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [consentLoading, setConsentLoading] = React.useState(false);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const [consentSaved, setConsentSaved] = React.useState<string | null>(null);
  const [purposes, setPurposes] = React.useState<PurposeRow[]>([]);
  const [form, setForm] = React.useState({
    transactional: true,
    checkInCheckoutReminders: true,
    postStayReviewRequest: true,
    promotionalOffers: false,
  });

  React.useEffect(() => {
    if (!guestToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(buildApiUrl(`/api/public/communication-preferences/preferences/${encodeURIComponent(guestToken)}`), {
      headers: { Accept: "application/json", ...getApiHeaders() },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setForm({
          transactional: !!data.transactional,
          checkInCheckoutReminders: !!data.checkInCheckoutReminders,
          postStayReviewRequest: !!data.postStayReviewRequest,
          promotionalOffers: !!data.promotionalOffers,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Communication preferences load failed:", e);
        setError("We couldn't load your preferences. Please use the link from your booking email or SMS.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [guestToken]);

  React.useEffect(() => {
    if (!guestToken) return;
    let cancelled = false;
    setConsentLoading(true);
    setConsentError(null);
    fetch(buildApiUrl(`/api/public/guest-consent/${encodeURIComponent(guestToken)}`), {
      headers: { Accept: "application/json", ...getApiHeaders() },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.purposes) ? data.purposes : [];
        setPurposes(rows.filter((p: PurposeRow) => p.purpose !== "id_scan"));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Consent status load failed:", e);
        setConsentError("We couldn't load your consent choices right now.");
      })
      .finally(() => {
        if (!cancelled) setConsentLoading(false);
      });
    return () => { cancelled = true; };
  }, [guestToken]);

  const onSave = async () => {
    if (!guestToken) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(buildApiUrl(`/api/public/communication-preferences/preferences/${encodeURIComponent(guestToken)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      setSaved(true);
    } catch (e: unknown) {
      console.error("Communication preferences save failed:", e);
      setError("We couldn't save your preferences right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const withdrawPurpose = async (purpose: string) => {
    if (!guestToken) return;
    setConsentError(null);
    setConsentSaved(null);
    try {
      const res = await fetch(buildApiUrl(`/api/public/guest-consent/${encodeURIComponent(guestToken)}/withdraw`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
        body: JSON.stringify({ purpose }),
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      setPurposes((prev) =>
        prev.map((p) => (p.purpose === purpose ? { ...p, isGranted: false } : p))
      );
      setConsentSaved(purpose);
    } catch (e: unknown) {
      console.error("Consent withdrawal failed:", e);
      setConsentError("We couldn't withdraw that consent right now. Please try again.");
    }
  };

  if (unsubscribed === "1") {
    const channelLabel =
      channel === "whatsapp"
        ? "WhatsApp"
        : channel === "sms"
          ? "SMS"
          : channel === "email"
            ? "email"
            : channel ?? "";
    return (
      <>
      <SEO title={`Preferences updated | ${brandName}`} description={`Marketing preferences for ${brandName} guests.`} />
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
          <h1 className="text-xl font-bold text-text-primary mb-3">Preferences updated</h1>
          <p className="text-text-secondary leading-relaxed">
            You have been unsubscribed from marketing messages
            {channelLabel ? ` on ${channelLabel}` : ""}. Transactional messages about your bookings may still be sent where required.
          </p>
          {channel === "whatsapp" && (
            <p className="text-text-muted text-sm mt-3 leading-relaxed">
              This also stops promotional WhatsApp messages and post-stay review requests on WhatsApp.
            </p>
          )}
        </div>
      </div>
      </>
    );
  }

  if (guestToken) {
    return (
      <>
      <SEO title={`Communication preferences | ${brandName}`} description={`Manage email and WhatsApp preferences for ${brandName}.`} />
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
          <h1 className="text-xl font-bold text-text-primary mb-4">Communication preferences</h1>
          {error && <p className="text-support-error text-sm mb-3">{error}</p>}
          {saved && <p className="text-support-success text-sm mb-3">Preferences updated.</p>}
          {loading ? (
            <LoadingState kind="skeleton-form" message="Loading preferences…" />
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 min-h-11 cursor-pointer text-sm text-text-secondary py-1 -my-1">
                <input type="checkbox" checked disabled className="h-5 w-5 min-h-[24px] min-w-[24px] shrink-0 accent-[color:var(--cta-primary)]" />
                <span>Transactional messages (required)</span>
              </label>
              <label className="flex items-center gap-3 min-h-11 cursor-pointer text-sm text-text-secondary py-1 -my-1">
                <input
                  type="checkbox"
                  checked={form.checkInCheckoutReminders}
                  onChange={(e) => setForm((f) => ({ ...f, checkInCheckoutReminders: e.target.checked }))}
                  className="h-5 w-5 min-h-[24px] min-w-[24px] shrink-0 accent-[color:var(--cta-primary)]"
                />
                <span>Check-in/check-out reminders</span>
              </label>
              <label className="flex items-start gap-3 min-h-11 cursor-pointer text-sm text-text-secondary py-1 -my-1">
                <input
                  type="checkbox"
                  checked={form.postStayReviewRequest}
                  onChange={(e) => setForm((f) => ({ ...f, postStayReviewRequest: e.target.checked }))}
                  className="h-5 w-5 min-h-[24px] min-w-[24px] shrink-0 accent-[color:var(--cta-primary)] mt-0.5"
                  data-testid="whatsapp-messages-toggle"
                />
                <span>
                  WhatsApp messages
                  <span className="block text-text-muted text-xs mt-0.5 leading-snug">
                    Post-stay review requests and promotional offers on WhatsApp. Turn off to stop all marketing WhatsApp from {brandName}.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 min-h-11 cursor-pointer text-sm text-text-secondary py-1 -my-1">
                <input
                  type="checkbox"
                  checked={form.promotionalOffers}
                  onChange={(e) => setForm((f) => ({ ...f, promotionalOffers: e.target.checked }))}
                  className="h-5 w-5 min-h-[24px] min-w-[24px] shrink-0 accent-[color:var(--cta-primary)] mt-0.5"
                />
                <span>
                  Promotional offers (email &amp; SMS)
                  <span className="block text-text-muted text-xs mt-0.5 leading-snug">
                    Deals and seasonal offers by email and SMS. WhatsApp marketing is controlled by the WhatsApp toggle above.
                  </span>
                </span>
              </label>
              <button
                onClick={onSave}
                disabled={loading}
                className="mt-2 rounded-full bg-[color:var(--cta-primary)] px-5 py-3 text-sm font-semibold text-white shadow-level1 transition hover:opacity-90 disabled:opacity-60 w-fit"
              >
                Save preferences
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5" data-testid="dpdp-consent-purposes">
          <h2 className="text-lg font-bold text-text-primary mb-2">Your consent choices (DPDP)</h2>
          <p className="text-text-secondary text-sm mb-4 leading-relaxed">
            Withdrawing a purpose stops future processing tied to it. Booking contact consent cannot be withdrawn while you have an active stay.
          </p>
          {consentError && <p className="text-support-error text-sm mb-3">{consentError}</p>}
          {consentSaved && (
            <p className="text-support-success text-sm mb-3">Consent withdrawn — it will apply to the next message we send.</p>
          )}
          {consentLoading ? (
            <LoadingState kind="skeleton-form" message="Loading consent status…" />
          ) : (
            <ul className="flex flex-col gap-3">
              {purposes.map((p) => (
                <li key={p.purpose} className="rounded-xl border border-border-subtle p-3 text-sm">
                  <div className="font-medium text-text-primary">{p.label}</div>
                  <p className="text-text-muted text-xs mt-1 leading-snug">{p.displayText}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${p.isGranted ? "text-support-success" : "text-text-muted"}`}>
                      {p.isGranted ? "Granted" : "Withdrawn"}
                    </span>
                    {p.isGranted && p.canWithdraw && (
                      <button
                        type="button"
                        onClick={() => void withdrawPurpose(p.purpose)}
                        className="text-xs font-semibold text-brand-primary underline underline-offset-2"
                        data-testid={`withdraw-consent-${p.purpose}`}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-text-muted text-xs mt-4">
            <Link to={`/my-data/${guestToken}`} className="text-brand-primary underline underline-offset-2">
              View or correct your data
            </Link>
          </p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <SEO title={`Communication preferences | ${brandName}`} description={`Manage how ${brandName} contacts you about bookings and offers.`} />
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5 space-y-4">
        <h1 className="text-xl font-bold text-text-primary">Communication preferences</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Open the secure link from your booking confirmation email or SMS — it contains your personal
          preferences token. You can also reach it from{' '}
          <Link to="/my-bookings" className="text-brand-primary underline underline-offset-2">
            My bookings
          </Link>
          ,{' '}
          <Link to="/favorites" className="text-brand-primary underline underline-offset-2">
            Saved homes
          </Link>
          , or your booking confirmation after you follow a booking link.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">
          Need help opting out? WhatsApp us at{' '}
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary underline underline-offset-2"
          >
            {formatDisplayNumber()}
          </a>{' '}
          or email{' '}
          <a href={`mailto:${getContactEmail()}`} className="text-brand-primary underline underline-offset-2">
            {getContactEmail()}
          </a>
          .
        </p>
      </div>
    </div>
    </>
  );
}
