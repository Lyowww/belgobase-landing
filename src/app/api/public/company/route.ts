import { NextRequest } from "next/server";
import { backendUrl } from "@/lib/workspace/gateway";
import { cleanQuery, publicPayload } from "@/lib/public-company/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const fail = (error: string, status: number) => Response.json({ ok: false, error, matches: [] }, { status, headers });

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("invalid_request", 415);
  if (Number(request.headers.get("content-length") || 0) > 2048) return fail("invalid_request", 413);
  const reader = request.body?.getReader();
  if (!reader) return fail("invalid_request", 400);
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) { await reader.cancel(); return fail("invalid_request", 413); }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
  } catch { return fail("invalid_request", 400); }
  finally { reader.releaseLock(); }
  let query: string | null;
  try { query = cleanQuery(JSON.parse(raw)?.query); } catch { return fail("invalid_request", 400); }
  if (!query) return fail("invalid_query", 400);
  try {
    const upstream = await fetch(backendUrl("../public/company"), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25_000),
    });
    if (upstream.status === 429) return fail("rate_limited", 429);
    if (upstream.status >= 500 || upstream.status === 404) return fail("unavailable", 503);
    if (!upstream.ok) return fail("invalid_query", 400);
    if (!upstream.headers.get("content-type")?.includes("application/json")) return fail("unavailable", 503);
    const stream = upstream.body?.getReader();
    if (!stream) return fail("unavailable", 503);
    const responseDecoder = new TextDecoder();
    let text = ""; let bytes = 0;
    try {
      while (true) {
        const part = await stream.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 160_000) { await stream.cancel(); return fail("unavailable", 503); }
        text += responseDecoder.decode(part.value, { stream: true });
      }
      text += responseDecoder.decode();
    } finally { stream.releaseLock(); }
    const data = publicPayload(JSON.parse(text));
    if (!data) return fail("unavailable", 503);
    return Response.json(data, { headers });
  } catch { return fail("unavailable", 503); }
}
