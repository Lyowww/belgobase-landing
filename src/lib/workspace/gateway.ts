import type { NextRequest } from "next/server";

const bridgeMethods = new Set([
  "bootstrap", "search", "company", "operation_status", "cancel_operation",
  "export_results", "export_selection", "workspace_save", "search_history",
  "relaxation_suggestions", "compare_companies", "ai", "workspace_data",
  "filters_apply", "xbrl_catalog", "similar_company", "similar_apply",
  "export_columns", "ai_usage", "set_ai_limit", "account_action",
  "ai_wallet", "set_language",
]);
const authMethods = new Set(["start", "verify", "session", "logout", "logout-all", "sessions", "revoke"]);
const enrollmentMethods = new Set(["start", "verify", "session", "autofill", "complete"]);
const sessionNames = new Set(["__Host-belgobase_session", "belgobase_session", "__Host-belgobase_enrollment", "belgobase_enrollment"]);
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function webError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status, headers: privateHeaders });
}

export function backendUrl(path: string): URL {
  const base = new URL(process.env.BELGOBASE_WEB_BACKEND_URL ?? "https://api.belgobase.be/web/");
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !local) throw new Error("HTTPS backend required");
  if (base.username || base.password || base.search || base.hash) throw new Error("Invalid backend configuration");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(path, base);
}

export function isAllowedRoute(parts: string[], method: string): boolean {
  if (parts.length === 4 && parts[0] === "enrollment" && parts[1] === "legal") {
    return method === "GET" && /^[A-Za-z0-9_-]{1,128}$/.test(parts[2]) && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,149}$/.test(parts[3]);
  }
  if (parts.length === 2 && parts[0] === "enrollment" && enrollmentMethods.has(parts[1])) {
    return parts[1] === "session" ? method === "GET" : method === "POST";
  }
  if (parts.length === 2 && parts[0] === "auth" && authMethods.has(parts[1])) {
    return ["session", "sessions"].includes(parts[1]) ? method === "GET" : method === "POST";
  }
  if (parts.length === 2 && parts[0] === "bridge" && bridgeMethods.has(parts[1])) return method === "POST";
  if (parts.length === 1 && parts[0] === "voice") return method === "POST";
  return parts.length === 2 && parts[0] === "download" && /^[a-zA-Z0-9_-]{16,100}$/.test(parts[1]) && method === "GET";
}

async function boundedBody(request: NextRequest): Promise<ArrayBuffer> {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new RangeError("body limit"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export async function proxyWebRequest(request: NextRequest, parts: string[]): Promise<Response> {
  if (!isAllowedRoute(parts, request.method)) return webError("Deze actie bestaat niet.", 404);
  if (request.method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) {
    return webError("Open BelgoBase opnieuw en probeer nogmaals.", 403);
  }
  const headers = new Headers({ Accept: "application/json", Origin: request.nextUrl.origin });
  const csrf = request.headers.get("x-belgobase-csrf");
  if (csrf && /^[a-zA-Z0-9_-]{16,200}$/.test(csrf)) headers.set("X-BelgoBase-CSRF", csrf);
  const cookie = request.cookies.getAll().filter(item => sessionNames.has(item.name))
    .map(item => `${item.name}=${encodeURIComponent(item.value)}`).join("; ");
  if (cookie) headers.set("Cookie", cookie);
  let body: ArrayBuffer | undefined;
  let upstreamPath = parts.join("/");
  if (request.method !== "GET") {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return webError("Ongeldige aanvraag.", 415);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return webError("Deze aanvraag is te groot om in één keer te verzenden.", 413);
    try { body = await boundedBody(request); }
    catch (error) { return webError("Deze aanvraag kon niet worden ontvangen.", error instanceof RangeError ? 413 : 400); }
    if (body.byteLength > MAX_REQUEST_BYTES) return webError("Deze aanvraag is te groot om in één keer te verzenden.", 413);
    headers.set("Content-Type", "application/json");
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return webError("Ongeldige aanvraag.", 400);
      if (upstreamPath === "auth/start") {
        upstreamPath = parsed.license_code ? "auth/claim" : "auth/login";
        body = new TextEncoder().encode(JSON.stringify({ email: parsed.email,
          ...(parsed.license_code ? { license_code: parsed.license_code } : {}),
          remember_browser: parsed.remember === true })).buffer;
      } else if (parts[0] === "bridge") {
        upstreamPath = "bridge";
        body = new TextEncoder().encode(JSON.stringify({ method: parts[1], payload: parsed })).buffer;
      }
    } catch { return webError("Ongeldige aanvraag.", 400); }
  }
  try {
    const upstream = await fetch(backendUrl(upstreamPath), {
      method: request.method, headers, body, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(parts[0] === "download" ? 120_000 : 90_000),
    });
    const outgoing = new Headers(privateHeaders);
    for (const name of ["content-type", "content-disposition", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookieValue of upstream.headers.getSetCookie()) {
      const name = cookieValue.split("=", 1)[0];
      if (sessionNames.has(name) && !/;\s*domain=/i.test(cookieValue)) outgoing.append("Set-Cookie", cookieValue);
    }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return webError("BelgoBase heeft niet op tijd geantwoord. Controleer de huidige status voordat je de actie opnieuw uitvoert.", 503);
  }
}
