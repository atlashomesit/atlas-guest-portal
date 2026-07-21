import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "@/api/client";
import { formatDisplayNumber, getContactEmail, getWhatsAppLink } from "@/config/contact";
import SEO from "@/components/SEO";
import { getTenantBrandName } from "@/tenant/displayBrand";
import { messageFromApiResponse } from "@/utils/serverErrorFromResponse";

/**
 * Landing page after one-click unsubscribe from marketing email (API redirects here).
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
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
          <h1 className="text-xl font-bold text-text-primary mb-4">Communication preferences</h1>
          {error && <p className="text-support-error text-sm mb-3">{error}</p>}
          {saved && <p className="text-support-success text-sm mb-3">Preferences updated.</p>}
          {loading ? (
            <p className="text-text-muted text-sm">Loading...</p>
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
