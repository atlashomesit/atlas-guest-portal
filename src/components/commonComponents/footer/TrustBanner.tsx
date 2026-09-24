import React from 'react';
import { ShieldCheck, Tag, MessageCircle, Lock } from 'lucide-react';

export const TrustBanner: React.FC = () => {
    const items = [
        {
            title: "Verified Homestays & Villas",
            icon: ShieldCheck,
        },
        {
            title: "Best Rate Guarantee",
            icon: Tag,
        },
        {
            title: "Direct Host WhatsApp Support",
            icon: MessageCircle,
        },
        {
            title: "Secure Payments",
            icon: Lock,
        }
    ];

    return (
        <div className="bg-bg-surface border-y border-border-subtle py-8">
            <div className="mx-auto max-w-[1240px] px-4 md:px-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center gap-3">
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
