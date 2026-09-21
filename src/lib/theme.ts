export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "belgobase-theme";
export const DEFAULT_THEME: Theme = "light";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function buildThemePreferenceCookie(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};SameSite=Lax${secure ? ";Secure" : ""}`;
}

export function resolveTheme(
  theme: Theme,
  systemDark: boolean,
): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemDark ? "dark" : "light";
}

export function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}
