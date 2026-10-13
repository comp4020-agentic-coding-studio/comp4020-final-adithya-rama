import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {TestPlayer} from "../spec/lib/client.ts";
import type {RoomListing} from "../src/shared/protocol.ts";
const base=process.env.APP_URL??"http://localhost:8105",out="test-results/oct14-room-cards";mkdirSync(out,{recursive:true});
const host=new TestPlayer(base),browser=await chromium.launch(),errors:string[]=[],checks:unknown[]=[];
try{
 await host.visit();await host.connect();await host.waitFor("welcome");const created=await host.http<{code:string}>("/api/rooms",{method:"POST",body:{name:"Arena preview check",isPublic:true,settings:{mode:"tdm",map:"pyramid",capacity:8,bots:3,flight:false,damage:.5}}});assert.equal(created.status,201);host.send({t:"join",code:created.body.code});await host.waitFor("room");
 const listing=(await host.http<{rooms:RoomListing[]}>("/api/rooms")).body.rooms.find(room=>room.code===created.body.code)!;
 for(const mobile of [false,true]){
  const tag=mobile?"phone":"desktop",context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1920,height:1080},hasTouch:mobile,isMobile:mobile}),page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base);const card=page.locator(".room-card").filter({hasText:"Arena preview check"});await card.waitFor();await card.scrollIntoViewIfNeeded();
  assert.equal(await card.locator(".room-thumb svg").count(),1);assert.match(await card.innerText(),/3 bots/);assert.match(await card.innerText(),/1 human/);for(const rule of listing.rules??[])assert.ok((await card.innerText()).includes(rule));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await card.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:out+"/"+tag+"-home-room.png"});await card.screenshot({path:out+"/"+tag+"-card.png"});checks.push({viewport:tag,thumbnail:true,humans:listing.humans,bots:listing.bots,rules:listing.rules,noHorizontalOverflow:true});await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{host.quit();await browser.close();writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),checks,errors},null,2));}
