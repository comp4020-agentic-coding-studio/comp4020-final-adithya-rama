// Two real browser identities. The loading check delays only incoming snapshots;
// all profiles, rooms, readiness, results and persistence use the real server.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium,type Page} from "playwright";
import {PILOT_PRESETS} from "../src/shared/avatar.ts";
import type {RosterEntry} from "../src/shared/protocol.ts";

const base=process.env.APP_URL??"http://localhost:8113";
const out="test-results/"+(process.env.REPORT_TAG??"pilots-local");mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),errors:string[]=[],checks:string[]=[];
const desktop=await browser.newContext({viewport:{width:1920,height:1080}});
const phone=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const host=await desktop.newPage(),guest=await phone.newPage();
const rosters=new Map<Page,RosterEntry[]>();
const audioFiles=new Map<Page,Set<string>>();
async function setup(page:Page){
  page.on("pageerror",e=>errors.push(e.message));
  audioFiles.set(page,new Set());
  page.on("response",response=>{if(response.url().includes("/audio/")&&response.url().endsWith(".ogg")&&response.ok())audioFiles.get(page)!.add(response.url());});
  await page.routeWebSocket("**/ws?*",socket=>{
    const server=socket.connectToServer();let releaseAt=0;
    server.onMessage(data=>{
      const message=JSON.parse(String(data));
      if(message.t==="match"){rosters.set(page,message.roster);releaseAt=Date.now()+5000;}
      if(message.t==="snap"&&Date.now()<releaseAt)return;
      socket.send(data);
    });
  });
}
async function profile(page:Page){return (await (await page.request.get(base+"/api/me")).json()).profile;}
async function saved(page:Page,action:()=>Promise<unknown>){
  const response=page.waitForResponse(r=>r.url().endsWith("/api/me")&&r.request().method()==="PATCH");
  await action();assert.equal((await response).status(),200);
}
async function configure(page:Page,preset:number,name:string,tag:string){
  await page.route("**/api/session",route=>route.fulfill({status:503,contentType:"application/json",body:'{"error":"Test startup failure"}'}));
  await page.goto(base);await page.getByRole("button",{name:"Try again",exact:true}).waitFor();
  await page.screenshot({path:`${out}/${tag}-startup-retry.png`});
  await page.unroute("**/api/session");await page.getByRole("button",{name:"Try again",exact:true}).click();
  await page.locator("#profile-button").click();
  assert.ok(await page.locator('[name="aimAssist"]').isChecked(),"assistance starts on");
  assert.ok(await page.locator('[name="sightGuide"]').isChecked(),"sight guide starts on");
  await page.locator(`[data-preset="${preset}"]`).click();
  await page.locator('#profile-form [name="name"]').fill(name);
  assert.equal(await page.locator('[name="body"]').inputValue(),PILOT_PRESETS[preset].avatar.body);
  await page.screenshot({path:`${out}/${tag}-creator.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator("#profile-drawer").evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await saved(page,()=>page.locator("#profile-form").getByRole("button",{name:"Save",exact:true}).click());
  await page.reload();await page.locator("#profile-button").waitFor();
  const p=await profile(page);assert.equal(p.name,name);assert.deepEqual(p.prefs.avatar,PILOT_PRESETS[preset].avatar);
  await page.getByText("Explore all equipment",{exact:true}).click();
  for(const gun of ["M93BA","Uzi"]) {
    const button=page.getByRole("button",{name:`Preview ${gun} sound`,exact:true});await button.click();
    await page.waitForFunction(name=>!(document.querySelector(`[aria-label="Preview ${name} sound"]`) as HTMLButtonElement)?.disabled,gun);
  }
  assert.equal(audioFiles.get(page)!.size,16,"all licensed clips fetched for preview");
  return p;
}
try {
  await setup(host);await setup(guest);
  const hp=await configure(host,1,"Nova UAT","desktop");
  const gp=await configure(guest,0,"Vanguard UAT","phone");
  assert.notEqual(hp.id,gp.id);checks.push("Startup failure offers working retry; armoury previews load all 16 credited clips on desktop and phone");
  checks.push("Independent desktop and phone pilots saved full appearance and callsigns across reloads");
  const created=await host.request.post(base+"/api/rooms",{data:{name:"Pilot release check",isPublic:false,settings:{mode:"tdm",map:"test-range",bots:0,durationMin:2}}});
  assert.equal(created.status(),201);const {code}=await created.json();
  for(const page of [host,guest]){
    await page.goto(base+"/r/"+code+"?renderProbe=1");
    await page.getByRole("button",{name:"Join room",exact:true}).click();
    await page.locator("#ready").waitFor();
  }
  for(const [page,tag] of [[host,"desktop"],[guest,"phone"]] as const){
    await page.waitForFunction(()=>document.querySelectorAll(".lobby-pilot svg").length===2);
    const labels=await page.locator(".lobby-pilot svg").evaluateAll(els=>els.map(el=>el.getAttribute("aria-label")));
    assert.ok(labels.some(label=>label?.includes("female")));
    assert.ok(labels.some(label=>label?.includes("male")));
    await page.screenshot({path:`${out}/${tag}-lobby.png`});
  }
  await guest.locator("#ready").click();await host.locator("#start:not(:disabled)").click();
  for(const [page,tag] of [[host,"desktop"],[guest,"phone"]] as const){
    await page.locator(".match-loading [data-stage='scene'].done").waitFor();
    await page.screenshot({path:`${out}/${tag}-loading.png`});
    assert.equal(await page.locator(".match-loading [data-stage='sync'].done").count(),0);
    const roster=rosters.get(page)!;
    assert.deepEqual(roster.find(r=>r.name==="Nova UAT")?.avatar,PILOT_PRESETS[1].avatar);
    assert.deepEqual(roster.find(r=>r.name==="Vanguard UAT")?.avatar,PILOT_PRESETS[0].avatar);
  }
  await host.locator(".match-loading").waitFor({state:"detached"});
  await guest.locator(".match-loading").waitFor({state:"detached"});
  checks.push("Both clients receive both complete cosmetic rosters; loading waits for a real snapshot and disappears when ready");
  for(const [page,tag] of [[host,"desktop"],[guest,"phone"]] as const){
    await page.locator("canvas").waitFor();await page.waitForTimeout(400);
    await page.screenshot({path:`${out}/${tag}-game.png`});
    if(page===host)await page.keyboard.press("Escape");
    else await page.getByRole("button",{name:"Menu",exact:true}).click();
    await saved(page,()=>page.locator("[data-aim-assist]").uncheck());
    await saved(page,()=>page.locator("[data-sight-guide]").uncheck());
    const p=await profile(page);assert.equal(p.prefs.aimAssist,false);assert.equal(p.prefs.sightGuide,false);
    await page.screenshot({path:`${out}/${tag}-field-menu.png`});
    // A failed save must not leave a checkbox claiming it saved.
    await page.route("**/api/me",route=>route.request().method()==="PATCH"?route.fulfill({status:503,contentType:"application/json",body:'{"error":"Test storage unavailable"}'}):route.continue());
    await page.locator("[data-aim-assist]").check();
    await page.getByText("Couldn’t save. Your previous aim setting has been restored.").waitFor();
    assert.equal(await page.locator("[data-aim-assist]").isChecked(),false);
    await page.unroute("**/api/me");
    await saved(page,()=>page.locator("[data-aim-assist]").check());
    await saved(page,()=>page.locator("[data-sight-guide]").check());
    await page.getByRole("button",{name:"Resume",exact:true}).click();
  }
  checks.push("Both input layouts can toggle assistance and sight guide; successful writes persist and failed writes visibly roll back");
  await host.keyboard.press("Escape");await host.getByRole("button",{name:"End round now"}).click();
  for(const page of [host,guest])await page.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await guest.getByRole("button",{name:"Leave room",exact:true}).click();
  await host.getByRole("button",{name:"Leave room",exact:true}).click();
  for(const page of [host,guest]){
    await page.reload();await page.locator("#profile-button").click();
    assert.ok(await page.locator('[name="aimAssist"]').isChecked());
    assert.ok(await page.locator('[name="sightGuide"]').isChecked());
  }
  checks.push("Completed results saved for both players; in-match preferences survive the next visit");
  assert.deepEqual(errors,[]);
  writeFileSync(out+"/report.json",JSON.stringify({base,at:new Date().toISOString(),checks,errors},null,2));
  console.log(JSON.stringify({base,checks,errors},null,2));
} finally {
  for(const page of [host,guest]){
    try{
      if(await page.locator("canvas").count()){
        if(page===host)await page.keyboard.press("Escape");else await page.getByRole("button",{name:"Menu",exact:true}).click();
      }
      const leave=page.getByRole("button",{name:"Leave room",exact:true});if(await leave.count())await leave.first().click({timeout:1500});
    }catch{}
  }
  await browser.close();
}
