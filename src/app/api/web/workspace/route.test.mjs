import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("./route.ts", import.meta.url), "utf8");
const release = await readFile(new URL("../../../../lib/workspace/release.ts", import.meta.url), "utf8");

test("workspace route embeds the frozen desktop catalogue before the workspace code", () => {
  assert.match(route, /assets\/premium_i18n\.js/);
  assert.match(route, /browser-i18n\.js/);
  assert.match(route, /<script>\$\{desktopI18n\}<\/script>/);
  assert.match(route, /<script>\$\{presentationI18n\}<\/script><script>\$\{adapter\}<\/script>/);
});

test("workspace release changes when either language asset changes", () => {
  assert.match(release, /assets\/premium_i18n\.js/);
  assert.match(release, /browser-i18n\.js/);
});
