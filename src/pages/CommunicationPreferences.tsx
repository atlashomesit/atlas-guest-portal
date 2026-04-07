import React from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Landing page after one-click unsubscribe from marketing email (API redirects here).
 */
export default function CommunicationPreferences() {
  const [params] = useSearchParams();
  const unsubscribed = params.get("unsubscribed");
  const channel = params.get("channel");

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

  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Communication preferences</h1>
      <p style={{ color: "#6b7280" }}>Use the link from your email to update marketing preferences.</p>
    </div>
  );
}
