"use client";

import { useEffect, useState } from "react";

/** Drives layout choices (sidebar vs. bottom nav, single vs. two-pane chat)
 * off the actual viewport rather than user-agent sniffing, so the UI adapts
 * correctly to any device — including desktop windows resized small. */
export function useIsCompactViewport(breakpointPx = 768): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpointPx]);

  return isCompact;
}
