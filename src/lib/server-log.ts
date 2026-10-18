import { redactLogDetail } from "./email/log-redaction.ts";

/** Production-safe error logging for server routes/actions. Never send to clients. */
export function serverErrorLog(scope: string, detail: string): void {
  console.error(`[${scope}]`, redactLogDetail(detail));
}

/** Debug logging is disabled in production builds. */
export function serverDebugLog(scope: string, ...details: unknown[]): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[${scope}]`, ...details);
}
