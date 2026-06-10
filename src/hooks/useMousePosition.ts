"use client";

import { useEffect, useState } from "react";

export function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return position;
}
