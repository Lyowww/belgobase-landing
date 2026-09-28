import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin=process.env.AUDIT_ORIGIN || "http://localhost:3017";
const output=process.env.AUDIT_OUTPUT;
assert.ok(output,"Set AUDIT_OUTPUT");
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
const page=await browser.newPage();
const report={origin,views:[],errors:[],failureFallback:false};
page.on("pageerror",e=>report.errors.push(String(e)));
try {
  for(const locale of ["nl","en"]) {
    for(const [width,height] of [[1440,900],[1366,768],[1024,768],[390,844],[360,640],[844,390]]) {
      await page.setViewportSize({width,height});
      assert.equal((await page.goto(`${origin}/${locale}`)).status(),200);
      const video=page.locator("#hero-product-demo");
      await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=1;});
      const box=await video.boundingBox();
      assert.ok(box.y>=60 && box.y+box.height<=height,`Video outside initial viewport: ${locale} ${width}x${height} ${JSON.stringify(box)}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      assert.equal(await video.evaluate(v=>v.paused && !v.loop && v.currentSrc.includes('guided-demo')),true);
      assert.equal(await page.locator('[data-demo-mode]').count(),0);
      const schema=await page.locator('script[type="application/ld+json"]').first().textContent();
      assert.ok(JSON.parse(schema)['@graph'].some(x=>x['@type']==='VideoObject' && x.contentUrl.endsWith('/belgobase-guided-demo.mp4')));
      if(width===1440 || width===390) {
        await page.screenshot({path:path.join(output,`${locale}-${width}-initial.png`)});
        await page.locator('button[aria-controls="hero-product-demo"]').click();
        await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.paused && !v.muted && v.currentTime>0;});
        await page.waitForFunction(()=>document.querySelector('video track').readyState===2);
        assert.equal(await video.locator('track').getAttribute('srclang'),locale);
      }
      report.views.push({locale,width,height,video:box,firstScreen:true});
    }
  }
  await page.route('**/belgobase-guided-demo.mp4',route=>route.abort());
  await page.goto(`${origin}/nl`);
  await page.getByRole('status').filter({hasText:'De video kan hier niet afspelen'}).waitFor();
  await page.getByText('Lees de demonstratie',{exact:true}).click();
  assert.ok(await page.locator('#hero-demo-transcript').isVisible());
  report.failureFallback=true;
  assert.deepEqual(report.errors,[]);
  await writeFile(path.join(output,'homepage-video-audit.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,views:report.views.length,failureFallback:true,errors:report.errors}));
} catch(e) {
  await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw e;
} finally {await browser.close();}
