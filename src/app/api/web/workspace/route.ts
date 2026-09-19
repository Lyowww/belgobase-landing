import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { privateHeaders, proxyWebRequest, webError } from "@/lib/workspace/gateway";
import { workspaceRelease } from "@/lib/workspace/release";
import { workspaceSecurityHeaders } from "@/lib/security-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResponse = await proxyWebRequest(request, ["auth", "session"]);
  if (!sessionResponse.ok) return webError("Meld je aan om BelgoBase te openen.", sessionResponse.status);
  const session = await sessionResponse.json();
  if (!session.authenticated) return webError("Meld je aan om BelgoBase te openen.", 401);
  const root = path.join(process.cwd(), "src/lib/workspace");
  const [original, desktopI18n, presentationI18n, adapter, polish] = await Promise.all([
    readFile(path.join(root, "assets/frozen-ui.html"), "utf8"),
    readFile(path.join(root, "assets/premium_i18n.js"), "utf8"),
    readFile(path.join(root, "browser-i18n.js"), "utf8"),
    readFile(path.join(root, "browser-adapter.js"), "utf8"),
    readFile(path.join(root, "browser-polish.css"), "utf8"),
  ]);
  const desktopMarker = '<script src="premium_i18n.js"></script>';
  if (!original.includes(desktopMarker) || [desktopI18n, presentationI18n, adapter].some(source => /<\/script/i.test(source))) {
    return webError("De werkruimte kon niet worden geladen.", 503);
  }
  const localized = original.replace(desktopMarker, `<script>${desktopI18n}</script>`);
  const marker = localized.lastIndexOf("<script>");
  if (marker < 0) return webError("De werkruimte kon niet worden geladen.", 503);
  const html = (localized.slice(0, marker) + `<script>${presentationI18n}</script><script>${adapter}</script>` + localized.slice(marker))
    .replace("connect-src 'none'", "connect-src 'self'")
    .replace("</head>", `<style>${polish}</style><meta name="belgobase-release" content="${await workspaceRelease()}"></head>`);
  return new Response(html, { headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8",
    ...workspaceSecurityHeaders,
  }});
}
