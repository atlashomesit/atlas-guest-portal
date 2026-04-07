import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildApiUrl } from "@/api/client";

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
        if (!res.ok) throw new Error("Invalid or expired preferences link.");
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
        setError(e instanceof Error ? e.message : "Failed to load preferences.");
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
      if (!res.ok) throw new Error("Could not save preferences.");
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save preferences.");
    } finally {
      setLoading(false);
    }
  };

  if (unsubscribed === "1") {
    return (
      <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Preferences updated</h1>
        <p style={{ color: "#374151", lineHeight: 1.6 }}>
          You have been unsubscribed from marketing messages
          {channel ? ` on ${channel}` : ""}. Transactional messages about your bookings may still be sent where required.
        </p>
      </div>
    );
  }

  if (guestToken) {
    return (
      <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Communication preferences</h1>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        {saved && <p style={{ color: "#065f46" }}>Preferences updated.</p>}
        {loading ? (
          <p style={{ color: "#6b7280" }}>Loading...</p>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              <input type="checkbox" checked disabled /> Transactional messages (required)
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={form.checkInCheckoutReminders}
                onChange={(e) => setForm((f) => ({ ...f, checkInCheckoutReminders: e.target.checked }))}
              />{" "}
              Check-in/check-out reminders
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={form.postStayReviewRequest}
                onChange={(e) => setForm((f) => ({ ...f, postStayReviewRequest: e.target.checked }))}
              />{" "}
              Post-stay review requests
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={form.promotionalOffers}
                onChange={(e) => setForm((f) => ({ ...f, promotionalOffers: e.target.checked }))}
              />{" "}
              Promotional offers
            </label>
            <button onClick={onSave} disabled={loading} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #111827" }}>
              Save preferences
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Communication preferences</h1>
      <p style={{ color: "#6b7280" }}>Use the link from your email to update marketing preferences.</p>
    </div>
  );
}
