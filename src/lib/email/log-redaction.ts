/** Shorten a provider error for logs without keeping addresses, keys, or paths. */
export function redactLogDetail(detail: string): string {
  return detail
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\bre_[A-Za-z0-9_]{8,}\b/g, "[redacted-key]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi, "[redacted-token]")
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home)\/)[^\s"']+/g, "[redacted-path]")
    .replace(/File "[^"]+"/g, 'File "[redacted-path]"')
    .slice(0, 300);
}
