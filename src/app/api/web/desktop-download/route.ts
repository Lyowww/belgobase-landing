import { NextRequest } from "next/server";
import { privateHeaders, proxyWebRequest, webError } from "@/lib/workspace/gateway";
import { desktopRelease } from "@/lib/workspace/desktop-release.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const languages = new Set(["nl", "fr", "en"]);
const messages = {
  nl: { signIn: "Meld je aan om BelgoBase voor Windows te downloaden.", unavailable: "De Windows-download is tijdelijk niet beschikbaar. Probeer het later opnieuw." },
  fr: { signIn: "Connectez-vous pour télécharger BelgoBase pour Windows.", unavailable: "Le téléchargement Windows est temporairement indisponible. Réessayez plus tard." },
  en: { signIn: "Sign in to download BelgoBase for Windows.", unavailable: "The Windows download is temporarily unavailable. Try again later." },
} as const;

export async function GET(request: NextRequest) {
  const requestedLanguage = request.nextUrl.searchParams.get("lang") ?? "nl";
  const language = languages.has(requestedLanguage) ? requestedLanguage as keyof typeof messages : "nl";
  const text = messages[language];
  const session = await proxyWebRequest(request, ["auth", "session"]);
  if (!session.ok) return webError(session.status === 401 ? text.signIn : text.unavailable, session.status);
  let sessionData: unknown;
  try { sessionData = await session.json(); }
  catch { return webError(text.unavailable, 503); }
  if (!sessionData || typeof sessionData !== "object" || (sessionData as { authenticated?: unknown }).authenticated !== true) return webError(text.signIn, 401);
  try {
    const response = await fetch("https://api.belgobase.be/client-updates/manifest", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Release unavailable");
    const release = desktopRelease(await response.json());
    if (request.nextUrl.searchParams.get("format") === "json") {
      return Response.json({ ok: true, ...release }, { headers: privateHeaders });
    }
    return new Response(null, { status: 307, headers: { ...privateHeaders, Location: release.url } });
  } catch {
    return webError(text.unavailable, 503);
  }
}
