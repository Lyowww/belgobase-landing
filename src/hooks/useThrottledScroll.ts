"use client";

import { useEffect, useState } from "react";

export function useThrottledScroll(threshold: number) {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      setPassed(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        update();
        raf = 0;
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold]);

  return passed;
}
