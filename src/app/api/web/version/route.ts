import { workspaceRelease } from "@/lib/workspace/release";
import { privateHeaders, webError } from "@/lib/workspace/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ version: await workspaceRelease() }, { headers: privateHeaders });
  } catch {
    return webError("De versiecontrole is tijdelijk niet beschikbaar.", 503);
  }
}
