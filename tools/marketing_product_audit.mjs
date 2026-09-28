import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditPublicSite } from "./public_site_flows.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AUDIT_ORIGIN || "http://localhost:3017";
const output = process.env.AUDIT_OUTPUT;
assert.ok(output, "Set AUDIT_OUTPUT");
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, channel: "chrome"});
const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:"no-preference"});
const page = await context.newPage();
const report = {origin, routes:[], errors:[]};
page.on("pageerror", e=>report.errors.push(String(e)));
try {
  report.publicFlows = await auditPublicSite({page,context,appOrigin:origin,artifactDirectory:output});
  const sitemap = await (await context.request.get(`${origin}/sitemap.xml`)).text();
  for (const locale of ["nl","en"]) {
    for (const slug of ["prospectielijsten","klantenbestand-analyseren","bedrijfsanalyse"]) {
      const route = `/${locale}/${slug}`;
      const response = await page.goto(origin+route);
      assert.equal(response.status(),200);
      assert.equal(await page.locator("h1").count(),1);
      assert.ok((await page.locator("h1").innerText()).length>15);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      assert.equal(canonical, `https://belgobase.com${route}`);
      for (const lang of ["nl","en"]) assert.equal(await page.locator(`link[rel="alternate"][hreflang="${lang}"]`).getAttribute("href"),`https://belgobase.com/${lang}/${slug}`);
      assert.ok(sitemap.includes(canonical));
      assert.ok((await page.locator('meta[name="description"]').getAttribute("content")).length>50);
      for (const width of [390,1440]) {
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,`overflow ${route} ${width}`);
      }
      await page.locator(`a[href="/${locale}#contact"]`).first().click();
      await page.waitForURL(`**/${locale}#contact`);
      await page.locator("#contact").waitFor({state:"visible"});
      report.routes.push({route,canonical,status:200,mobileOverflow:false,contactLink:true});
    }
  }
  await page.goto(origin+"/nl");
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('video#hero-product-demo').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=1 && v.paused;});
  report.video=await page.locator('video#hero-product-demo').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,muted:v.muted,loop:v.loop,currentSrc:v.currentSrc}));
  assert.ok(report.video.duration>70);
  assert.equal(report.video.loop,false);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,"homepage-desktop.png")});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,"homepage-mobile.png")});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  assert.deepEqual(report.errors,[]);
  await writeFile(path.join(output,"marketing-product-audit.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,routes:report.routes.length,video:report.video,errors:report.errors}));
} catch(e) {
  await page.screenshot({path:path.join(output,"failure.png"),fullPage:true}).catch(()=>{});
  await writeFile(path.join(output,"failure.json"),JSON.stringify({error:String(e),url:page.url(),report},null,2));
  throw e;
} finally {await browser.close();}
