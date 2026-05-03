import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildApiUrl } from "@/api/client";
import { messageFromApiResponse } from "@/utils/serverErrorFromResponse";

/**
 * Landing page after one-click unsubscribe from marketing email (API redirects here).
 */
export default function CommunicationPreferences() {
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
      headers: { Accept: "application/json" },
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
        setError(
          e instanceof Error && e.message
            ? e.message
            : "Could not load preferences. Use the link from your email.",
        );
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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save preferences.");
    } finally {
      setLoading(false);
    }
  };

  if (unsubscribed === "1") {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
          <h1 className="text-xl font-bold text-text-primary mb-3">Preferences updated</h1>
          <p className="text-text-secondary leading-relaxed">
            You have been unsubscribed from marketing messages
            {channel ? ` on ${channel}` : ""}. Transactional messages about your bookings may still be sent where required.
          </p>
        </div>
      </div>
    );
  }

  if (guestToken) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
          <h1 className="text-xl font-bold text-text-primary mb-4">Communication preferences</h1>
          {error && <p className="text-support-error text-sm mb-3">{error}</p>}
          {saved && <p className="text-support-success text-sm mb-3">Preferences updated.</p>}
          {loading ? (
            <p className="text-text-muted text-sm">Loading...</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input type="checkbox" checked disabled className="h-4 w-4" />
                <span>Transactional messages (required)</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.checkInCheckoutReminders}
                  onChange={(e) => setForm((f) => ({ ...f, checkInCheckoutReminders: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span>Check-in/check-out reminders</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.postStayReviewRequest}
                  onChange={(e) => setForm((f) => ({ ...f, postStayReviewRequest: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span>Post-stay review requests</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.promotionalOffers}
                  onChange={(e) => setForm((f) => ({ ...f, promotionalOffers: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span>Promotional offers</span>
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
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5">
        <h1 className="text-xl font-bold text-text-primary mb-3">Communication preferences</h1>
        <p className="text-text-muted text-sm">Use the link from your email to update marketing preferences.</p>
      </div>
    </div>
  );
}
