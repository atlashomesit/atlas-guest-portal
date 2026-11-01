import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyMobileStickyBar } from "@/components/property/PropertyMobileStickyBar";
import {
  LISTING_FAQ_BODY_ATTR,
  NEAR_FOOTER_BODY_ATTR,
  OPEN_LISTING_FAQ_EVENT,
  OPEN_SUPPORT_EVENT,
  STICKY_BAR_OFFSET_VAR,
} from "@/components/property/propertyHelpEvents";

const HOST_URL = "https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20question";

function renderBar(props: Partial<React.ComponentProps<typeof PropertyMobileStickyBar>> = {}) {
  return render(
    <PropertyMobileStickyBar
      bookable
      nightlyFallback={5000}
      nightlyIsSynthetic={false}
      summary={null}
      onReserveClick={() => {}}
      {...props}
    />,
  );
}

describe("PropertyMobileStickyBar Chat chooser (TOP10 review fix: host stays reachable on phone)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute(LISTING_FAQ_BODY_ATTR);
    vi.restoreAllMocks();
  });

  it("keeps the host one tap away: the chooser lists the host WhatsApp link, not only the platform drawer", () => {
    renderBar({ hostWhatsAppUrl: HOST_URL, listingId: 9001 });
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));

    const host = screen.getByTestId("mobile-sticky-chat-host");
    expect(host).toHaveAttribute("href", HOST_URL);
    expect(host).toHaveAttribute("target", "_blank");
    expect(host.getAttribute("rel")).toContain("noopener");
    expect(host).toHaveTextContent("Message the host");
    // Atlas support stays reachable too.
    expect(screen.getByTestId("mobile-sticky-chat-support")).toBeInTheDocument();
    // No FAQs on this page: no FAQ entry.
    expect(screen.queryByTestId("mobile-sticky-chat-faq")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-sticky-chat")).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the support drawer only when its own entry is chosen, and the host link does not open it", () => {
    const support = vi.fn();
    window.addEventListener(OPEN_SUPPORT_EVENT, support);
    renderBar({ hostWhatsAppUrl: HOST_URL });

    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    expect(support).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("mobile-sticky-chat-host"));
    expect(support).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    fireEvent.click(screen.getByTestId("mobile-sticky-chat-support"));
    expect(support).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();
    window.removeEventListener(OPEN_SUPPORT_EVENT, support);
  });

  it("opens the support drawer straight away when there is no host number and no listing FAQ", () => {
    const support = vi.fn();
    window.addEventListener(OPEN_SUPPORT_EVENT, support);
    renderBar({ hostWhatsAppUrl: "" });
    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    expect(support).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();
    window.removeEventListener(OPEN_SUPPORT_EVENT, support);
  });

  it("offers the listing's own FAQ panel on phone while GuestAssistant has FAQs, and asks it to open", () => {
    document.body.setAttribute(LISTING_FAQ_BODY_ATTR, "true");
    const faq = vi.fn();
    window.addEventListener(OPEN_LISTING_FAQ_EVENT, faq);
    // No host number: FAQ + support still make a chooser.
    renderBar({ hostWhatsAppUrl: "" });
    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    expect(screen.queryByTestId("mobile-sticky-chat-host")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mobile-sticky-chat-faq"));
    expect(faq).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_LISTING_FAQ_EVENT, faq);
  });

  it("closes on Escape and hands focus back to the Chat button", () => {
    renderBar({ hostWhatsAppUrl: HOST_URL });
    const chat = screen.getByTestId("mobile-sticky-chat");
    fireEvent.click(chat);
    expect(screen.getByTestId("mobile-sticky-chat-host")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();
    expect(chat).toHaveFocus();
  });

  it("closes when the user taps outside the chooser", () => {
    renderBar({ hostWhatsAppUrl: HOST_URL });
    fireEvent.click(screen.getByTestId("mobile-sticky-chat"));
    expect(screen.getByTestId("mobile-sticky-chat-menu")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("mobile-sticky-chat-menu")).not.toBeInTheDocument();
  });
});

describe("PropertyMobileStickyBar publishes its height so the support drawer opens above it (TOP10 review fix)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const height = this.classList.contains("pp-m-sticky") ? 65 : 0;
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({}) } as DOMRect;
    });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.removeProperty(STICKY_BAR_OFFSET_VAR);
    vi.restoreAllMocks();
  });

  it("sets --pp-sticky-bar-offset to the bar height while mounted and clears it on unmount", () => {
    const { unmount } = renderBar();
    expect(document.body.style.getPropertyValue(STICKY_BAR_OFFSET_VAR)).toBe("65px");
    unmount();
    expect(document.body.style.getPropertyValue(STICKY_BAR_OFFSET_VAR)).toBe("");
  });
});

describe("PropertyMobileStickyBar steps the floaters aside near the footer (TOP10 review fix)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute(NEAR_FOOTER_BODY_ATTR);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sets data-pp-near-footer while the footer is within reach of the stack, and removes it after", () => {
    // Hold each frame callback so the test runs it like a real animation frame (after the handler returns).
    let pending: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      pending = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      pending = null;
    });
    const scrollAndFrame = () => {
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      act(() => {
        const cb = pending;
        pending = null;
        cb?.(0);
      });
    };
    const footer = document.createElement("footer");
    document.body.appendChild(footer);
    let footerTop = 5000;
    vi.spyOn(footer, "getBoundingClientRect").mockImplementation(
      () => ({ x: 0, y: footerTop, top: footerTop, left: 0, right: 0, bottom: footerTop + 500, width: 0, height: 500, toJSON: () => ({}) }) as DOMRect,
    );
    const { unmount } = renderBar();
    expect(document.body).not.toHaveAttribute(NEAR_FOOTER_BODY_ATTR);

    footerTop = window.innerHeight - 200; // footer top inside the stack's reach
    scrollAndFrame();
    expect(document.body).toHaveAttribute(NEAR_FOOTER_BODY_ATTR);

    footerTop = window.innerHeight + 300;
    scrollAndFrame();
    expect(document.body).not.toHaveAttribute(NEAR_FOOTER_BODY_ATTR);

    footerTop = window.innerHeight - 200;
    scrollAndFrame();
    expect(document.body).toHaveAttribute(NEAR_FOOTER_BODY_ATTR);
    unmount();
    expect(document.body).not.toHaveAttribute(NEAR_FOOTER_BODY_ATTR);
  });
});
