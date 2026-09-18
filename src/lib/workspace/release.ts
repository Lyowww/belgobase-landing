import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Bind the version to the actual delivered workspace, never a hand-maintained label.
export async function workspaceRelease() {
  const root = path.join(process.cwd(), "src/lib/workspace");
  const files = await Promise.all([
    readFile(path.join(root, "assets/frozen-ui.html")),
    readFile(path.join(root, "assets/premium_i18n.js")),
    readFile(path.join(root, "browser-i18n.js")),
    readFile(path.join(root, "browser-adapter.js")),
  ]);
  const hash = createHash("sha256");
  for (const file of files) hash.update(file);
  hash.update(process.env.VERCEL_GIT_COMMIT_SHA || "local");
  return hash.digest("hex");
}
