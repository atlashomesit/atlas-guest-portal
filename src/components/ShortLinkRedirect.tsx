import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { shortLinkMap } from "../config/shortLinks";

const ShortLinkRedirect = () => {
    const { shortCode } = useParams<{ shortCode: string }>();

    const normalizedCode = shortCode?.toLowerCase();

    const targetUrl = useMemo(() => {
        if (!normalizedCode) return undefined;
        return shortLinkMap[normalizedCode as keyof typeof shortLinkMap];
    }, [normalizedCode]);

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

    if (!normalizedCode || !targetUrl) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
                <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
                    <h1 className="text-2xl font-semibold text-slate-900 mb-4">Link not found</h1>
                    <p className="text-slate-600 mb-6">
                        We couldn't find the short link you're looking for. Please return to the homepage and try again.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                    >
                        Go to Home
                    </Link>
                </div>
            </div>
        );
    }

    const label = normalizedCode === "penthouse" ? "Penthouse 501" : `Room ${normalizedCode.toUpperCase()}`;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-semibold text-slate-900">Taking you to Atlas Homes {label}…</h1>
                <p className="text-slate-600 break-words">{targetUrl}</p>
                <button
                    type="button"
                    onClick={() => window.location.replace(targetUrl)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default ShortLinkRedirect;
