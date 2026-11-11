import { IdCard } from 'lucide-react';

/** Marketplace fact, never a property, bank-account or quality guarantee. */
export default function HostIdentityLabel({ verified, marketplace = false, explain = false }: { verified: unknown; marketplace?: boolean; explain?: boolean }) {
  if (!marketplace || verified !== true) return null;
  return <div className="text-sm text-text-primary" data-testid="host-identity-check">
    <span className="inline-flex items-center gap-1.5 font-medium"><IdCard size={16} aria-hidden="true" />ID-verified host</span>
    {explain && <p className="mt-1 max-w-prose text-sm leading-relaxed text-text-muted">Atlas staff checked this host&apos;s government ID (PAN and Aadhaar). This does not verify the property or guarantee your stay.</p>}
  </div>;
}
