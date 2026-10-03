import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const htmlFiles = [
  new URL("./assets/frozen-ui.html", import.meta.url),
  ...(process.env.BELGOBASE_PC1_UI_PATH ? [pathToFileURL(process.env.BELGOBASE_PC1_UI_PATH)] : []),
];

function functionSource(html, name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `function ${name} exists`);
  const bodyStart = html.indexOf("{", start + marker.length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(char)) { quote = char; continue; }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

async function helpersFor(url) {
  const html = await readFile(url, "utf8");
  const names = ["detailYears", "yearMetricValue", "safeContactHref", "contactRow"];
  const context = vm.createContext({
    URL,
    display: value => value === null || value === undefined || value === "" ? "—" : String(value),
    esc: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  });
  vm.runInContext(`${names.map(name => functionSource(html, name)).join("\n")}\nglobalThis.result={${names.join(",")}};`, context);
  return context.result;
}

for (const url of htmlFiles) {
  const label = url.pathname.includes("frozen-ui.html") ? "web" : "desktop";

  test(`${label} profile year selection keeps same-year metrics without inventing history`, async () => {
    const { detailYears, yearMetricValue } = await helpersFor(url);
    const detail = {
      history: { years: [2023], series: { revenue: [0], profit: [null], fte: [2] } },
      metrics: [
        { key: "revenue", year: 2024, value: 125 },
        { key: "profit", year: 2023, value: 50 },
        { key: "equity", year: 2024, value: 300 },
      ],
    };
    assert.deepEqual([...detailYears(detail)], ["2024", "2023"]);
    assert.equal(yearMetricValue(detail, "revenue", 2024), 125, "a current metric remains visible when history has no row for its year");
    assert.equal(yearMetricValue(detail, "revenue", 2023), 0, "zero is a valid historic value");
    assert.equal(yearMetricValue(detail, "profit", 2023), null, "a null history cell must not be backfilled from a metric");
    assert.equal(yearMetricValue(detail, "equity", 2024), 300, "enriched metrics use their own reference year");
    assert.equal(yearMetricValue(detail, "equity", 2023), null, "metrics from another year are not reused");
  });

  test(`${label} profile links allow only safe contact schemes and escape displayed values`, async () => {
    const { safeContactHref, contactRow } = await helpersFor(url);
    assert.equal(safeContactHref("https://example.be/path", "website"), "https://example.be/path");
    assert.equal(safeContactHref("javascript:alert(1)", "website"), "");
    assert.equal(safeContactHref("data:text/html,hello", "website"), "");
    assert.equal(safeContactHref("bad@example", "email"), "");
    assert.equal(safeContactHref("+32 (0) 3 555 12 34", "phone"), "tel:+32035551234");
    assert.match(contactRow("Website", 'https://x.be/\"<img src=x>', "website"), /rel="noopener noreferrer"/);
    assert.doesNotMatch(contactRow("Website", 'https://x.be/\"<img src=x>', "website"), /<img/);
  });
}
