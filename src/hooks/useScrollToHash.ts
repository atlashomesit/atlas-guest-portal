import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const scrollToId = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

export const useScrollToHash = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const targetId = decodeURIComponent(location.hash.replace("#", ""));
      // Allow time for the DOM to paint before scrolling
      requestAnimationFrame(() => scrollToId(targetId));
    }
  }, [location.hash]);
};

export default useScrollToHash;
