import { NextRequest } from "next/server";
import { privateHeaders, proxyWebRequest, webError } from "@/lib/workspace/gateway";
import { desktopRelease } from "@/lib/workspace/desktop-release.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await proxyWebRequest(request, ["auth", "session"]);
  if (!session.ok) return webError("Meld je aan om BelgoBase voor Windows te downloaden.", session.status);
  if (!(await session.json()).authenticated) return webError("Aanmelden vereist.", 401);
  try {
    const response = await fetch("https://api.belgobase.be/client-updates/manifest", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Release unavailable");
    const release = desktopRelease(await response.json());
    return new Response(null, { status: 307, headers: { ...privateHeaders, Location: release.url } });
  } catch {
    return webError("De Windows-download is tijdelijk niet beschikbaar. Probeer het later opnieuw.", 503);
  }
}
