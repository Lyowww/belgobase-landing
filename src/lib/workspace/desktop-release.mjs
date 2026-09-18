import { createPublicKey, verify } from "node:crypto";

// Same public update key as the signed Windows updater (not a secret).
const updateKey = createPublicKey({
  key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from("ybgRkzQqIALg58kNOB2DZZJv35ymLuV7tgd0syB7y6w", "base64url")]),
  format: "der", type: "spki",
});
const origin = "https://api.belgobase.be";

export function desktopRelease(manifest, now = Date.now()) {
  const s = manifest?.signed;
  const signature = manifest?.signature;
  if (!s || !signature || signature.algorithm !== "Ed25519" || signature.key_id !== "belgobase-update-ed25519-2026-01") throw new Error("Invalid update manifest");
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(s).sort().map(key => [key, s[key]])));
  if (!verify(null, Buffer.from(canonical, "utf8"), updateKey, Buffer.from(signature.value, "base64url"))) throw new Error("Invalid update signature");
  if (s.app !== "BelgoBaseCloudClient" || s.channel !== "stable" || s.public_base_url !== origin || s.key_id !== signature.key_id) throw new Error("Invalid release identity");
  if (!Number.isInteger(s.latest_build) || !Number.isInteger(s.release_sequence) || s.latest_build < 100 || s.release_sequence < 48) throw new Error("Obsolete release");
  const filename = `BelgoBase_CloudClient_Setup_BUILD${s.latest_build}_UPDATE${s.release_sequence}.exe`;
  if (s.installer_filename !== filename || s.download_path !== `/client-updates/download/${filename}` || !/^[a-f0-9]{64}$/.test(s.sha256) || !Number.isSafeInteger(s.size) || s.size <= 0) throw new Error("Invalid installer");
  const published = Date.parse(s.published_at), expires = Date.parse(s.expires_at);
  if (!Number.isFinite(published) || !Number.isFinite(expires) || published > now + 300000 || expires <= now) throw new Error("Expired update manifest");
  return { url: origin + s.download_path, build: s.latest_build, update: s.release_sequence, sha256: s.sha256, size: s.size };
}
