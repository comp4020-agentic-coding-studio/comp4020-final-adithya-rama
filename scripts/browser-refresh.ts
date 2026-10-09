// Real browser controls and observed authoritative traffic for the October revision.
// Uses dedicated guests/private rooms only; does not inject or mutate game state.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { GameEvent, PlayerSnap, WorldSnapshot } from "../src/shared/types.ts";

const base=process.env.APP_URL??"http://localhost:8081";
const out="test-results/"+(process.env.REPORT_TAG??"oct10-refresh");
mkdirSync(out,{recursive:true});
const evidence:Record<string,unknown>[]=[], failures:string[]=[];
const browser=await chromium.launch();
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(test:()=>boolean,label:string,ms=10000) {
  const end=Date.now()+ms;
  while(!test()){if(Date.now()>end)throw Error("Timed out: "+label);await delay(25);}
}
function observe(page:Page) {
  const state={you:null as number|null,snap:null as WorldSnapshot|null,events:[] as GameEvent[],saved:false,matchId:""};
  page.on("pageerror",e=>failures.push(e.message));
  page.on("console",m=>{if(m.type()==="error")failures.push(m.text());});
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
    const m=JSON.parse(String(payload));
    if(m.t==="match"){state.you=m.you;state.matchId=m.matchId;state.saved=false;state.events=[];}
    if(m.t==="snap"){state.snap=m;state.events.push(...m.events);if(state.events.length>10000)state.events.splice(0,2000);}
    if(m.t==="save"&&m.save==="saved")state.saved=true;
  }));
  return state;
}
type Observed=ReturnType<typeof observe>;
const own=(s:Observed):PlayerSnap=>{const p=s.snap?.players.find(p=>p.id===s.you);assert.ok(p,"own authoritative player");return p;};
const angleClose=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<.08;
async function tap(page:Page,key:string,ms=100){await page.keyboard.down(key);await delay(ms);await page.keyboard.up(key);await delay(80);}
async function checkFit(page:Page,label:string) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+" horizontal overflow");
}
async function enter(page:Page,code:string,spectate=false){
  await page.goto(base+"/r/"+code);
  if(spectate)await page.locator('dialog input[name="spectate"]').check();
  await page.getByRole("button",{name:"Join room",exact:true}).click();
  await page.locator("#ready").waitFor();
}
async function roomCode(page:Page,settings:Record<string,unknown>){
  const res=await page.request.post(base+"/api/rooms",{data:{name:"Refresh acceptance",isPublic:false,settings}});
  assert.equal(res.status(),201,await res.text());return (await res.json()).code as string;
}
async function begin(page:Page,s:Observed,map="test-range"){
  const code=await roomCode(page,{mode:"training",map,bots:0,durationMin:2,health:2,damage:.5,
    loadout:["mini-eagle","uzi","spas12"],mapPickups:false,unlimitedFuel:true});
  await enter(page,code);await page.locator("#start").click();
  await page.locator("canvas").waitFor();await until(()=>s.you!==null&&s.snap!==null,"match snapshot");
  await delay(400);
}
async function finish(page:Page,s:Observed,touch=false){
  if(touch)await page.getByRole("button",{name:"Menu",exact:true}).click();
  else await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"End round now",exact:true}).click();
  await page.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await until(()=>s.saved,"saved acknowledgement");
  await page.getByRole("button",{name:"Leave room",exact:true}).click();
  await page.locator("#practice").waitFor();
}
async function grenade(page:Page,s:Observed,id:string){
  for(let n=0;own(s).throwable!==id&&n<7;n++)await tap(page,"KeyT");
  assert.equal(own(s).throwable,id,"selected grenade");
  // Aim with ordinary arrow key; only numpad directions auto-fire.
  await tap(page,"ArrowDown");
  await tap(page,"KeyG");
}
try {
  const desktop=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await desktop.newPage(),s=observe(page);
  await page.goto(base);await page.locator("#practice").waitFor();await checkFit(page,"desktop home");
  await page.screenshot({path:out+"/desktop-home.png",fullPage:true});
  if(await page.locator("#profile-button").count()){
    await page.locator("#profile-button").click();await page.locator("#profile-form").waitFor();
    await page.screenshot({path:out+"/desktop-profile.png",fullPage:true});await page.keyboard.press("Escape");
  }
  await begin(page,s);
  assert.equal(own(s).slots.length,3);
  assert.equal(await page.locator(".weapon-card[data-slot]").count(),3);
  await page.mouse.move(1700,450);
  await page.keyboard.down("KeyA");await until(()=>angleClose(own(s).aim,Math.PI),"movement faces left");await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");await until(()=>angleClose(own(s).aim,0),"movement faces right");await page.keyboard.up("KeyD");
  const aimCases=[{keys:["Numpad4"],a:Math.PI},{keys:["Numpad6"],a:0},{keys:["Numpad8"],a:-Math.PI/2},{keys:["Numpad2"],a:Math.PI/2},{keys:["Numpad6","Numpad8"],a:-Math.PI/4}];
  for(const c of aimCases){
    const before=s.events.filter(e=>e.t==="shot").length;
    for(const k of c.keys)await page.keyboard.down(k);
    await until(()=>angleClose(own(s).aim,c.a)&&s.events.filter(e=>e.t==="shot").length>before,"held directional aim and fire "+c.keys.join("+"));
    for(const k of c.keys)await page.keyboard.up(k);
  }
  evidence.push({check:"keyboard directions",directions:aimCases.map(c=>c.keys.join("+")),movementFacing:true});
  await tap(page,"Digit3");await until(()=>own(s).a===2,"slot 3 selection");
  await tap(page,"Tab");await until(()=>own(s).a===0,"Tab cycles occupied slots");
  await tap(page,"Digit2");await until(()=>own(s).a===1,"slot 2 selection");
  await tap(page,"Digit1");await until(()=>own(s).a===0,"slot 1 selection");
  await page.keyboard.down("KeyB");await page.locator('[data-el="board"]').waitFor({state:"visible"});
  await page.keyboard.up("KeyB");await page.locator('[data-el="board"]').waitFor({state:"hidden"});
  await tap(page,"KeyR");await until(()=>own(s).slots[0]!.reloadEnd===0&&own(s).slots[0]!.mag===12,"manual refill");
  const shotsBefore=s.events.filter(e=>e.t==="shot"&&e.by===s.you).length;
  await page.keyboard.down("Numpad6");
  await until(()=>s.events.filter(e=>e.t==="shot"&&e.by===s.you).length-shotsBefore>12,"held semi-auto resumes after empty-mag reload",14000);
  await page.keyboard.up("Numpad6");
  const heldShots=s.events.filter(e=>e.t==="shot"&&e.by===s.you).length-shotsBefore;
  assert.ok(s.events.some(e=>e.t==="reload"&&e.id===s.you));
  evidence.push({check:"three slots and held trigger",heldShots,manualReload:true,automaticReload:true,tabCycles:true});
  await page.keyboard.press("Escape");const slotBefore=own(s).a;
  await page.keyboard.press("Tab");await delay(120);
  assert.equal(own(s).a,slotBefore,"menu Tab does not switch weapons");
  assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),"BODY","menu Tab moves focus");
  await page.keyboard.press("Escape");

  // Self-damage gives a controlled real combat event without admin state injection.
  const hpBefore=own(s).hp;
  await grenade(page,s,"frag");await until(()=>own(s).hp<hpBefore,"fragmentation self-damage",5000);
  const damaged=own(s).hp;await page.screenshot({path:out+"/damage-feedback.png"});
  await delay(4800);assert.equal(own(s).hp,damaged,"health waits during combat cooldown");
  await until(()=>own(s).hp>damaged,"out-of-combat incremental recovery",4500);
  assert.ok(own(s).hp<=damaged+4,"health regenerates gradually, not an instant refill");
  evidence.push({check:"health recovery",before:hpBefore,damaged,firstRecovered:own(s).hp,waitedBeforeRecovery:true});

  await grenade(page,s,"flash");await until(()=>own(s).flash>0,"flashbang exposure",5000);
  assert.ok(own(s).flashStrength>0);
  await page.screenshot({path:out+"/flashbang.png"});
  await until(()=>own(s).flash===0,"flash effect expires",5000);
  evidence.push({check:"flashbang",authoritativeExposure:true,expires:true});
  const gasHp=own(s).hp;
  await grenade(page,s,"gas");await until(()=>!!s.snap?.areas.length&&own(s).hp<gasHp,"poison area damages exposed pilot",5000);
  await page.screenshot({path:out+"/poison-smoke.png"});
  await page.keyboard.down("KeyD");await delay(1000);await page.keyboard.up("KeyD");
  evidence.push({check:"poison smoke",visibleArea:s.snap!.areas.length,healthBefore:gasHp,healthAfter:own(s).hp});
  await page.screenshot({path:out+"/desktop-game.png"});
  await finish(page,s);

  // Readiness and team selection through two independent browser identities.
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const phone=await mobile.newPage(),p=observe(phone);
  await phone.goto(base);await phone.locator("#practice").waitFor();await checkFit(phone,"phone home");
  await phone.screenshot({path:out+"/phone-home.png",fullPage:true});
  if(await phone.locator("#profile-button").count()){
    await phone.locator("#profile-button").click();await phone.locator("#profile-form").waitFor();
    await checkFit(phone,"phone profile");await phone.screenshot({path:out+"/phone-profile.png",fullPage:true});
    await phone.keyboard.press("Escape");
  }
  const code=await roomCode(page,{mode:"tdm",map:"skyshaft",bots:0,durationMin:2,loadout:["mini-eagle","uzi","spas12"]});
  await enter(page,code);await enter(phone,code);
  await delay(300);
  assert.equal(await page.locator("#start").isDisabled(),true,"host cannot start before guest is ready");
  await page.screenshot({path:out+"/desktop-lobby-waiting.png",fullPage:true});
  await phone.screenshot({path:out+"/phone-lobby-waiting.png",fullPage:true});
  await checkFit(page,"desktop lobby");await checkFit(phone,"phone lobby");
  await phone.locator("#ready").click();
  await page.locator("#start:not(:disabled)").waitFor();
  await page.screenshot({path:out+"/desktop-lobby-ready.png",fullPage:true});
  await page.locator("#start").click();await page.locator("canvas").waitFor();await phone.locator("canvas").waitFor();
  await delay(800);assert.equal(await phone.locator(".weapon-card[data-slot]").count(),3);
  await phone.getByRole("button",{name:"Slot 3",exact:true}).click();await until(()=>own(p).a===2,"touch slot 3");
  await phone.screenshot({path:out+"/phone-game.png"});
  await page.bringToFront();await finish(page,s);
  await phone.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await phone.getByRole("button",{name:"Leave room",exact:true}).click();
  evidence.push({check:"responsive lobby",startGatedByReadiness:true,twoIndependentIdentities:true,touchSlot3:true,saved:s.saved&&p.saved});
  await mobile.close();

  for(const map of ["outpost-yard","skyshaft","cryptworks","crosscurrent"]){
    await begin(page,s,map);await page.waitForTimeout(500);await page.screenshot({path:out+"/"+map+"-ground.png"});
    await page.keyboard.down("ArrowUp");await page.keyboard.down("Space");await page.keyboard.down("KeyD");
    await delay(1800);await page.keyboard.up("Space");await page.keyboard.up("KeyD");await page.keyboard.up("ArrowUp");
    await page.screenshot({path:out+"/"+map+"-flight.png"});
    evidence.push({check:"map rendered",map,position:{x:own(s).x,y:own(s).y}});
    await finish(page,s);
  }
  await desktop.close();
} catch(e){failures.push((e as Error).stack??String(e));}
finally{await browser.close();}
const report={base,at:new Date().toISOString(),evidence,failures};
writeFileSync(out+"/report.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
if(failures.length)process.exitCode=1;
