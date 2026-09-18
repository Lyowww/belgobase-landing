import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { privateHeaders, proxyWebRequest, webError } from "@/lib/workspace/gateway";
import { workspaceRelease } from "@/lib/workspace/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResponse = await proxyWebRequest(request, ["auth", "session"]);
  if (!sessionResponse.ok) return webError("Meld je aan om BelgoBase te openen.", sessionResponse.status);
  const session = await sessionResponse.json();
  if (!session.authenticated) return webError("Meld je aan om BelgoBase te openen.", 401);
  const root = path.join(process.cwd(), "src/lib/workspace");
  const [original, adapter] = await Promise.all([
    readFile(path.join(root, "assets/frozen-ui.html"), "utf8"),
    readFile(path.join(root, "browser-adapter.js"), "utf8"),
  ]);
  const marker = original.lastIndexOf("<script>");
  if (marker < 0 || /<\/script/i.test(adapter)) return webError("De werkruimte kon niet worden geladen.", 503);
  const html = (original.slice(0, marker) + `<script>${adapter}</script>` + original.slice(marker))
    .replace("connect-src 'none'", "connect-src 'self'")
    .replace("</head>", `<meta name="belgobase-release" content="${await workspaceRelease()}"></head>`);
  return new Response(html, { headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'none'",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=()",
  }});
}
