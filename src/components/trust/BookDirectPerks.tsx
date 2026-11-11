import { ShieldCheck, MessageSquareCheck, Percent } from 'lucide-react';

interface BookDirectPerksProps {
  className?: string;
}

export default function BookDirectPerks({ className = '' }: BookDirectPerksProps) {
  return (
    <div
      className={`rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3.5 text-emerald-950 shadow-sm ${className}`}
      data-testid="book-direct-perks"
    >
      <div className="flex items-center gap-2 mb-2 font-semibold text-xs tracking-wider uppercase text-emerald-800">
        <span className="flex h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
        Book Direct Perks
      </div>
      <div className="grid gap-2 text-xs">
        <div className="flex items-start gap-2.5">
          <Percent className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-emerald-900">Zero OTA guest service fee</span>
            <span className="text-emerald-700 ml-1.5 font-medium">(Save up to 15%)</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MessageSquareCheck className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-emerald-900">Direct host communication</span>
            <span className="text-emerald-700 ml-1.5 font-medium">&amp; priority check-in assistance</span>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-emerald-900">100% Verified reservation guarantee</span>
          </div>
        </div>
      </div>
    </div>
  );
}
