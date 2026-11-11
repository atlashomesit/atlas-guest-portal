import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SEO from "../components/SEO";
import PoweredByAtlasLink from "../components/PoweredByAtlasLink";
import { fetchYourBooking, yourBookingReceiptUrl, type YourBookingData, type YourBookingResult } from "../api/yourBookingClient";
import { parseStructuredHouseRules } from "../utils/houseRules";
import { getPoweredBySlug } from "../tenant/poweredByAtlas";

/**
 * TASK-10299444 / TASK-10299437: the ONE "Your booking" page behind the WhatsApp "Your booking" button. Reached by a signed token (the link is the credential),
 * read-only, for every booking source and status. Sections in order: the stay, the payment receipt (a receipt, not a tax invoice), the house rules, any other rules,
 * the cancellation policy. A listing with no saved rules shows no rules section and nothing blocks. Money wording: "Total", never "Paid"; the receipt rows come from the server.
 */

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section data-testid={`your-booking-${id}`} className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-level1">
      <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stay({ data }: { data: YourBookingData }) {
  return (
    <div data-testid="your-booking-stay">
      <h1 className="text-2xl font-bold text-text-primary">
        {data.homeName}
        {data.brand ? <span className="font-normal text-text-secondary"> at {data.brand}</span> : null}
      </h1>
      {data.guestFirstName ? <p className="text-text-secondary text-sm mt-1">Hi {data.guestFirstName}, this is your booking.</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-text-muted">Check-in</dt>
          <dd className="font-semibold text-text-primary">
            {formatDate(data.checkInDate)}
            {data.checkInTime ? `, ${data.checkInTime}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Check-out</dt>
          <dd className="font-semibold text-text-primary">
            {formatDate(data.checkOutDate)}
            {data.checkOutTime ? `, ${data.checkOutTime}` : ""}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-text-muted">Booking ref</dt>
          <dd className="font-semibold text-text-primary">{data.reference}</dd>
        </div>
      </dl>
      {data.isCancelled && data.statusMessage ? (
        <p data-testid="your-booking-cancelled" role="status" className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
          {data.statusMessage}
        </p>
      ) : null}
      {data.directionsUrl ? (
        <a
          data-testid="your-booking-directions"
          href={data.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-brand"
        >
          Directions
        </a>
      ) : null}
    </div>
  );
}

export default function YourBookingPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<YourBookingResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setResult({ kind: "invalid" });
      return () => {};
    }
    setResult(null);
    void fetchYourBooking(token).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const data = result?.kind === "ok" ? result.data : null;
  const chips = data?.otherRules ? parseStructuredHouseRules(data.otherRules.json) : [];

  return (
    <div className="min-h-screen bg-bg-page px-4 py-8">
      <SEO title="Your booking" robots="noindex, nofollow" />
      <div className="mx-auto max-w-lg space-y-4">
        {result === null ? <p className="text-text-secondary text-sm text-center">Loading your booking…</p> : null}

        {result?.kind === "invalid" ? (
          <div data-testid="your-booking-invalid" role="alert" className="rounded-2xl border border-border-subtle bg-bg-surface p-6 text-center">
            <h1 className="text-xl font-bold text-text-primary mb-2">This link is not valid any more</h1>
            <p className="text-sm text-text-secondary">Please ask your host to send it again.</p>
          </div>
        ) : null}

        {result?.kind === "error" ? (
          <div data-testid="your-booking-error" role="alert" className="rounded-2xl border border-border-subtle bg-bg-surface p-6 text-center">
            <h1 className="text-xl font-bold text-text-primary mb-2">We could not load your booking just now</h1>
            <p className="text-sm text-text-secondary">Please try again in a moment.</p>
          </div>
        ) : null}

        {data ? (
          <>
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-level1">
              <Stay data={data} />
            </div>

            <Section id="receipt" title={data.receipt.title}>
              <dl className="text-sm">
                {data.receipt.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 border-b border-border-subtle py-2 last:border-b-0">
                    <dt className="text-text-muted">{row.label}</dt>
                    <dd className={`text-right text-text-primary ${row.label === "Total" ? "font-bold" : "font-semibold"}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-text-muted mt-3">{data.receipt.note}</p>
              {token ? (
                <a
                  data-testid="your-booking-receipt-pdf"
                  href={yourBookingReceiptUrl(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-brand underline"
                >
                  Download receipt (PDF)
                </a>
              ) : null}
            </Section>

            {data.houseRules ? (
              <Section id="house-rules" title="House rules">
                <p className="text-xs text-text-muted mb-2">{data.agreementLine}</p>
                {data.houseRules.text ? (
                  <div className="whitespace-pre-wrap text-sm text-text-primary">{data.houseRules.text}</div>
                ) : null}
                {data.houseRules.pdfUrl ? (
                  <a href={data.houseRules.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-brand underline">
                    View the full house rules document
                  </a>
                ) : null}
              </Section>
            ) : null}

            {chips.length > 0 ? (
              <Section id="other-rules" title="Other rules">
                <p className="text-xs text-text-muted mb-2">{data.agreementLine}</p>
                <ul className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <li key={chip.key} className="rounded-full border border-border-subtle px-3 py-1 text-sm text-text-primary">
                      {chip.label}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section id="cancellation" title="Cancellation policy">
              <p className="text-xs text-text-muted mb-2">{data.agreementLine}</p>
              <p className="text-sm font-semibold text-text-primary">{data.cancellationPolicy.headline}</p>
              <p className="text-sm text-text-secondary mt-1">{data.cancellationPolicy.detail}</p>
            </Section>

            {data.supportPhone ? (
              <p className="text-center text-sm text-text-secondary">
                Questions? Call{" "}
                <a href={`tel:${data.supportPhone.replace(/[^\d+]/g, "")}`} className="underline">
                  {data.supportPhone}
                </a>
              </p>
            ) : null}
          </>
        ) : null}

        <p className="pt-2 text-center text-xs text-text-muted">
          <PoweredByAtlasLink slug={getPoweredBySlug()} medium="your-booking" className="underline-offset-2 hover:underline" />
        </p>
      </div>
    </div>
  );
}
