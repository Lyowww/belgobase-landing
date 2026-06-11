"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const { hash } = window.location;
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
