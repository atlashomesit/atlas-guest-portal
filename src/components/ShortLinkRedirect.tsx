import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SEO from "./SEO";
import { shortLinkMap } from "../config/shortLinks";
import { getTenantBrandName } from "../tenant/displayBrand";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";

const ShortLinkRedirect = () => {
    const brandName = getTenantBrandName();
    const { shortCode } = useParams<{ shortCode: string }>();

    const normalizedCode = shortCode?.toLowerCase()?.trim();

    const staticTarget = useMemo(() => {
        if (!normalizedCode) return undefined;
        return shortLinkMap[normalizedCode as keyof typeof shortLinkMap];
    }, [normalizedCode]);

    const [dynamicTarget, setDynamicTarget] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState<boolean>(!staticTarget && Boolean(normalizedCode));
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        const slug = normalizedCode;
        if (staticTarget || !slug) {
            setIsResolving(false);
            return;
        }

        let cancelled = false;
        setIsResolving(true);
        setNotFound(false);

        async function resolveTenantSlug() {
            const validSlug = String(slug ?? '').trim();
            if (!validSlug) {
                setNotFound(true);
                setIsResolving(false);
                return;
            }

            try {
                let apiUrl: string;
                try {
                    apiUrl = buildApiUrl('/api/public/listings');
                } catch {
                    apiUrl = '/api/public/listings';
                }

                const response = await fetch(apiUrl, {
                    headers: {
                        ...getApiHeaders(validSlug),
                        Accept: 'application/json',
                    },
                });

                if (cancelled) return;

                if (response.ok) {
                    const data = await response.json();
                    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
                    if (list.length > 0) {
                        const first = list[0];
                        const propSlug = getPropertySlug(
                            first.propertyName ? { property_name: first.propertyName } : { name: first.name }
                        );
                        setDynamicTarget(`${buildHomeUnitPath(propSlug, first.id)}?tenant=${encodeURIComponent(validSlug)}`);
                        setIsResolving(false);
                        return;
                    }
                }

                // Fallback: check /tenants/public/{slug} in case tenant has no published listings yet
                let tenantUrl: string;
                try {
                    tenantUrl = buildApiUrl(`/tenants/public/${encodeURIComponent(validSlug)}`);
                } catch {
                    tenantUrl = `/tenants/public/${encodeURIComponent(validSlug)}`;
                }

                const tenantRes = await fetch(tenantUrl);
                if (cancelled) return;

                if (tenantRes.ok) {
                    setDynamicTarget(`/?tenant=${encodeURIComponent(validSlug)}`);
                    setIsResolving(false);
                    return;
                }

                setNotFound(true);
                setIsResolving(false);
            } catch {
                if (!cancelled) {
                    setNotFound(true);
                    setIsResolving(false);
                }
            }
        }

        void resolveTenantSlug();

        return () => {
            cancelled = true;
        };
    }, [normalizedCode, staticTarget]);

    const targetUrl = staticTarget || dynamicTarget || undefined;

    useEffect(() => {
        const robotsMeta = document.createElement("meta");
        robotsMeta.name = "robots";
        robotsMeta.content = "noindex,follow";
        document.head.appendChild(robotsMeta);

        let canonicalLink: HTMLLinkElement | undefined;

        if (targetUrl) {
            canonicalLink = document.createElement("link");
            canonicalLink.rel = "canonical";
            canonicalLink.href = targetUrl;
            document.head.appendChild(canonicalLink);
        }

        return () => {
            robotsMeta.remove();
            canonicalLink?.remove();
        };
    }, [targetUrl]);

    useEffect(() => {
        if (!targetUrl) return;

        const timer = window.setTimeout(() => {
            window.location.replace(targetUrl);
        }, 400);

        return () => window.clearTimeout(timer);
    }, [targetUrl]);

    if (isResolving) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-muted px-6">
                <div className="max-w-md w-full bg-bg-surface shadow-level2 rounded-lg p-8 text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full border-4 border-border-subtle border-t-primary animate-spin" aria-hidden="true" />
                    </div>
                    <SEO title={`Looking up link | ${brandName}`} robots="noindex, nofollow" />
                    <h1 className="text-2xl font-semibold text-text-primary">Looking up link…</h1>
                </div>
            </div>
        );
    }

    if (!normalizedCode || notFound || !targetUrl) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-muted px-6">
                <SEO title={`Link not found | ${brandName}`} robots="noindex, nofollow" />
                <div className="max-w-md w-full bg-bg-surface shadow-level2 rounded-lg p-8 text-center">
                    <h1 className="text-2xl font-semibold text-text-primary mb-4">Link not found</h1>
                    <p className="text-text-muted mb-6">
                        We couldn&apos;t find that short link on {brandName}. Please return to the homepage and try again.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-cta-primary text-[var(--text-on-cta)] hover:bg-cta-secondary transition-colors shadow-level1"
                    >
                        Go to Home
                    </Link>
                </div>
            </div>
        );
    }

    const label = staticTarget
        ? (normalizedCode === "penthouse" ? "Penthouse" : `Room ${normalizedCode.toUpperCase()}`)
        : (normalizedCode ? `homestay (${normalizedCode})` : "homestay");

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-muted px-6">
            <div className="max-w-md w-full bg-bg-surface shadow-level2 rounded-lg p-8 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full border-4 border-border-subtle border-t-primary animate-spin" aria-hidden="true" />
                </div>
                <SEO title={`Redirecting | ${brandName}`} robots="noindex, nofollow" />
                <h1 className="text-2xl font-semibold text-text-primary">Taking you to {brandName} {label}…</h1>
                <p className="text-text-muted break-words">{targetUrl}</p>
                <button
                    type="button"
                    onClick={() => window.location.replace(targetUrl)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-cta-primary text-[var(--text-on-cta)] hover:bg-cta-secondary transition-colors shadow-level1"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default ShortLinkRedirect;
