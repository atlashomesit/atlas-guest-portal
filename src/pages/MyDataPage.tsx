import React from "react";
import { Link, useParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "@/api/client";
import SEO from "@/components/SEO";
import { LoadingState } from "@/components/LoadingState";
import { getTenantBrandName, getTenantContactEmail } from "@/tenant/displayBrand";
import { messageFromApiResponse } from "@/utils/serverErrorFromResponse";

type ExportPayload = {
  guest: { name?: string; email?: string; phone?: string };
  bookings: Array<{ id: number; checkinDate: string; checkoutDate: string; bookingStatus: string }>;
  communicationLogs: Array<{ channel: string; eventType: string; createdAtUtc: string }>;
  reviews: Array<{ id: number; rating: number; title?: string }>;
};

export default function MyDataPage() {
  const brandName = getTenantBrandName();
  const privacyEmail = getTenantContactEmail("privacy");
  const { guestToken } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [exportData, setExportData] = React.useState<ExportPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [correctionText, setCorrectionText] = React.useState("");
  const [ticket, setTicket] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!guestToken) return;
    void (async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/public/guest-data/${encodeURIComponent(guestToken)}`), {
          headers: { Accept: "application/json", ...getApiHeaders() },
        });
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        setExportData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guestToken]);

  const downloadJson = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-data-${guestToken ?? "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitCorrection = async () => {
    if (!guestToken) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/public/guest-data/${encodeURIComponent(guestToken)}/correction`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
        body: JSON.stringify({ submitterEmail: email.trim(), correctionText: correctionText.trim() }),
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      const body = await res.json();
      setTicket(body.ticketReference ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit correction request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState kind="spinner" message="Loading your data…" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SEO title={`My data | ${brandName}`} description="View and request correction of your personal data." />
      <h1 className="text-2xl font-bold mb-2">My personal data</h1>
      <p className="text-sm text-gray-600 mb-6">
        Under the DPDP Act you can access your data and request corrections. We aim to respond within 90 days.
      </p>
      {error && <p className="text-red-600 mb-4" role="alert">{error}</p>}
      {exportData && (
        <section className="mb-8 rounded border p-4 bg-white" data-testid="my-data-export">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="font-semibold">Profile</h2>
            <button
              type="button"
              className="border px-3 py-1.5 rounded text-sm font-semibold"
              data-testid="my-data-download"
              onClick={downloadJson}
            >
              Download all my data (JSON)
            </button>
          </div>
          <p>Name: {exportData.guest.name ?? "—"}</p>
          <p>Email: {exportData.guest.email ?? "—"}</p>
          <p>Phone: {exportData.guest.phone ?? "—"}</p>

          <h3 className="font-semibold mt-4 mb-1" data-testid="my-data-bookings">
            Bookings ({exportData.bookings.length})
          </h3>
          <ul className="text-sm space-y-1">
            {exportData.bookings.map((b) => (
              <li key={b.id}>
                #{b.id} · {b.checkinDate} → {b.checkoutDate} · {b.bookingStatus}
              </li>
            ))}
          </ul>

          <h3 className="font-semibold mt-4 mb-1" data-testid="my-data-communication-logs">
            Communication logs ({exportData.communicationLogs.length})
          </h3>
          <ul className="text-sm space-y-1">
            {exportData.communicationLogs.map((log, i) => (
              <li key={`${log.channel}-${log.eventType}-${log.createdAtUtc}-${i}`}>
                {log.channel} · {log.eventType} · {log.createdAtUtc}
              </li>
            ))}
          </ul>

          <h3 className="font-semibold mt-4 mb-1" data-testid="my-data-reviews">
            Reviews ({exportData.reviews.length})
          </h3>
          <ul className="text-sm space-y-1">
            {exportData.reviews.map((r) => (
              <li key={r.id}>
                #{r.id} · {r.rating}/5{r.title ? ` · ${r.title}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 rounded border p-4 bg-white" data-testid="my-data-erasure">
        <h2 className="font-semibold mb-2">Right to erasure</h2>
        <p className="text-sm text-gray-600">
          To ask us to delete your personal data (DPDP Section 12)
          {privacyEmail ? (
            <>
              , email{" "}
              <a className="underline" href={`mailto:${privacyEmail}`}>
                {privacyEmail}
              </a>
            </>
          ) : (
            ", contact the host"
          )}
          . See our{" "}
          <Link className="underline" to="/privacy">
            Privacy Policy
          </Link>{" "}
          for retention limits and how we respond.
        </p>
      </section>

      <section className="rounded border p-4 bg-white" data-testid="my-data-correction-form">
        <h2 className="font-semibold mb-2">Request a correction</h2>
        <p className="text-sm text-gray-600 mb-3">Describe what should be updated. A host will review before changes are applied.</p>
        <label className="block text-sm font-medium mb-1">Your email</label>
        <input className="w-full border rounded px-3 py-2 mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block text-sm font-medium mb-1">Correction details</label>
        <textarea className="w-full border rounded px-3 py-2 mb-3 min-h-[100px]" value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} />
        <button type="button" className="bg-primary text-white px-4 py-2 rounded font-semibold disabled:opacity-50" disabled={submitting} onClick={() => void submitCorrection()}>
          {submitting ? "Submitting…" : "Submit correction request"}
        </button>
        {ticket && <p className="mt-3 text-green-700">Ticket reference: {ticket}</p>}
      </section>
    </div>
  );
}
