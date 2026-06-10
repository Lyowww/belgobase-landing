export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "belgobase-theme";
export const RESOLVED_THEME_COOKIE = "belgobase-resolved";

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

export function isResolvedTheme(
  value: string | undefined,
): value is ResolvedTheme {
  return value === "light" || value === "dark";
}
