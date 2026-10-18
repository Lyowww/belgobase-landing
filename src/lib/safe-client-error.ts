/** Protocol-style error codes returned by the workspace bridge / auth APIs. */
export function isProtocolErrorCode(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

/**
 * Detect messages that look like internal diagnostics rather than curated
 * user-facing copy. Legitimate Dutch/French/English product messages pass.
 */
export function looksLikeInternalErrorMessage(message: string): boolean {
  if (message.length === 0 || message.length > 400) return true;
  if (/[\0-\x08\x0b\x0c\x0e-\x1f]/.test(message)) return true;
  if (/\r|\n/.test(message) && /Traceback|File "|at \w+|Exception|Error:/i.test(message)) {
    return true;
  }
  if (
    /Traceback \(most recent call last\)|File "[^"]+\.py"|node_modules[/\\]|[/\\]Users[/\\]|[/\\]home[/\\]|[A-Za-z]:\\|\.tsx?:\d+|at Object\.|at Module\./i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\bre_[A-Za-z0-9_]{8,}\b|Bearer\s+[A-Za-z0-9._-]{12,}|api[_-]?key\s*[:=]/i.test(message)) {
    return true;
  }
  return false;
}

/** Prefer protocol codes; drop internal free-text; keep curated product copy. */
export function sanitizeClientErrorMessage(
  value: unknown,
  fallback = "temporarily_unavailable",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (isProtocolErrorCode(trimmed)) return trimmed;
  if (looksLikeInternalErrorMessage(trimmed)) return fallback;
  return trimmed;
}
