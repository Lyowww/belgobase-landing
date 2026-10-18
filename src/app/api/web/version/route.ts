import { NextRequest } from "next/server";
import { privateHeaders, proxyWebRequest, webError } from "@/lib/workspace/gateway";
import { workspaceRelease } from "@/lib/workspace/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResponse = await proxyWebRequest(request, ["auth", "session"]);
  if (!sessionResponse.ok) {
    return webError("Meld je aan om BelgoBase te openen.", sessionResponse.status);
  }
  let session: { authenticated?: unknown } | null;
  try {
    session = await sessionResponse.json();
  } catch {
    return webError("De versiecontrole is tijdelijk niet beschikbaar.", 503);
  }
  if (session?.authenticated !== true) {
    return webError("Meld je aan om BelgoBase te openen.", 401);
  }
  try {
    return Response.json({ version: await workspaceRelease() }, { headers: privateHeaders });
  } catch {
    return webError("De versiecontrole is tijdelijk niet beschikbaar.", 503);
  }
}
