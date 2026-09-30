import { Link, matchPath, useLocation } from 'react-router-dom';
import { STAY_ISSUE_CATEGORIES } from '../messaging/stayIssueCategories';

export default function StayIssueActions({ onSelect }: { onSelect: () => void }) {
  const location = useLocation();
  const bookingId = matchPath('/booking/:bookingId', location.pathname)?.params.bookingId;
  const search = new URLSearchParams(location.search);
  const hasBookingLink = Boolean(bookingId && /^\d+$/.test(bookingId) && Number(bookingId) > 0 && search.get('t')?.trim());

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-muted/50 p-3 space-y-3" aria-labelledby="stay-issue-title">
      <h2 id="stay-issue-title" className="text-sm font-semibold">Report a stay issue</h2>
      {hasBookingLink ? <>
        <p className="text-xs text-text-secondary">Choose a category, then describe the issue in your message to the host.</p>
        <div className="grid grid-cols-2 gap-2">
          {STAY_ISSUE_CATEGORIES.map((category) => {
            const params = new URLSearchParams(search);
            params.set('issue', category.value);
            return <Link key={category.value} to={`${location.pathname}?${params.toString()}#guest-messages`} onClick={onSelect}
              className="flex min-h-11 items-center justify-center rounded-xl border border-border-subtle bg-bg-surface px-2 py-2 text-sm font-medium hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
              {category.label}
            </Link>;
          })}
        </div>
        <p className="text-xs text-text-muted">Nothing is sent until you choose Send.</p>
      </> : <>
        <p className="text-xs text-text-secondary">Open your booking to message the host. Sign in to My Bookings, or use the link from your booking confirmation email.</p>
        <Link to="/my-bookings" onClick={onSelect} className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">Open my bookings</Link>
      </>}
    </section>
  );
}
