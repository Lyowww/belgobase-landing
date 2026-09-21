import { createPublicKey, verify } from "node:crypto";

export type LoginMail = {
  purpose: "belgobase-login-v1";
  email: string;
  code: string;
  challenge_id: string;
  issued_at: number;
  expires_at: number;
  language?: "nl" | "fr" | "en";
};

export function verifyLoginMail(raw: string, signature: string, publicKeyDer: string, now = Date.now() / 1000): LoginMail | null {
  try {
    if (!publicKeyDer || Buffer.byteLength(raw) > 4096 || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return null;
    const key = createPublicKey({ key: Buffer.from(publicKeyDer, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(raw, "utf8"), key, Buffer.from(signature, "base64"))) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const allowed = new Set(["purpose", "email", "code", "challenge_id", "issued_at", "expires_at", "language"]);
    if (Object.keys(value).some(key => !allowed.has(key))) return null;
    if (value.purpose !== "belgobase-login-v1" || typeof value.email !== "string" || value.email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.email)) return null;
    if (!/^\d{6}$/.test(value.code) || !/^[A-Za-z0-9_-]{16,128}$/.test(value.challenge_id)) return null;
    if (!Number.isInteger(value.issued_at) || !Number.isInteger(value.expires_at)) return null;
    if (value.issued_at > now + 15 || now - value.issued_at > 60 || value.expires_at <= now || value.expires_at > value.issued_at + 600) return null;
    if (value.language !== undefined && !["nl", "fr", "en"].includes(value.language)) return null;
    return value;
  } catch { return null; }
}

export function loginMailContent(mail: LoginMail) {
  if (mail.language === "fr") {
    return {
      subject: "Votre code de connexion BelgoBase",
      text: `Votre code BelgoBase est ${mail.code}. Il expire dans 10 minutes. Ne partagez jamais ce code. Si vous ne l’avez pas demandé, vous pouvez ignorer cet e-mail.`,
    };
  }
  if (mail.language === "en") {
    return {
      subject: "Your BelgoBase sign-in code",
      text: `Your BelgoBase code is ${mail.code}. It expires in 10 minutes. Never share this code. If you did not request it, you can ignore this email.`,
    };
  }
  return {
    subject: "Je BelgoBase-aanmeldcode",
    text: `Je BelgoBase-code is ${mail.code}. Deze vervalt binnen 10 minuten. Deel deze code met niemand. Heb je deze niet aangevraagd? Dan mag je dit bericht negeren.`,
  };
}
