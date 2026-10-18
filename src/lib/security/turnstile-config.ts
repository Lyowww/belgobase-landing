export const TURNSTILE_ACTIONS = {
  contact: "contact",
  login: "login",
  enrollment: "enrollment",
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];

export function turnstileSiteKey(
  siteKey: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
): string | undefined {
  const value = siteKey?.trim();
  return value || undefined;
}
