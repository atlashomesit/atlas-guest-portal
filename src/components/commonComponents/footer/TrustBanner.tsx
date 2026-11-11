import React from 'react';
import { ShieldCheck, Tag, MessageCircle, Lock } from 'lucide-react';
import { useTenantProcessingFee } from '@/hooks/useTenantProcessingFee';
import { getTenantContext } from '@/tenant/tenantContext';

export const TrustBanner: React.FC = () => {
    // GUEST-BADGE (founder ruled 2026-11-05): a best-rate promise is not honest where the guest quote
    // can carry "Payment processing (3%)". The tenant's pricing setting (same source as the listing
    // cards) must read exactly 0 for the badge to show; null (unknown or still loading) hides it.
    // The marketplace root prices fees per listing, so a tenant-level zero proves nothing there.
    const feePercent = useTenantProcessingFee();
    const isMarketplaceRoot = getTenantContext()?.isMarketplaceRoot === true;
    const showBestRate = feePercent === 0 && !isMarketplaceRoot;

    const items = [
        {
            title: "Verified Homestays & Villas",
            icon: ShieldCheck,
        },
        ...(showBestRate
            ? [{
                title: "Best Rate Guarantee",
                icon: Tag,
            }]
            : []),
        {
            title: "Direct Host WhatsApp Support",
            icon: MessageCircle,
        },
        {
            title: "Secure Payments",
            icon: Lock,
        }
    ];

    // Three items fill one even row; four items keep the original 2x2 / 4-across grid.
    const gridClass = items.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2 lg:grid-cols-4';

    return (
        <div className="bg-bg-surface border-y border-border-subtle py-8">
            <div className="mx-auto max-w-[1240px] px-4 md:px-8">
                <div className={`grid ${gridClass} gap-6`}>
                    {items.map((item) => (
                        <div key={item.title} data-testid="trust-banner-item" className="flex flex-col items-center text-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                                <item.icon className="h-6 w-6" aria-hidden />
                            </div>
                            <span className="text-sm font-semibold text-text-primary leading-snug max-w-[150px]">
                                {item.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
