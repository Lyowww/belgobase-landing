/** Shorten a provider error for logs without keeping addresses or API keys. */
export function redactLogDetail(detail: string): string {
  return detail
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\bre_[A-Za-z0-9_]{8,}\b/g, "[redacted-key]")
    .slice(0, 300);
}
