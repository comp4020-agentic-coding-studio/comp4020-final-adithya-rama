import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
import {AVATAR_CHOICES} from "../src/shared/avatar.ts";
const base=process.env.APP_URL??"http://localhost:8127",out=`test-results/${process.env.REPORT_TAG??"creator-local"}`;
mkdirSync(out,{recursive:true});const browser=await chromium.launch(),errors:string[]=[],checks:string[]=[];
try {
 for(const phone of [false,true]) {
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1920,height:1080},hasTouch:phone,isMobile:phone});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base);await page.locator("#profile-button").click();
  assert.equal(await page.locator("#profile-form select").count(),0);
  const stage=await page.locator(".creator-stage").boundingBox(),editor=await page.locator(".creator-editor").boundingBox();
  assert.ok(stage&&editor);
  if(!phone){assert.ok(stage.x>editor.x+editor.width-1);assert.ok(stage.height>450);}
  await page.screenshot({path:`${out}/${phone?"phone":"desktop"}-full-pilot.png`});
  await page.locator('[data-category="hair"]').click();
  assert.equal(await page.locator('.creator-stage').getAttribute('data-view'),'face');
  const preservedHelmet=await page.locator('input[name="helmet"]:checked').inputValue();
  await page.locator('button[data-view="full"]').click();
  assert.equal(await page.locator('#avatar-preview svg').getAttribute('viewBox'),'0 0 120 130');
  assert.equal(await page.locator('input[name="helmet"]:checked').inputValue(),preservedHelmet);
  const chosen:Record<string,string>={};
  for(const [key,choices] of Object.entries(AVATAR_CHOICES)) {
   await page.locator(`[data-category="${key}"]`).click();
   for(const value of choices){await page.locator(`input[name="${key}"][value="${value}"]`).check();assert.ok(await page.locator(`input[name="${key}"][value="${value}"]`).isChecked());}
   chosen[key]=choices.at(-1)!;
  }
  for(const [key,value] of Object.entries({helmet:"none",hair:"bob",eyebrows:"angled",glasses:"none",face:"medium"})) {
   await page.locator(`[data-category="${key}"]`).click();await page.locator(`input[name="${key}"][value="${value}"]`).check();chosen[key]=value;
  }
  await page.locator('[data-category="eyebrows"]').click();
  await page.locator('#profile-form [name="name"]').fill(phone?"Pocket Pilot":"Workshop Pilot");
  await page.locator('button[data-pose="flight"]').click();
  assert.equal(await page.locator(".creator-stage").getAttribute("data-pose"),"flight");
  await page.locator('button[data-pose="idle"]').click();
  await page.locator("#profile-drawer").evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:`${out}/${phone?"phone":"desktop"}-creator.png`});
  assert.equal(await page.locator("#profile-drawer").evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  const response=page.waitForResponse(r=>r.url().endsWith("/api/me")&&r.request().method()==="PATCH");
  await page.locator('button.creator-save').click();assert.equal((await response).status(),200);
  await page.reload();await page.locator("#profile-button").click();
  const p=(await (await page.request.get(base+"/api/me")).json()).profile;
  assert.deepEqual(p.prefs.avatar,chosen);
  await page.route("**/api/me",route=>route.request().method()==="PATCH"?route.fulfill({status:503,json:{error:"Simulated storage unavailable"}}):route.continue());
  await page.locator('button.creator-save').click();await page.getByText("Simulated storage unavailable",{exact:true}).waitFor();
  assert.ok(await page.locator("#profile-drawer").isVisible());assert.ok(await page.locator("button.creator-save").isEnabled());
  await page.unroute("**/api/me");
  await page.emulateMedia({reducedMotion:"reduce"});
  assert.equal(await page.locator('#avatar-preview .avatar-rig').evaluate(el=>getComputedStyle(el).animationName),"none");
  checks.push(`${phone?"Phone":"Desktop"}: every visual choice selectable; saved appearance and eyebrows survive reload; save failure remains recoverable; reduced motion stops preview animation`);
  await context.close();
 }
 assert.deepEqual(errors,[]);const report={at:new Date().toISOString(),base,checks,errors};writeFileSync(out+"/report.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
