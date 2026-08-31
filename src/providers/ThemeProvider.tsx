"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_COOKIE,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function readStoredTheme(): Theme {
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${THEME_COOKIE}=`));
  const stored = entry?.slice(THEME_COOKIE.length + 1) as Theme | undefined;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return DEFAULT_THEME;
}

function persistThemePreference(theme: Theme) {
  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  if (theme === "system") {
    document.cookie = `${THEME_COOKIE}=;path=/;max-age=0;SameSite=Lax${secure}`;
    return;
  }

  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  const resolvedTheme = useMemo(
    () => resolveTheme(theme, systemDark),
    [theme, systemDark],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setThemeState(readStoredTheme());
      setSystemDark(getSystemTheme() === "dark");
      setMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(resolvedTheme);
  }, [theme, resolvedTheme, mounted]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    persistThemePreference(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, mounted }),
    [theme, resolvedTheme, setTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { Theme };
