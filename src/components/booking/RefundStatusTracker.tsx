import { CheckCircle2, Clock, AlertCircle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

/**
 * PAY-009: one refund as the API reports it (`GuestBookingSummaryDto.refunds`).
 * Status wire values: processing | processed | failed | recorded_by_host | unavailable.
 */
export interface GuestRefund {
  amount: number;
  status: string;
  initiatedAtUtc: string;
  processedAtUtc?: string | null;
  bankReference?: string | null;
}

export interface RefundStatusTrackerProps {
  refunds: GuestRefund[] | null | undefined;
  currency?: string;
}

function formatIstDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

type Presentation = { label: string; tone: string; Icon: typeof Clock; copy: string };

/**
 * Fail-safe wording: "processed" means Razorpay sent the refund to the guest's bank — never "credited",
 * because Atlas has no signal from the bank. Anything unrecognised reads "Status unavailable".
 */
function present(status: string): Presentation {
  switch (status) {
    case 'processing':
      return {
        label: 'Processing by bank',
        tone: 'bg-amber-50 text-amber-800 border-amber-200',
        Icon: Clock,
        copy: 'Your refund has been started. Refunds usually reflect in your account within 5–7 business days.',
      };
    case 'processed':
      return {
        label: 'Sent to your bank',
        tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        Icon: CheckCircle2,
        copy: 'The payment gateway has sent this refund to your bank. It usually shows in your account within 5–7 business days. If it does not, give your bank the reference number below.',
      };
    case 'failed':
      return {
        label: 'Refund failed',
        tone: 'bg-red-50 text-red-800 border-red-200',
        Icon: AlertCircle,
        copy: 'Your bank did not accept this refund, so no money has left. Please contact the host so they can send it again.',
      };
    case 'recorded_by_host':
      return {
        label: 'Recorded by your host',
        tone: 'bg-slate-50 text-slate-800 border-slate-200',
        Icon: CheckCircle2,
        copy: 'Your host recorded this refund outside the online payment gateway. Contact the host for transfer details.',
      };
    default:
      return {
        label: 'Status unavailable',
        tone: 'bg-slate-50 text-slate-700 border-slate-200',
        Icon: HelpCircle,
        copy: 'We could not confirm the status of this refund. Please contact the host.',
      };
  }
}

/** PAY-009: guest-facing refund status card on the booking page. Renders nothing when there is no refund. */
export default function RefundStatusTracker({ refunds, currency = 'INR' }: RefundStatusTrackerProps) {
  if (!Array.isArray(refunds) || refunds.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm space-y-3"
      data-testid="refund-status-tracker"
      aria-labelledby="refund-status-tracker-heading"
    >
      <h2 id="refund-status-tracker-heading" className="text-sm font-semibold text-text-primary">
        {refunds.length === 1 ? 'Your refund' : 'Your refunds'}
      </h2>
      {refunds.map((r, i) => {
        const p = present(r.status);
        const initiated = formatIstDate(r.initiatedAtUtc);
        const processed = r.status === 'processed' ? formatIstDate(r.processedAtUtc) : null;
        const reference = r.status === 'processed' && r.bankReference ? r.bankReference : null;
        // PAY-017: a refund the host recorded by hand (UPI / bank transfer) carries the UTR the host typed - shown as the host's reference, never as a bank confirmation.
        const hostReference = r.status === 'recorded_by_host' && r.bankReference ? r.bankReference : null;
        return (
          <div key={i} className="space-y-1.5" data-testid="refund-status-item" data-status={r.status}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-base font-semibold text-text-primary" data-testid="refund-amount">
                {formatCurrency(Number(r.amount) || 0, { currency })}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${p.tone}`}
                data-testid="refund-status-badge"
              >
                <p.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {p.label}
              </span>
            </div>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-text-secondary">
              {initiated && (
                <>
                  <dt>Refund started</dt>
                  <dd data-testid="refund-initiated">{initiated}</dd>
                </>
              )}
              {processed && (
                <>
                  <dt>Sent to bank</dt>
                  <dd data-testid="refund-processed">{processed}</dd>
                </>
              )}
              {r.status === 'processed' && (
                <>
                  <dt>Bank reference (ARN)</dt>
                  <dd data-testid="refund-bank-reference" className="font-mono text-text-primary break-all">
                    {reference ?? 'Not available yet'}
                  </dd>
                </>
              )}
              {hostReference && (
                <>
                  <dt>Transfer reference (UTR)</dt>
                  <dd data-testid="refund-host-reference" className="font-mono text-text-primary break-all">
                    {hostReference}
                  </dd>
                </>
              )}
            </dl>
            <p className="text-xs text-text-secondary">{p.copy}</p>
          </div>
        );
      })}
    </section>
  );
}
