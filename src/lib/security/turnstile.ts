/**
 * Cloudflare Turnstile server-side verification.
 *
 * Tokens are never trusted from the browser alone. Production requires a
 * configured secret and a successful siteverify response. Development and
 * automated tests may omit the secret so local flows stay usable without a
 * Cloudflare widget; that bypass is intentionally unavailable in production.
 *
 * Official reference: https://developers.cloudflare.com/turnstile/
 */

import { createHash } from "node:crypto";
import {
  TURNSTILE_ACTIONS,
  type TurnstileAction,
  turnstileSiteKey,
} from "./turnstile-config.ts";

export { TURNSTILE_ACTIONS, turnstileSiteKey };
export type { TurnstileAction };

export type TurnstileVerifyResult =
  | { ok: true; bypassed?: boolean }
  | {
      ok: false;
      reason:
        | "missing_token"
        | "invalid_token"
        | "action_mismatch"
        | "hostname_mismatch"
        | "replay"
        | "provider_error"
        | "not_configured"
        | "timeout";
    };

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8_000;
const TOKEN_MAX_LENGTH = 2_048;
const REPLAY_TTL_MS = 10 * 60 * 1000;
const REPLAY_MAX_ENTRIES = 5_000;

const consumedTokens = new Map<string, number>();

function isProductionRuntime(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "production";
}

export function turnstileSecretConfigured(
  secret: string | undefined = process.env.TURNSTILE_SECRET_KEY,
): boolean {
  return Boolean(secret?.trim());
}

function pruneConsumedTokens(nowMs: number): void {
  for (const [key, expiresAt] of consumedTokens) {
    if (expiresAt <= nowMs) consumedTokens.delete(key);
  }
  while (consumedTokens.size > REPLAY_MAX_ENTRIES) {
    const oldest = consumedTokens.keys().next().value;
    if (oldest === undefined) break;
    consumedTokens.delete(oldest);
  }
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function markConsumed(token: string, nowMs: number): boolean {
  pruneConsumedTokens(nowMs);
  const key = tokenFingerprint(token);
  if (consumedTokens.has(key)) return false;
  consumedTokens.set(key, nowMs + REPLAY_TTL_MS);
  return true;
}

/** Test helper — clears in-process replay tracking. */
export function resetTurnstileReplayGuardForTests(): void {
  consumedTokens.clear();
}

export function expectedTurnstileHostnames(
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): Set<string> {
  const hosts = new Set([
    "belgobase.com",
    "www.belgobase.com",
    "localhost",
    "127.0.0.1",
  ]);
  if (siteUrl?.trim()) {
    try {
      hosts.add(new URL(siteUrl).hostname.toLowerCase());
    } catch {
      // Ignore malformed canonical URL; allowlist above still applies.
    }
  }
  return hosts;
}

function normalizeToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > TOKEN_MAX_LENGTH) return null;
  if (!/^[A-Za-z0-9._~+/-]+=*$/.test(trimmed)) return null;
  return trimmed;
}

export async function verifyTurnstileToken(options: {
  token: unknown;
  action: TurnstileAction;
  remoteIp?: string | null;
  secret?: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
  allowedHostnames?: Set<string>;
  nodeEnv?: string;
}): Promise<TurnstileVerifyResult> {
  const secret = (options.secret ?? process.env.TURNSTILE_SECRET_KEY)?.trim();
  const production = isProductionRuntime(options.nodeEnv);

  if (!secret) {
    if (production) return { ok: false, reason: "not_configured" };
    return { ok: true, bypassed: true };
  }

  const token = normalizeToken(options.token);
  if (!token) return { ok: false, reason: "missing_token" };

  const nowMs = options.nowMs ?? Date.now();
  if (!markConsumed(token, nowMs)) return { ok: false, reason: "replay" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  const remoteIp = options.remoteIp?.trim();
  if (remoteIp && remoteIp.length <= 64) body.set("remoteip", remoteIp);

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch (error) {
    consumedTokens.delete(tokenFingerprint(token));
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "provider_error" };
  }

  if (!response.ok) {
    consumedTokens.delete(tokenFingerprint(token));
    return { ok: false, reason: "provider_error" };
  }

  let payload: SiteverifyResponse;
  try {
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    consumedTokens.delete(tokenFingerprint(token));
    return { ok: false, reason: "provider_error" };
  }

  if (!payload.success) {
    return { ok: false, reason: "invalid_token" };
  }

  if (payload.action && payload.action !== options.action) {
    return { ok: false, reason: "action_mismatch" };
  }

  const allowed = options.allowedHostnames ?? expectedTurnstileHostnames();
  const hostname = payload.hostname?.trim().toLowerCase();
  if (hostname && !allowed.has(hostname)) {
    return { ok: false, reason: "hostname_mismatch" };
  }

  return { ok: true };
}
