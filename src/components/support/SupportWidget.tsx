import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiHelpCircle, FiMessageCircle, FiPhone, FiPhoneCall, FiX } from "react-icons/fi";
import { Link, useLocation, useMatch } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { trackEvent } from "../../utils/analytics";
import { buildWaLink, defaultPrefill } from "../../utils/whatsapp";
import { submitCallbackRequest } from "./callbackService";

const SCROLL_BUFFER_PX = 200;

const SupportWidget = () => {
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const listingId = matchPropertyDetails?.params?.id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [footerOffset, setFooterOffset] = useState(0);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const bottomSpacing = useMemo(() => {
    const base = 20;
    return `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${base + footerOffset}px)`;
  }, [footerOffset]);

  const whatsappLink = useMemo(
    () =>
      buildWaLink({
        phoneE164: CONTACT.business.whatsapp,
        text: defaultPrefill({ href: pageUrl, context: "booking or payments" }),
      }),
    [pageUrl],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateOffset = () => {
      const doc = document.documentElement;
      const scrollBottom = window.scrollY + window.innerHeight;
      const distanceToBottom = doc.scrollHeight - scrollBottom;
      setFooterOffset(distanceToBottom < SCROLL_BUFFER_PX ? 72 : 0);
    };

    updateOffset();
    window.addEventListener("scroll", updateOffset, { passive: true });
    window.addEventListener("resize", updateOffset);
    return () => {
      window.removeEventListener("scroll", updateOffset);
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent(
      "chat_opened",
      { surface: "support_widget", entryPoint: "floating_pill" },
      { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
    );
  };

  const handleClose = () => {
    setIsOpen(false);
    trackEvent(
      "chat_minimized",
      { surface: "support_widget" },
      { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
    );
  };

  const handleCallbackSubmit = async () => {
    setCallbackError(null);
    const sanitized = callbackPhone.replace(/\D/g, "");
    if (sanitized.length !== 10) {
      setCallbackError("Enter a valid 10-digit number.");
      setCallbackStatus("error");
      return;
    }

    try {
      setCallbackStatus("sending");
      await submitCallbackRequest({
        phone: `+91${sanitized}`,
        note: `Support widget callback from ${pageUrl || location.pathname}`,
        route: location.pathname,
        unitCode: listingId ?? undefined,
        source: "support_widget",
      });
      setCallbackStatus("sent");
      trackEvent(
        "chat_callback_submitted",
        { surface: "support_widget" },
        { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
      );
      setTimeout(() => setIsOpen(false), 1200);
    } catch (error) {
      console.error("[support-widget] callback request failed", error);
      setCallbackStatus("error");
      setCallbackError("Could not send request. Try WhatsApp or call us.");
    }
  };

  if (location.pathname.includes("payment") || location.pathname.includes("checkout")) {
    return null;
  }

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="fixed right-4 z-[var(--z-floating)] inline-flex items-center gap-3 rounded-full border border-border-subtle bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f3f0ea_10%)] px-4 py-3 text-sm font-semibold text-text-primary shadow-level3 ring-1 ring-border-subtle transition hover:-translate-y-0.5 hover:shadow-level4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary md:right-5"
          style={{ bottom: bottomSpacing }}
          aria-label="Chat with us"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-lg text-accent-primary">
            <FiMessageCircle aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight text-left">
            <span className="text-sm font-semibold">Chat with us</span>
            <span className="text-[11px] text-text-muted">WhatsApp, call, FAQs</span>
          </span>
        </button>
      ) : null}

      {isOpen ? (
        <div
  className="fixed right-3 z-[var(--z-floating)] w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_97%,#f7f4ed_8%)] text-text-primary shadow-level4 ring-1 ring-border-subtle backdrop-blur md:right-5"
  style={{ bottom: bottomSpacing, top: '5px' }}
>

          <div className="flex items-start justify-between gap-3 bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f2efe8_18%)] px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-text-primary">Need a hand?</p>
              <p className="text-xs text-text-muted">Chat with Atlas or jump to WhatsApp/callback without losing your place.</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
              aria-label="Close support widget"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackEvent(
                  "support_whatsapp",
                  { surface: "support_widget" },
                  { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
                )
              }
              className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--support-success)_15%,transparent)] text-success">
                <FaWhatsapp aria-hidden="true" />
              </span>
              <span>
                WhatsApp
                <span className="block text-[11px] font-normal text-text-muted">Fastest response</span>
              </span>
            </a>

            <a
              href={`tel:+91${CONTACT.business.phone}`}
              onClick={() =>
                trackEvent(
                  "support_call",
                  { surface: "support_widget" },
                  { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
                )
              }
              className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
                <FiPhone aria-hidden="true" />
              </span>
              <span>
                Call
                <span className="block text-[11px] font-normal text-text-muted">Speak with the team</span>
              </span>
            </a>

            <Link
              to="/faq"
              onClick={() =>
                trackEvent(
                  "support_faq",
                  { surface: "support_widget" },
                  { route: location.pathname, unitCode: listingId ?? undefined, listingId: listingId ?? undefined },
                )
              }
              className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
                <FiHelpCircle aria-hidden="true" />
              </span>
              <span>
                FAQs
                <span className="block text-[11px] font-normal text-text-muted">Instant answers</span>
              </span>
            </Link>

            <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 text-left text-sm font-semibold shadow-level1">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cta-secondary)_12%,transparent)] text-cta-secondary">
                <FiPhoneCall aria-hidden="true" />
              </span>
              <div className="flex-1">
                <span className="block">Request callback</span>
                <span className="block text-[11px] font-normal text-text-muted">We&apos;ll ring you back</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-inner">
              <p className="text-sm font-semibold text-text-primary">Callback request</p>
              <p className="text-xs text-text-muted">Share your number and we&apos;ll reach out shortly.</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-muted px-3 py-2 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
                <span className="text-xs font-semibold text-text-muted">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={callbackPhone}
                  onChange={(event) => setCallbackPhone(event.target.value.replace(/\D/g, "").slice(-10))}
                  className="w-full bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="10-digit phone number"
                  aria-label="Callback phone"
                />
              </div>
              {callbackError ? <p className="mt-1 text-xs font-semibold text-support-error">{callbackError}</p> : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={callbackStatus === "sending"}
                  onClick={handleCallbackSubmit}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 transition hover:bg-cta-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                >
                  {callbackStatus === "sending" ? "Sending..." : callbackStatus === "sent" ? "Request sent" : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-text-muted underline underline-offset-2"
                >
                  Close
                </button>
              </div>
              {callbackStatus === "sent" ? <p className="mt-1 text-xs font-semibold text-success">We&apos;ll call you soon.</p> : null}
            </div>

            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-3 shadow-inner">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
                    <FiMessageCircle aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Chat interface</p>
                    <p className="text-[11px] text-text-muted">Placeholder while backend wiring is in progress.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-xl bg-bg-surface p-3 text-sm text-text-muted shadow-level1">
                  Hi there! Ask about check-in rules, cancellations, parking, or anything else about your stay.
                </div>
                <textarea
                  rows={2}
                  disabled
                  className="w-full resize-none rounded-xl border border-border-subtle bg-bg-muted p-3 text-sm text-text-muted outline-none"
                  placeholder="Messaging coming soon"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default SupportWidget;
