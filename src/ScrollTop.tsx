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
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        prevPathname.current = arriving;
    }, [pathname]);

    return null;
};

export default ScrollToTop;
