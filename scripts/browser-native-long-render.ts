// Long native-GPU acceptance. Uses an isolated browser/CDP and local server.
// APP_URL=http://localhost:8106 PERF_CDP=http://127.0.0.1:9336 node scripts/browser-native-long-render.ts
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import os from "node:os";
import type {Browser,Page} from "playwright";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??"playwright");
const base=process.env.APP_URL??"http://127.0.0.1:8106";
const endpoint=process.env.PERF_CDP;if(!endpoint)throw Error("PERF_CDP must identify an isolated native GPU browser");
const duration=Number(process.env.PERF_SAMPLE_MS??600000),chunkMs=10000;
const label=process.env.PERF_LABEL??"oct14-native-ten-minute";
const out="test-results/"+label;mkdirSync(out,{recursive:true});
interface Probe{frames:number;frameIntervals:number[];drawCpuMs:number[];submitCpuMs:number[];config:Record<string,unknown>}
interface Player{id:number;x:number;y:number;f:number;s:(string|null)[];a:number}
const samples:Record<string,any>[]=[],errors:string[]=[];
const state={you:0,roster:0,snapshots:0,minActors:Infinity,maxActors:0,minAlive:Infinity,maxAlive:0,peakProjectiles:0,peakAreas:0,players:[]as Player[],tick:0,settings:{}as Record<string,unknown>,result:false};
const browser:Browser=await chromium.connectOverCDP(endpoint);
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage();
page.on("pageerror",e=>errors.push(e.message));
page.on("websocket",ws=>ws.on("framereceived",frame=>{
 try{const m=JSON.parse(String(frame.payload));if(m.t==="match"){state.you=m.you;state.roster=m.roster.length;state.settings=m.settings;}
 if(m.t==="snap"){state.snapshots++;state.tick=m.tick;state.players=m.players;state.minActors=Math.min(state.minActors,m.players.length);state.maxActors=Math.max(state.maxActors,m.players.length);const alive=m.players.filter((p:Player)=>!!(p.f&1)).length;state.minAlive=Math.min(state.minAlive,alive);state.maxAlive=Math.max(state.maxAlive,alive);state.peakProjectiles=Math.max(state.peakProjectiles,m.projectiles.length);state.peakAreas=Math.max(state.peakAreas,m.areas?.length??0);}
 if(m.t==="results")state.result=true;
 }catch{}
}));
const stats=(xs:number[])=>{const v=[...xs].sort((a,b)=>a-b);return{count:v.length,mean:v.reduce((a,b)=>a+b,0)/Math.max(1,v.length),p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
let driver:ReturnType<typeof setInterval>|undefined,driving=false;
const held=new Set<string>();
async function drive():Promise<void>{
 if(driving||state.result)return;driving=true;
 try{
  const me=state.players.find(p=>p.id===state.you);if(!me)return;
  const right=me.x<800?true:me.x>2450?false:Math.floor(state.tick/900)%2===0;
  const wanted=new Set([right?"KeyD":"KeyA"]);
  if(me.y>800)wanted.add("Space");
  for(const key of held)if(!wanted.has(key)){await page.keyboard.up(key);held.delete(key);}
  for(const key of wanted)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}
  await page.mouse.move(right?1760:160,420);
  await page.keyboard.press("KeyJ");
 }catch(e){errors.push("driver: "+String(e));}
 finally{driving=false;}
}
async function measure(page:Page,ms:number){
 return page.evaluate(async ms=>{
  const probe=(window as Window&{__jetRenderProbe?:Probe}).__jetRenderProbe;if(!probe)throw Error("missing actual renderer probe");
  probe.frameIntervals.length=0;probe.drawCpuMs.length=0;probe.submitCpuMs.length=0;
  const frames=probe.frames,start=performance.now(),visibility=document.visibilityState;
  let raf=0,handle=0;const tick=()=>{raf++;handle=requestAnimationFrame(tick);};handle=requestAnimationFrame(tick);
  await new Promise(r=>setTimeout(r,ms));cancelAnimationFrame(handle);
  const elapsed=performance.now()-start;
  const summary=(xs:number[])=>{const a=[...xs].sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((x,y)=>x+y,0)/Math.max(1,a.length),p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
  return{durationMs:elapsed,renderedFrames:probe.frames-frames,renderedFps:(probe.frames-frames)*1000/elapsed,rafFrames:raf,rafFps:raf*1000/elapsed,
   initialVisibility:visibility,finalVisibility:document.visibilityState,frameIntervalMs:summary(probe.frameIntervals),sceneCpuMs:summary(probe.drawCpuMs),submitCpuMs:summary(probe.submitCpuMs),config:probe.config};
 },ms);
}
let matchCode="",startedAt="";
const hardware={browser:browser.version(),headless:true,platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1024**3)};
const save=(complete=false)=>{
 const elapsed=samples.reduce((n,s)=>n+s.durationMs,0),frames=samples.reduce((n,s)=>n+s.renderedFrames,0);
 const report={startedAt,completedAt:complete?new Date().toISOString():null,complete,hardware,viewport:{width:1920,height:1080,dpr:1},base,matchCode,map:"ice-box",scope:"Far (level2) for all23weapons",requestedDurationMs:duration,
  actualMeasuredMs:elapsed,renderedFrames:frames,renderedFps:frames*1000/Math.max(1,elapsed),tenSecondFps:stats(samples.map(s=>s.renderedFps)),samplesBelow58:samples.filter(s=>s.renderedFps<58).length,samples,
  scene:{...state,players:undefined},errors,interpretation:"Foreground native headless Windows hardware rendering, 1 browser-controlled human plus7 server bots on the new IceBox arena (245 collision rectangles), normal automatic hardware quality, Saved Far scope; normal death-camera transitions can use narrower framing. Actors die and respawn normally; see min/max alive. Counts are actual Pixi postrender submissions, not GPU fences or physical display latency. Local server and desktop GPU only; no physical phone or deployed network claim."};
 writeFileSync(out+"/report.json",JSON.stringify(report,null,2)+"\n");return report;
};
try{
 await page.goto(base+"?renderProbe=1");await page.locator("#practice").waitFor();
 matchCode=await page.evaluate(async()=>{
  const ids=["mini-eagle","golden-eagle","magnum","uzi","tec9","mp5","ak47","m4","tavor-x95","xm8","m14","m93ba","spas12","aa20","minigun","smaw","rg6","saw-launcher","flamethrower","phasr","emp-gun","machete","riot-shield"];
  const pref=await fetch("/api/me",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefs:{muted:true,scopes:Object.fromEntries(ids.map(id=>[id,2]))}})});if(!pref.ok)throw Error("preference setup failed");
  const response=await fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Native GPU ten-minute acceptance",isPublic:false,settings:{map:"ice-box",mode:"ffa",capacity:8,bots:7,botDifficulty:"hard",durationMin:15,scoreLimit:0,health:2,damage:.5,respawnSec:1,loadout:["m93ba","minigun","rg6"],flight:true,unlimitedAmmo:true,mapPickups:true}})});
  const body=await response.json();if(!response.ok)throw Error(body.error);return body.code;
 });
 await page.goto(base+"/r/"+matchCode+"?renderProbe=1");
 await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").click();
 await page.locator("canvas").waitFor();await page.waitForFunction(()=>!!(window as Window&{__jetRenderProbe?:Probe}).__jetRenderProbe);
 await page.bringToFront();await page.waitForTimeout(1500);
 assert.equal(state.roster,8);assert.equal(state.settings.map,"ice-box");
 const config=await page.evaluate(()=>(window as unknown as Window&{__jetRenderProbe:Probe}).__jetRenderProbe.config);
 assert.equal(config.softwareFallback,false,"native hardware rendering is required");
 assert.ok(/Intel|NVIDIA|AMD|Radeon/i.test(JSON.stringify(config.graphics)),"browser must report a named GPU");
 assert.ok(!/swiftshader|llvmpipe|softpipe/i.test(JSON.stringify(config.graphics)));
 assert.equal(config.canvasWidth,1920);assert.equal(config.canvasHeight,1080);
 await page.screenshot({path:out+"/start.png"});console.log(JSON.stringify({phase:"started",hardware,config,settings:state.settings,roster:state.roster}));
 startedAt=new Date().toISOString();driver=setInterval(()=>{void drive();},500);await drive();
 for(let elapsed=0;elapsed<duration;elapsed+=chunkMs){
  assert.equal(state.result,false,"match ended during rendering sample");
  const result=await measure(page,Math.min(chunkMs,duration-elapsed));samples.push({chunk:samples.length+1,...result});
  save();console.log(JSON.stringify({chunk:samples.length,seconds:Math.round(samples.reduce((n,s)=>n+s.durationMs,0)/1000),fps:result.renderedFps,actors:state.minActors+"–"+state.maxActors,alive:state.minAlive+"–"+state.maxAlive,projectiles:state.peakProjectiles}));
 }
 if(driver)clearInterval(driver);while(driving)await new Promise(r=>setTimeout(r,20));
 for(const key of held)await page.keyboard.up(key);held.clear();
 await page.screenshot({path:out+"/end.png"});
 const report=save(true);
 assert.ok(report.actualMeasuredMs>=duration);assert.ok(report.renderedFps>=58,"mean rendered FPS below target58");
 assert.ok(samples.every(s=>s.initialVisibility==="visible"&&s.finalVisibility==="visible"));
 assert.equal(state.minActors,8);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({phase:"complete",renderedFps:report.renderedFps,durationMs:report.actualMeasuredMs,samplesBelow58:report.samplesBelow58,output:out+"/report.json"}));
} catch(e){errors.push((e as Error).stack??String(e));save();console.error(e);process.exitCode=1;}
finally{
 if(driver)clearInterval(driver);
 try{for(const key of held)await page.keyboard.up(key);if(await page.locator("canvas").count()){await page.keyboard.press("Escape");await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor();}}catch{}
 await context.close();await browser.close();
}
