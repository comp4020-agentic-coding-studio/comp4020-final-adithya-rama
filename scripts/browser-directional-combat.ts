// Real browser controls plus a separate authenticated WebSocket guest.
// No page-side state injection, server fixture endpoints or fabricated hits.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { TestPlayer, sleep } from "../spec/lib/client.ts";
import { Btn, PF, type GameEvent, type PlayerSnap, type WorldSnapshot } from "../src/shared/types.ts";

const port=Number(process.env.DIRECTIONAL_PORT??8132);
const base=process.env.APP_URL??`http://127.0.0.1:${port}`;
const tag=process.env.REPORT_TAG??"directional-combat-local";
assert.match(tag,/^[a-z0-9-]+$/);
const out=`test-results/${tag}`;
mkdirSync(out,{recursive:true});mkdirSync(".data",{recursive:true});
const server=process.env.APP_URL?null:spawn(process.execPath,["--max-old-space-size=160","src/server/main.ts"],{
  env:{...process.env,PORT:String(port),DB_PATH:`.data/directional-${Date.now()}.sqlite`},stdio:["ignore","pipe","pipe"],
});
let serverLog="";
server?.stdout.on("data",b=>serverLog=(serverLog+String(b)).slice(-20000));
server?.stderr.on("data",b=>serverLog=(serverLog+String(b)).slice(-20000));
const checks:Record<string,unknown>[]=[],errors:string[]=[];
let failure:string|null=null;
async function until(test:()=>boolean,label:string,ms=15000){
  const end=Date.now()+ms;
  while(!test()){if(Date.now()>end)throw Error(label);await sleep(25);}
}
let healthy=false;
for(let i=0;i<100;i++){
  try{const res=await fetch(base+"/healthz");if(res.ok){const state=await res.json();assert.equal(state.active,0,"An existing active round must not be interrupted");healthy=true;break;}}catch(e){if(String(e).includes("active round"))throw e;}
  await sleep(100);
}
if(!healthy){server?.kill();throw Error("Production server did not become healthy: "+serverLog);}
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1920,height:1080}});
const page=await context.newPage(),guest=new TestPlayer(base);
let snap:WorldSnapshot|null=null,remote:WorldSnapshot|null=null,you=-1,guestId=-1,seq=0,bits=0,aim=0;
let inputTimer:ReturnType<typeof setInterval>|undefined;
const events:GameEvent[]=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("websocket",ws=>ws.on("framereceived",({payload})=>{
  const m=JSON.parse(String(payload));if(m.t==="match")you=m.you;
  if(m.t==="snap"){snap=m;events.push(...m.events);}
}));
const actor=(id:number):PlayerSnap=>{const p=snap?.players.find(p=>p.id===id);assert.ok(p,`actor ${id} is visible`);return p;};
async function tap(key:string){await page.keyboard.down(key);await sleep(100);await page.keyboard.up(key);}
function setGuest(b:number,newAim=aim){bits=b;aim=newAim;}
async function settleAt(x:number){
  const end=Date.now()+20000;
  while(Date.now()<end){
    const p=actor(guestId),delta=x-p.x;
    // Braking distance avoids high-frequency left/right oscillation near target.
    setGuest(Math.abs(delta)>Math.max(2,Math.abs(p.vx)*.14)?(delta>0?Btn.RIGHT:Btn.LEFT):0);
    if(Math.abs(delta)<8&&Math.abs(p.vx)<8){setGuest(0);return;}
    await sleep(34);
  }
  throw Error(`Guest did not settle near ${x}: ${JSON.stringify(actor(guestId))}`);
}
async function agree(hp:number){
  await until(()=>actor(you).hp===hp&&remote?.players.find(p=>p.id===you)?.hp===hp,"independent clients agree on target health");
}
async function guestShot(targetY:number){
  const target=actor(you),source=actor(guestId);
  const shotAim=Math.atan2(targetY-(source.y-44*.68),target.x-source.x);
  const before=events.filter(e=>e.t==="shot"&&e.by===guestId&&e.w==="m93ba").length;
  setGuest(Btn.FIRE,shotAim);await sleep(80);setGuest(0,shotAim);
  await until(()=>events.filter(e=>e.t==="shot"&&e.by===guestId&&e.w==="m93ba").length>before,"guest sniper shot is authoritative");
}
async function liftAbove(){
  await settleAt(actor(you).x);
  setGuest(Btn.JET);
  await until(()=>actor(guestId).y<actor(you).y-160,"guest flies above target");
  setGuest(0);
}
try{
  await page.goto(base);await page.locator("#practice").waitFor();
  const res=await page.request.post(base+"/api/rooms",{data:{name:"Directional shield acceptance",isPublic:false,settings:{
    mode:"ffa",map:"test-range",bots:0,durationMin:5,randomSpawns:false,mapPickups:false,unlimitedFuel:true,
    loadout:["riot-shield","machete","m93ba"],
  }}});
  assert.equal(res.status(),201);const{code}=await res.json();
  await page.goto(base+"/r/"+code+"?renderProbe=1");
  await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").waitFor();
  await guest.visit();const renamed=await guest.http("/api/me",{method:"PATCH",body:{name:"Shield Probe"}});assert.equal(renamed.status,200);
  await guest.connect();
  guest.ws!.on("message",data=>{const m=JSON.parse(String(data));if(m.t==="snap")remote=m;});
  await guest.waitFor("welcome");guest.send({t:"join",code});await guest.waitFor("room",m=>m.room.code===code);
  guest.send({t:"ready",ready:true});await guest.waitFor("room",m=>m.room.members.some(p=>p.key===m.room.you&&p.ready));
  await page.locator("#start:not(:disabled)").click();guestId=(await guest.waitFor("match")).you!;
  await until(()=>!!snap?.players.find(p=>p.id===you)&&!!snap.players.find(p=>p.id===guestId),"both players appear");
  await page.locator("canvas").waitFor();
  inputTimer=setInterval(()=>guest.send({t:"input",frames:[{seq:++seq,b:bits,aim},{seq:++seq,b:bits,aim}]}),34);
  setGuest(Btn.SLOT3);await until(()=>actor(guestId).a===2,"guest selects sniper");setGuest(0);
  assert.ok(!actor(guestId).s.includes("riot-shield"),"selecting sniper drops the guest's shield");
  const x=actor(you).x,direction=x>900?-1:1;
  await settleAt(x+direction*220);
  await until(()=>!(actor(you).f&PF.PROTECTED)&&!(actor(guestId).f&PF.PROTECTED),"spawn protection expires");
  await tap(direction===1?"ArrowRight":"ArrowLeft");await until(()=>Math.abs(Math.cos(actor(you).aim)-direction)<.01,"shield faces attacker");
  const shieldBefore=events.filter(e=>e.t==="shield"&&e.id===you).length;
  await guestShot(actor(you).y-22);await agree(100);
  await until(()=>events.filter(e=>e.t==="shield"&&e.id===you).length>shieldBefore,"frontal shield contact event");
  await page.screenshot({path:out+"/shield-front.png"});
  checks.push({case:"frontal sniper blocked",hp:100,agreed:true});

  await sleep(1300);await tap(direction===1?"ArrowLeft":"ArrowRight");
  await guestShot(actor(you).y-22);await agree(40);
  assert.ok(actor(you).f&PF.ALIVE);
  checks.push({case:"exposed body takes 60",hp:40,agreed:true});

  await page.keyboard.down("ArrowUp");await page.keyboard.down(direction===1?"ArrowRight":"ArrowLeft");
  await until(()=>Math.abs(Math.sin(actor(you).aim)+Math.SQRT1_2)<.02,"diagonal shield angle reaches server");
  await sleep(200);await page.screenshot({path:out+"/shield-diagonal.png"});
  assert.ok(Math.abs(Math.sin(actor(you).aim)+Math.SQRT1_2)<.02,"diagonal aim remains held through capture");
  checks.push({case:"diagonal shield rendered",aim:actor(you).aim});
  await page.keyboard.up("ArrowUp");await page.keyboard.up(direction===1?"ArrowRight":"ArrowLeft");

  await liftAbove();await tap("ArrowUp");
  await until(()=>Math.abs(actor(you).aim+Math.PI/2)<.02,"upward shield angle reaches server");
  const overheadBefore=events.filter(e=>e.t==="shield"&&e.id===you).length;
  const hpBeforeOverhead=actor(you).hp;
  await guestShot(actor(you).y-38);
  await until(()=>events.filter(e=>e.t==="shield"&&e.id===you).length>overheadBefore,"overhead shield intercepts sniper");
  await agree(hpBeforeOverhead);
  await page.screenshot({path:out+"/shield-overhead.png"});
  checks.push({case:"overhead headshot blocked",hp:hpBeforeOverhead,agreed:true,attacker:actor(guestId),target:actor(you)});

  // Natural recovery gives a fresh full-health headshot trial with no state mutation.
  await until(()=>actor(you).hp===100,"target naturally regenerates to full health",40000);
  await until(()=>Math.abs(actor(guestId).vy)<1&&actor(guestId).y>=899,"guest lands after overhead test");
  await liftAbove();await tap(direction===1?"ArrowRight":"ArrowLeft");
  await guestShot(actor(you).y-38);
  await until(()=>events.some(e=>e.t==="kill"&&e.victim===you&&e.killer===guestId),"uncovered headshot kills full-health target");
  await agree(0);
  checks.push({case:"uncovered headshot kills at full health",hpBefore:100,hpAfter:0,agreed:true});
  const probe=await page.evaluate(()=>({frames:(window as any).__jetRenderProbe?.frames,camera:(window as any).__jetRenderProbe?.config.camera}));
  assert.ok(probe.frames>30);assert.deepEqual(errors,[]);
  checks.push({case:"actual browser rendering",...probe});
}catch(e){failure=e instanceof Error?e.stack??e.message:String(e);await page.screenshot({path:out+"/failure.png"}).catch(()=>{});}
finally{
  if(inputTimer)clearInterval(inputTimer);
  try{
    await page.keyboard.press("Escape");await page.getByRole("button",{name:"End round now",exact:true}).click({timeout:3000});
    await page.getByText("Results saved to your match history.",{exact:true}).waitFor({timeout:5000});
    await page.getByRole("button",{name:"Leave room",exact:true}).click();
  }catch{}
  guest.quit();await context.close();await browser.close();server?.kill();
}
writeFileSync(out+"/report.json",JSON.stringify({base,at:new Date().toISOString(),checks,errors,failure},null,2));
console.log(JSON.stringify({base,checks,errors,failure}));
if(failure)process.exitCode=1;