import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const resetScrollLock = () => {
      document.body.style.overflow = "";
      document.body.style.overflowY = "";
      document.body.style.paddingRight = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.overflowY = "";
      document.documentElement.style.paddingRight = "";
    };

    resetScrollLock();
    window.scrollTo(0, 0);

    const handleResize = () => {
      resetScrollLock();
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [location.pathname, location.search]);

  return null;
}
