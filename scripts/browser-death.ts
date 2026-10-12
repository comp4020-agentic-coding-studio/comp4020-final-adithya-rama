// Real network acceptance: two browser identities, actual key input, no state injection.
// Start a dedicated current-build server with a disposable DB, then set APP_URL.
import assert from "node:assert/strict";
import { mkdirSync,writeFileSync } from "node:fs";
import { chromium,type Page } from "playwright";
import { PF,type GameEvent,type PlayerSnap,type WorldSnapshot } from "../src/shared/types.ts";
const base=process.env.APP_URL??"http://localhost:8093";
const out="test-results/oct13-death";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const errors:string[]=[],checks:Record<string,unknown>[]=[];
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,label:string,timeout=15000):Promise<void>{
  const deadline=Date.now()+timeout;
  while(!fn()){if(Date.now()>deadline)throw new Error("Timed out: "+label);await delay(20);}
}
function observe(page:Page){
  const state={you:null as number|null,snap:null as WorldSnapshot|null,events:[] as GameEvent[]};
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
    const m=JSON.parse(String(payload));
    if(m.t==="match"){state.you=m.you;state.snap=null;state.events=[];}
    if(m.t==="snap"){state.snap=m;state.events.push(...m.events);}
  }));
  return state;
}
type Observed=ReturnType<typeof observe>;
const own=(s:Observed):PlayerSnap=>{const p=s.snap?.players.find(p=>p.id===s.you);assert.ok(p);return p;};
async function tap(page:Page,code:string){await page.keyboard.down(code);await delay(80);await page.keyboard.up(code);await delay(60);}
async function walk(page:Page,state:Observed,x:number){
  await page.bringToFront();
  const direction=own(state).x<x?"KeyD":"KeyA";
  await page.keyboard.down(direction);
  try {await until(()=>direction==="KeyD"?own(state).x>=x:own(state).x<=x,"walk to "+x,15000);}
  finally {await page.keyboard.up(direction);}
  await delay(200);
}
async function join(page:Page,code:string){
  await page.goto(base+"/r/"+code+"?renderProbe=1");
  await page.getByRole("button",{name:"Join room",exact:true}).click();
  await page.locator("#ready").waitFor();
}
async function probe(page:Page):Promise<Record<string,unknown>> {
  return page.evaluate(()=>((window as Window&{__jetRenderProbe?:{config:Record<string,unknown>}}).__jetRenderProbe?.config??{}));
}
async function reduced(page:Page,on:boolean){
  await page.keyboard.press("Escape");
  await page.locator("[data-shake]").setChecked(on);
  await page.locator('[data-act="resume"]').click();
  await delay(200);
}
const hostContext=await browser.newContext({viewport:{width:1920,height:1080}});
const victimContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const host=await hostContext.newPage(),victim=await victimContext.newPage();
const h=observe(host),v=observe(victim);
try {
  await host.goto(base);await host.locator("#quick").waitFor();
  await victim.goto(base);await victim.locator("#quick").waitFor();
  await host.request.patch(base+"/api/me",{data:{name:"Rocket pilot"}});
  await victim.request.patch(base+"/api/me",{data:{name:"Camera pilot"}});
  const response=await host.request.post(base+"/api/rooms",{data:{name:"Death camera acceptance",isPublic:false,settings:{mode:"ffa",map:"test-range",capacity:2,bots:0,health:.5,damage:2,respawnSec:5,mapPickups:false,loadout:["smaw","mini-eagle","machete"],unlimitedAmmo:true,durationMin:5}}});
  assert.equal(response.status(),201,await response.text());
  const code=(await response.json()).code;
  await join(host,code);await join(victim,code);
  await victim.locator("#ready").click();await host.locator("#start").click();
  await until(()=>h.snap!==null&&v.snap!==null,"both snapshots");
  await walk(host,h,800);await walk(victim,v,1120);
  await delay(2100);
  const before=v.events.length;
  await tap(host,"Digit1");await host.keyboard.down("Numpad6");
  try {await until(()=>v.events.slice(before).some(e=>e.t==="kill"&&e.victim===v.you&&e.w==="smaw"),"rocket kill");}
  finally {await host.keyboard.up("Numpad6");}
  const kill=v.events.slice(before).find(e=>e.t==="kill"&&e.victim===v.you)!;
  assert.equal(kill.t,"kill");if(kill.t!=="kill")throw Error("unreachable");
  assert.equal(kill.attacker,h.you);assert.equal(kill.killer,h.you);
  await victim.locator('[data-el="center"][data-camera-target="'+h.you+'"]').waitFor();
  await until(()=>!(own(v).f&PF.ALIVE),"victim dead");
  await victim.screenshot({path:out+"/rocket-death-phone.png"});
  let observed=await probe(victim);
  assert.ok(Number(observed.peakDeathDebris)>0,"rocket emitted visible body debris");
  assert.ok(Number(observed.peakDeathDebris)<=96,"debris count stays bounded");
  await delay(450);
  const x0=((await probe(victim)).camera as {x:number}).x;
  await host.keyboard.down("KeyD");await delay(900);await host.keyboard.up("KeyD");await delay(250);
  const x1=((await probe(victim)).camera as {x:number}).x;
  assert.ok(x1>x0+45,"camera moves with actual killer");
  await victim.screenshot({path:out+"/killer-follow-phone.png"});
  await until(()=>!!(own(v).f&PF.ALIVE),"local respawn",8000);
  await victim.locator('[data-el="center"][data-camera-target]').waitFor({state:"detached"});
  checks.push({check:"rocket kill and killer camera",attacker:kill.attacker,peakDebris:observed.peakDeathDebris,cameraBefore:x0,cameraAfter:x1,respawnRestoresCamera:true});
  console.log("Rocket kill, follow camera and respawn passed.");

  await tap(victim,"Digit1");await tap(victim,"ArrowDown");
  const selfBefore=v.events.length;
  await tap(victim,"KeyJ");
  await until(()=>v.events.slice(selfBefore).some(e=>e.t==="kill"&&e.victim===v.you),"self rocket kill");
  await victim.locator('[data-el="center"][data-camera-target="death-location"]').waitFor();
  assert.match(await victim.locator('[data-el="center"]').innerText(),/Self-inflicted/);
  await victim.screenshot({path:out+"/self-death-phone.png"});
  checks.push({check:"self kill fallback",holdsDeathLocation:true});
  await until(()=>!!(own(v).f&PF.ALIVE),"self-kill respawn",8000);

  await reduced(victim,true);
  await tap(victim,"ArrowDown");
  const reducedBefore=v.events.length;
  await tap(victim,"KeyJ");
  await until(()=>v.events.slice(reducedBefore).some(e=>e.t==="kill"&&e.victim===v.you),"reduced self kill");
  await delay(180);
  assert.equal(Number((await probe(victim)).deathDebris),0,"reduced effects suppress body debris");
  await victim.screenshot({path:out+"/reduced-death-phone.png"});
  checks.push({check:"reduced effects",debris:0});
  await until(()=>!!(own(v).f&PF.ALIVE),"reduced respawn",8000);
  await reduced(victim,false);

  await walk(host,h,800);await walk(victim,v,1120);await delay(2100);
  await tap(host,"Digit2");
  const ordinaryBefore=v.events.length;
  await host.keyboard.down("Numpad6");
  try {await until(()=>v.events.slice(ordinaryBefore).some(e=>e.t==="kill"&&e.victim===v.you&&e.w==="mini-eagle"),"ordinary gun kill");}
  finally {await host.keyboard.up("Numpad6");}
  await delay(180);
  assert.equal(Number((await probe(victim)).deathDebris),0,"ordinary firearm death does not split body");
  await victim.screenshot({path:out+"/ordinary-death-phone.png"});
  checks.push({check:"ordinary weapon distinction",debris:0});
  await host.keyboard.press("Escape");await host.getByRole("button",{name:"End round now",exact:true}).click();
  await host.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await victim.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await victim.locator("#leave").click();await host.locator("#leave").click();
  assert.deepEqual(errors,[]);
  writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),base,checks,errors,limits:"Real inputs and authoritative network events in a flat test arena; phone viewport emulated. No physical-device, production or balance claim."},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} catch(e) {
  await host.screenshot({path:out+"/failure-host.png"}).catch(()=>{});
  await victim.screenshot({path:out+"/failure-victim.png"}).catch(()=>{});
  writeFileSync(out+"/failure.json",JSON.stringify({error:String(e),checks,errors,host:h.snap,victim:v.snap},null,2));
  throw e;
} finally {await browser.close();}
