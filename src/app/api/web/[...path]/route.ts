import { NextRequest } from "next/server";
import { proxyWebRequest } from "@/lib/workspace/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyWebRequest(request, (await context.params).path);
}
export const GET = handle;
export const POST = handle;
