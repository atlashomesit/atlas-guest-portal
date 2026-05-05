/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getTenantContext } from "../tenant/tenantContext";

/**
 * TASK-016: DPDP 2023 privacy policy page.
 *
 * NOTE: This is a structural template. The actual legal language should be
 * reviewed and approved by Sreekar (and ideally counsel) before PROD. The
 * headings and section structure below follow DPDP 2023 requirements
 * (sections 5-11) and ICO-style plain-language presentation.
 */

export default function PrivacyPolicyPage() {
  const brandName = getTenantContext()?.name ?? 'Atlas Homestays';
  const lastUpdated = "22 April 2026";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 text-text-primary">
      <SEO
        title={`Privacy Policy — ${brandName}`}
        description={`How ${brandName} collects, uses, stores, and protects your personal data in compliance with India's Digital Personal Data Protection Act, 2023.`}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">Last updated: {lastUpdated}</p>
      </header>

      <section className="space-y-4 text-sm leading-6">
        <p>
          {brandName} ("we", "us", "{brandName.split(' ')[0]}") respects your privacy and is committed to protecting your
          personal data in line with India's Digital Personal Data Protection Act, 2023 (DPDP 2023) and
          applicable data protection regulations.
        </p>

        <h2 className="mt-6 text-lg font-semibold">1. Data We Collect</h2>
        <ul className="list-disc pl-6">
          <li><strong>Booking details:</strong> Name, email, phone number, check-in/out dates, guest count.</li>
          <li><strong>Payment:</strong> Transactions are processed by Razorpay. We do not store card or UPI details on our servers.</li>
          <li><strong>Communication:</strong> WhatsApp message history between you and your host (for booking-related exchanges).</li>
          <li><strong>Technical:</strong> Device type, browser version, IP address (used only for fraud prevention and analytics).</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">2. How We Use It</h2>
        <ul className="list-disc pl-6">
          <li>Confirm and fulfil your booking.</li>
          <li>Send booking confirmations, check-in instructions, and check-out reminders.</li>
          <li>Comply with legal obligations (GST invoicing, guest registration as required by local law).</li>
          <li>Improve our service (aggregated, anonymised analytics only).</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">3. Who We Share It With</h2>
        <ul className="list-disc pl-6">
          <li><strong>Your host:</strong> The property owner needs your contact details and booking information to deliver your stay.</li>
          <li><strong>Service providers:</strong> Razorpay (payments), Interakt (WhatsApp messaging), Azure (hosting). Each processes data only on our instruction, under contract.</li>
          <li><strong>Law enforcement:</strong> Only if compelled by valid legal process.</li>
          <li>We do <strong>not</strong> sell your data to advertisers, OTAs, or third parties.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold">4. How Long We Keep It</h2>
        <p>
          Booking records are retained for seven years to satisfy Indian tax and accounting requirements
          (as required by the Income-tax Act). You can request deletion of personal identifiers at any
          time; historical booking totals (anonymised) will remain for statutory reporting.
        </p>

        <h2 className="mt-6 text-lg font-semibold">5. Your Rights (DPDP 2023)</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Withdraw consent for processing that isn't strictly required for a confirmed booking.</li>
          <li>Erase data that isn't legally required for tax/accounting purposes.</li>
          <li>Nominate a person to exercise these rights on your behalf if you are incapacitated.</li>
        </ul>
        <p>
          To exercise any right, email{" "}
          <a href="mailto:privacy@atlashomestays.com" className="text-brand-primary underline">
            privacy@atlashomestays.com
          </a>
          . We will respond within 30 days.
        </p>

        <h2 className="mt-6 text-lg font-semibold">6. Cookies</h2>
        <p>
          We use cookies that are strictly necessary to provide the booking service. We also use
          opt-in anonymous analytics (Cloudflare Web Analytics) with no cross-site tracking. You control
          this choice via the banner shown on your first visit — you can change it any time by clearing
          your site data and visiting again.
        </p>

        <h2 className="mt-6 text-lg font-semibold">7. Security</h2>
        <p>
          Data is encrypted in transit (TLS 1.2+) and at rest (Azure SQL TDE). We never store payment
          credentials. Access to production data is limited to a small number of named engineers and
          logged for audit.
        </p>

        <h2 className="mt-6 text-lg font-semibold">8. Data Fiduciary &amp; Contact</h2>
        <p>
          Atlas Tech Solutions is the Data Fiduciary under DPDP 2023. For privacy questions, complaints, or
          to exercise your rights, contact:
        </p>
        <address className="not-italic">
          Atlas Tech Solutions<br />
          <a href="mailto:privacy@atlashomestays.com" className="text-brand-primary underline">
            privacy@atlashomestays.com
          </a>
          <br />
          Phone: <a href="tel:+917246161981" className="text-brand-primary underline">+91 72461 61981</a>
        </address>

        <h2 className="mt-6 text-lg font-semibold">9. Changes to this Policy</h2>
        <p>
          We may update this policy to reflect changes in our service or in the law. The "Last updated"
          date at the top of this page reflects the most recent revision. Material changes will be
          communicated by email (to registered users) or through a banner on the site.
        </p>

        <p className="pt-6 text-xs text-text-muted">
          This privacy policy is a template subject to legal review. The production version may differ
          in specific language; the obligations stated here are binding on Atlas regardless.
        </p>
      </section>

      <footer className="mt-10 border-t border-border-subtle pt-4 text-xs text-text-muted">
        <Link to="/" className="text-brand-primary underline">
          ← Back to {brandName}
        </Link>
      </footer>
    </div>
  );
}
