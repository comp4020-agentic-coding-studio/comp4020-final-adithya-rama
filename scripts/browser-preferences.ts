// Real UI regression coverage. Start a separate current-build server, then run:
// APP_URL=http://localhost:8096 node scripts/browser-preferences.ts
// The rAF sample describes this headless test host, not physical-device FPS.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { chromium, type Page } from "playwright";
import type { Profile, RoomView } from "../src/shared/protocol.ts";

const base=process.env.APP_URL??"http://localhost:8096";
const out="test-results";
mkdirSync(out,{recursive:true});
const errors:string[]=[];
const rooms=new Map<Page,RoomView>();
const checks:string[]=[];
const observations:Record<string,unknown>={};
function track(page:Page,label:string):void {
  page.on("pageerror",e=>errors.push(label+": "+e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(label+": "+m.text());});
  page.on("websocket",socket=>socket.on("framereceived",event=>{
    try{const m=JSON.parse(String(event.payload));if(m.t==="room")rooms.set(page,m.room);}catch{}
  }));
}
async function until(check:()=>boolean,label:string):Promise<void> {
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){if(check())return;await new Promise(r=>setTimeout(r,25));}
  assert.ok(check(),label);
}
async function noOverflow(page:Page,label:string):Promise<void> {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+" has horizontal overflow");
}
async function me(page:Page):Promise<Profile> {
  return (await (await page.request.get(base+"/api/me")).json()).profile;
}
async function saveProfile(page:Page):Promise<void> {
  const response=page.waitForResponse(r=>r.url().endsWith("/api/me")&&r.request().method()==="PATCH");
  await page.locator("#profile-form").getByRole("button",{name:"Save",exact:true}).click();
  assert.equal((await response).status(),200);
}
async function sendChat(page:Page,text:string):Promise<void> {
  // Respect the server's 800 ms chat rate limit.
  await page.waitForTimeout(850);
  await page.locator('[data-chat-form] input').fill(text);
  await page.locator("[data-chat-form]").getByRole("button",{name:"Send",exact:true}).click();
}
async function sampleFrames(page:Page):Promise<unknown> {
  await page.bringToFront();
  return await page.evaluate(async()=>{
    const canvas=document.createElement("canvas");
    const gl=canvas.getContext("webgl");
    const ext=gl?.getExtension("WEBGL_debug_renderer_info");
    const graphics=gl?{vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}:null;
    const durations:number[]=[];
    await new Promise<void>(resolve=>{
      let start=0,last=0;
      const frame=(now:number)=>{
        if(!start){start=now;last=now;}else {durations.push(now-last);last=now;}
        if(now-start>=3000)resolve();else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const sorted=[...durations].sort((a,b)=>a-b);
    const elapsed=durations.reduce((a,b)=>a+b,0);
    return {kind:"requestAnimationFrame cadence during live gameplay",durationMs:elapsed,frames:durations.length,averageFps:durations.length*1000/elapsed,p50FrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},hardwareConcurrency:navigator.hardwareConcurrency,userAgent:navigator.userAgent,graphics};
  });
}

const browser=await chromium.launch();
const desktop=await browser.newContext({viewport:{width:1920,height:1080}});
const phone=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const host=await desktop.newPage(),guest=await phone.newPage();
track(host,"desktop");track(guest,"phone");
try {
  await host.goto(base);await host.locator("#profile-form").waitFor();
  await noOverflow(host,"desktop home");
  await host.locator('#profile-form input[name="name"]').fill("Prefs Desktop");
  await host.locator('#profile-form select[name="helmet"]').selectOption("visor");
  await host.locator('#profile-form select[name="face"]').selectOption("robot");
  await host.locator('#profile-form select[name="emblem"]').selectOption("star");
  await host.locator('#profile-form input[name="muted"]').check();
  await host.locator('#profile-form input[name="reducedShake"]').check();
  await host.locator('#profile-form input[name="volume"]').fill("0.6");
  await saveProfile(host);
  await host.reload();await host.locator("#profile-form").waitFor();
  assert.equal(await host.locator('select[name="helmet"]').inputValue(),"visor");
  assert.equal(await host.locator('select[name="face"]').inputValue(),"robot");
  assert.equal(await host.locator('select[name="emblem"]').inputValue(),"star");
  assert.equal(await host.locator('input[name="muted"]').isChecked(),true);
  assert.equal(await host.locator('input[name="reducedShake"]').isChecked(),true);
  assert.equal(await host.locator('input[name="volume"]').inputValue(),"0.6");
  assert.deepEqual((await me(host)).prefs.avatar,{helmet:"visor",face:"robot",emblem:"star"});
  checks.push("Avatar, audio volume/mute and reduced-shake preferences survive reload");

  await host.locator("#bindings").click();
  await host.locator('dialog [data-action="1"]').click();
  await host.locator('dialog [data-action="2"]').click();
  await host.keyboard.press("KeyL");
  await host.locator("dialog [data-save]").click();
  await host.locator("dialog").waitFor({state:"detached"});
  const bindings=(await me(host)).prefs.bindings as Record<string,number>;
  assert.equal(bindings.KeyA,1,"cancelled left-action capture must remain A");
  assert.equal(bindings.KeyL,2,"only most recently selected action captures L");
  assert.equal(bindings.KeyD,undefined);
  await host.locator("#bindings").click();
  assert.equal(await host.locator('dialog [data-action="1"]').innerText(),"A");
  assert.equal(await host.locator('dialog [data-action="2"]').innerText(),"L");
  await host.locator('dialog [data-action="4"]').click();
  await host.locator("dialog [data-close]").click();
  await host.keyboard.press("KeyP");
  assert.deepEqual((await me(host)).prefs.bindings,bindings);
  checks.push("Keyboard remapping persists; changing capture target and closing dialog cancel earlier handlers");

  await host.locator("#create").evaluate((d:HTMLDetailsElement)=>d.open=true);
  await host.locator('#create-form input[name="name"]').fill("Browser preferences");
  await host.locator('#create-form input[name="password"]').fill("room-proof");
  await host.locator('#create-form select[name="mode"]').selectOption("flag");
  await host.locator('#create-form select[name="map"]').selectOption("cryptworks");
  await host.locator("#create-form button").click();
  await host.locator("#start").waitFor();
  const code=await host.locator(".code").innerText();
  await host.locator('[data-setting="bots"]').selectOption("1");
  await until(()=>rooms.get(host)?.settings.bots===1,"host bot setting");
  await host.locator('[data-setting="gravity"]').selectOption("1.5");
  await until(()=>rooms.get(host)?.settings.gravity===1.5,"host gravity setting");
  await host.locator(".arsenal-settings summary").click();
  await host.locator('[data-loadout="0"]').selectOption("magnum");
  await until(()=>rooms.get(host)?.settings.loadout[0]==="magnum","lobby loadout setting");
  await host.locator("#save-preset").click();
  await host.locator('dialog input[name="name"]').fill("Browser regression rules");
  await host.getByRole("button",{name:"Save preset",exact:true}).click();
  await host.locator("dialog").waitFor({state:"detached"});
  const presetId=await host.locator('#presets option').filter({hasText:"Browser regression rules"}).getAttribute("value");
  assert.ok(presetId);
  await host.locator('[data-setting="gravity"]').selectOption("2");
  await until(()=>rooms.get(host)?.settings.gravity===2,"changed gravity");
  await host.locator("#presets").selectOption(presetId!);
  await host.locator("#apply-preset").click();
  await until(()=>rooms.get(host)?.settings.gravity===1.5,"applied saved preset");
  assert.equal(rooms.get(host)?.settings.loadout[0],"magnum");
  await host.locator("#presets").selectOption(presetId!);
  await host.locator("#delete-preset").click();
  await host.waitForFunction(id=>!document.querySelector('#presets option[value="'+id+'"]'),presetId);
  checks.push("Named preset saved, reapplied after edits, then deleted through UI");

  await guest.goto(base);await guest.locator("#join-form").waitFor();
  await noOverflow(guest,"phone home");
  await guest.locator('#join-form input[name="code"]').fill(code);
  await guest.locator('#join-form input[name="password"]').fill("wrong-proof");
  await guest.locator("#join-form button").click();
  await guest.locator(".toast.error").filter({hasText:/password/i}).waitFor();
  await guest.locator('#join-form input[name="code"]').fill(code);
  await guest.locator('#join-form input[name="password"]').fill("room-proof");
  await guest.locator("#join-form button").click();
  await guest.locator("#ready").waitFor();
  await noOverflow(guest,"phone lobby");
  await noOverflow(host,"desktop lobby");
  checks.push("Password-protected room refuses wrong password and joins with correct password via phone UI");

  await sendChat(host,"Hello phone pilot");
  await guest.locator("[data-chat-log]").getByText("Hello phone pilot",{exact:false}).waitFor();
  const muteResponse=guest.waitForResponse(r=>r.url().endsWith("/api/me")&&r.request().method()==="PATCH");
  await guest.locator("[data-chat-mute]").check();
  await muteResponse;
  await sendChat(host,"This message is muted");
  await guest.waitForTimeout(300);
  assert.equal((await guest.locator("[data-chat-log]").innerText()).includes("This message is muted"),false);
  const unmuteResponse=guest.waitForResponse(r=>r.url().endsWith("/api/me")&&r.request().method()==="PATCH");
  await guest.locator("[data-chat-mute]").uncheck();
  await unmuteResponse;
  await sendChat(host,"Chat restored");
  await guest.locator("[data-chat-log]").getByText("Chat restored",{exact:false}).waitFor();
  checks.push("Room chat delivered; persisted mute suppresses messages; unmute restores delivery");

  await guest.locator("#spectate").click();
  await until(()=>rooms.get(guest)?.members.find(m=>m.key===rooms.get(guest)?.you)?.spectator===true,"phone spectator toggle");
  await host.locator("#start").click();
  await host.locator("canvas").waitFor();await guest.locator("canvas").waitFor();
  await guest.locator(".spectator-controls").waitFor({state:"visible"});
  await guest.locator("[data-follow='1']").click();
  await noOverflow(guest,"phone spectator match");
  assert.match(await guest.locator('[data-el="following"]').innerText(),/Following/);
  checks.push("Phone spectator enters live match and can change followed pilot");

  await host.keyboard.press("Escape");
  await host.getByRole("button",{name:"Next-round rules"}).click();
  await host.locator("dialog .arsenal-settings summary").click();
  await host.locator('dialog [data-loadout="0"]').selectOption("m14");
  await host.locator('dialog [data-loadout="1"]').selectOption("golden-eagle");
  await host.locator('dialog [data-setting="gravity"]').selectOption("2");
  await host.locator('dialog [data-setting="flight"]').uncheck();
  await host.locator('dialog [data-weapon="uzi"]').uncheck();
  await host.locator('dialog [data-throwable="mine"]').uncheck();
  await until(()=>rooms.get(host)?.nextSettings?.loadout[0]==="m14"&&rooms.get(host)?.nextSettings?.loadout[1]==="golden-eagle"&&rooms.get(host)?.nextSettings?.flight===false&&!rooms.get(host)?.nextSettings?.throwables.includes("mine"),"all sequential modal edits staged together");
  const live=rooms.get(host)!;
  assert.deepEqual(live.settings.loadout,["magnum","uzi"],"active round loadout remains frozen");
  assert.equal(live.settings.gravity,1.5);
  assert.equal(live.settings.flight,true);
  assert.equal(live.nextSettings!.gravity,2);
  assert.equal(live.nextSettings!.weapons.includes("uzi"),false);
  assert.deepEqual(live.nextSettings!.loadout,["m14","golden-eagle"]);
  await host.screenshot({path:out+"/preferences-desktop-next-rules.png"});
  await host.locator("dialog [data-close]").click();
  await host.getByRole("button",{name:"End round now"}).click();
  await host.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await host.locator("#rematch").click();
  await host.locator("#start").waitFor();
  await until(()=>rooms.get(host)?.settings.loadout[0]==="m14"&&rooms.get(host)?.settings.loadout[1]==="golden-eagle","staged loadouts applied on rematch");
  assert.equal(rooms.get(host)?.settings.flight,false);
  assert.equal(rooms.get(host)?.settings.gravity,2);
  checks.push("Successive next-round loadout, movement and allowlist edits accumulate; active rules stay frozen; rematch applies all");

  await host.locator("#start").click();
  await host.locator("canvas").waitFor();await guest.locator("canvas").waitFor();
  await host.waitForTimeout(1500);
  observations.desktop=await sampleFrames(host);
  observations.phone=await sampleFrames(guest);
  await guest.screenshot({path:out+"/preferences-phone-spectator.png"});
  await host.keyboard.press("Escape");
  await host.getByRole("button",{name:"End round now"}).click();
  await host.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await guest.getByRole("button",{name:"Leave room",exact:true}).click();
  await host.getByRole("button",{name:"Leave room",exact:true}).click();

  // An invite may need to enter a full/private one-human training room as a
  // spectator from the start: joining as a fighter first would be refused.
  await host.locator("#range").click();
  await host.locator("canvas").waitFor();
  const rangeCode=rooms.get(host)!.code;
  await guest.goto(base+"/r/"+rangeCode);
  await guest.locator('dialog input[name="spectate"]').check();
  await guest.getByRole("button",{name:"Join room",exact:true}).click();
  await guest.locator("canvas").waitFor();
  await guest.locator(".spectator-controls").waitFor({state:"visible"});
  checks.push("Private full training-room invite joins directly as spectator");
  await host.keyboard.press("Escape");
  await host.getByRole("button",{name:"End round now"}).click();
  await host.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await guest.getByRole("button",{name:"Leave room",exact:true}).click();
  await host.getByRole("button",{name:"Leave room",exact:true}).click();
  assert.deepEqual(errors,[],"browser console/page errors");
  const report={at:new Date().toISOString(),base,checks,errors,environment:{browser:browser.version(),headless:true,node:process.version,platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,hostMemoryGiB:Math.round(os.totalmem()/1024**3)},observations,limitation:"requestAnimationFrame cadence on this headless host with emulated viewports. This is not physical phone, integrated-GPU, network-quality, or production performance validation."};
  writeFileSync(out+"/browser-preferences.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
} catch(e) {
  console.error(e);
  await host.screenshot({path:out+"/preferences-failure-desktop.png",fullPage:true}).catch(()=>{});
  await guest.screenshot({path:out+"/preferences-failure-phone.png",fullPage:true}).catch(()=>{});
  process.exitCode=1;
} finally {await browser.close();}
