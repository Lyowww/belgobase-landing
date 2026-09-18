import { Resend } from "resend";
import { resolveFromEmail } from "@/lib/email/resend";
import { loginMailContent, verifyLoginMail } from "@/lib/workspace/mail-relay";
import { mailRelayPublicKey } from "@/lib/workspace/mail-relay-public-key";
import { privateHeaders, webError } from "@/lib/workspace/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return webError("Ongeldige aanvraag.", 413);
  const raw = await request.text();
  const mail = verifyLoginMail(raw, request.headers.get("x-belgobase-mail-signature") ?? "", mailRelayPublicKey);
  if (!mail) return webError("Ongeldige aanvraag.", 403);
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return webError("Aanmelden is tijdelijk niet beschikbaar.", 503);
  try {
    const result = await new Resend(key).emails.send({
      from: resolveFromEmail(), to: mail.email, ...loginMailContent(mail),
    }, { idempotencyKey: `belgobase-login/${mail.challenge_id}` });
    if (result.error) return webError("Aanmelden is tijdelijk niet beschikbaar.", 503);
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch { return webError("Aanmelden is tijdelijk niet beschikbaar.", 503); }
}
