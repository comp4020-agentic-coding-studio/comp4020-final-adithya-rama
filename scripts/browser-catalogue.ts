// UI catalogue acceptance using disposable guests and private rooms.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { MAPS } from "../src/shared/maps.ts";
const base=process.env.APP_URL??"http://localhost:8093",out="test-results/"+(process.env.REPORT_TAG??"oct13-catalogue");
mkdirSync(out,{recursive:true});
const maps=Object.values(MAPS).filter(m=>m.id!=="test-range");
assert.equal(maps.length,6);
const browser=await chromium.launch(),errors:string[]=[],checks:unknown[]=[];
try {
 for(const mobile of [false,true]) {
  const tag=mobile?"phone":"desktop";
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(tag+": "+e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(tag+": "+m.text());});
  await page.goto(base);await page.locator("#practice").waitFor();
  await page.locator("#profile-button").click();await page.locator("#profile-form").waitFor();
  assert.equal(await page.locator("#profile-drawer").evaluate(el=>el.scrollWidth>el.clientWidth+2),false,"profile horizontal overflow");
  await page.screenshot({path:out+"/"+tag+"-profile.png"});
  await page.getByRole("button",{name:"Close pilot profile",exact:true}).click();
  await page.getByText("Explore all equipment",{exact:true}).click();
  await page.locator(".armoury-grid").scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".armoury-grid>div").count(),23);
  const cards=await page.locator(".armoury-grid>div").evaluateAll(els=>els.map(el=>({name:el.querySelector("b")?.textContent,text:el.textContent,overflow:el.scrollWidth>el.clientWidth+2, width:el.getBoundingClientRect().width})));
  assert.ok(cards.every(c=>!c.overflow&&c.width>=100),"armory cards fit readable columns");
  assert.ok(cards.find(c=>c.name==="Riot shield")?.text?.includes("selecting a gun drops it"));
  await page.locator(".armoury").screenshot({path:out+"/"+tag+"-armoury.png"});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"home horizontal overflow");
  await page.locator("#create>summary").click();
  const options=await page.locator('#create-form select[name="map"] option').evaluateAll(els=>els.map(el=>(el as HTMLOptionElement).value));
  assert.deepEqual(options,maps.map(m=>m.id),"all six create-room arena options");
  await page.locator('#create-form select[name="mode"]').selectOption("flag");
  await page.locator('#create-form select[name="map"]').selectOption(maps[5].id);
  await page.locator('#create-form input[name="isPublic"]').uncheck();
  await page.locator('#create-form button[type="submit"],#create-form button.primary').click();
  await page.locator("#leave").waitFor();
  const lobbyOptions=await page.locator('select[data-setting="map"] option').evaluateAll(els=>els.map(el=>(el as HTMLOptionElement).value));
  assert.deepEqual(lobbyOptions,maps.map(m=>m.id),"all six flag lobby arena options");
  for(const map of maps) {
   await page.locator('select[data-setting="map"]').selectOption(map.id);
   await page.waitForFunction(({id,name})=>{
    const select=document.querySelector<HTMLSelectElement>('select[data-setting="map"]');
    return select?.value===id&&document.querySelector(".lobby-map-preview>b")?.textContent===name;
   },{id:map.id,name:map.name});
   // Network acknowledgement re-renders the preview, proving the server accepted this map.
   await page.locator(".lobby-map-preview").screenshot({path:out+"/"+tag+"-"+map.id+".png"});
  }
  await page.screenshot({path:out+"/"+tag+"-lobby.png",fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"lobby horizontal overflow");
  await page.locator("#leave").click();await page.locator("#practice").waitFor();
  checks.push({viewport:tag,profileNoHorizontalOverflow:true,armoryCards:cards.length,minimumCardWidth:Math.min(...cards.map(c=>c.width)),arenaOptions:maps.map(m=>m.name),flagRoomAcceptedEveryArena:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);
 writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),base,checks,errors,limits:"UI selection, server-acknowledged lobby previews and emulated viewports; no gameplay balance or physical-device claim."},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
