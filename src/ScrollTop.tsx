import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY = "atlas_search_scroll";

const ScrollToTop: React.FC = () => {
    const { pathname } = useLocation();
    const prevPathname = useRef(pathname);

    useEffect(() => {
        const leaving = prevPathname.current;
        const arriving = pathname;

        // Save scroll position when leaving /search
        if (leaving === "/search") {
            sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        }

        if (arriving === "/search") {
            // Restore scroll position when returning to /search
            const saved = sessionStorage.getItem(SCROLL_KEY);
            if (saved) {
                const y = parseInt(saved, 10);
                // Defer restoration so the page has rendered
                requestAnimationFrame(() => {
                    window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
                });
            }
        } else {
            // 2026-09-25: was `behavior: "smooth"`. On mobile listing-detail pages this races
            // any scroll performed shortly after navigation (e.g. a guest flicking the page, or
            // Playwright's `page.mouse.wheel()` in mobile-viewport-flows.e2e.spec.ts) — this
            // effect's own smooth-scroll-to-0 animation (~300-400ms) can still be in flight when
            // the other scroll starts, and it wins, silently snapping the page back to
            // scrollY=0. Measured live: a 2000px wheel scroll issued right after navigation
            // decayed 862 -> 456 -> 260 -> 62 -> 13 -> 1 -> 0 over ~360ms and stayed at 0,
            // which is exactly why PropertyMobileStickyBar's scroll-triggered reveal
            // (TASK-102075) never got past-the-hero: the "scroll past the hero" never actually
            // happened. `behavior: "instant"` matches the sibling /search-restore branch four
            // lines up and removes the race outright (nothing left to fight afterward).
            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }

        prevPathname.current = arriving;
    }, [pathname]);

    return null;
};

export default ScrollToTop;
