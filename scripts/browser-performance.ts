// Controlled foreground rendering comparison; these are not physical-device FPS.
// APP_URL=http://localhost:8096 node scripts/browser-performance.ts
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import os from "node:os";
import type { Page } from "playwright";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??"playwright");
const base=process.env.APP_URL??"http://localhost:8096";
const duration=Number(process.env.PERF_SAMPLE_MS??4000);
const cacheOption=process.env.PERF_RENDER_CACHE!==undefined?"&renderCache="+process.env.PERF_RENDER_CACHE:"";
mkdirSync("test-results",{recursive:true});
const errors:string[]=[];
interface Probe {frames:number;lastFrameAt:number;frameIntervals:number[];drawCpuMs:number[];submitCpuMs:number[];config:Record<string,unknown>}
async function measure(page:Page,foreground=true):Promise<Record<string,unknown>> {
  if(foreground)await page.bringToFront();
  await page.waitForTimeout(1000);
  return page.evaluate(async ms=>{
    const w=window as Window & {__jetRenderProbe?:Probe};
    const probe=w.__jetRenderProbe;
    const initialFrames=probe?.frames??0;
    if(probe){probe.frameIntervals.length=0;probe.drawCpuMs.length=0;probe.submitCpuMs.length=0;}
    const start=performance.now();let previous=0;const raf:number[]=[];let handle=0;
    const tick=(t:number)=>{if(previous)raf.push(t-previous);previous=t;handle=requestAnimationFrame(tick);};
    handle=requestAnimationFrame(tick);
    const initialVisibility=document.visibilityState;
    await new Promise(r=>setTimeout(r,ms));
    cancelAnimationFrame(handle);
    const elapsed=performance.now()-start;
    const stats=(values:number[])=>{
      const sorted=[...values].sort((a,b)=>a-b);
      return sorted.length?{count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}:null;
    };
    return {durationMs:elapsed,initialVisibility,finalVisibility:document.visibilityState,rafFrames:raf.length,rafFps:raf.length*1000/elapsed,
      renderedFrames:probe?probe.frames-initialFrames:null,renderedFps:probe?(probe.frames-initialFrames)*1000/elapsed:null,
      intervals:stats(probe?.frameIntervals??[]),sceneDrawCpuMs:stats(probe?.drawCpuMs??[]),renderSubmissionCpuMs:stats(probe?.submitCpuMs??[]),
      config:probe?.config??null,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
  },duration);
}
function track(page:Page,label:string):void {page.on("pageerror",e=>errors.push(label+": "+e.message));}
async function finish(page:Page):Promise<void> {
  await page.bringToFront();
  if(await page.locator(".touch").count())await page.getByRole("button",{name:"Menu",exact:true}).click();
  else await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"End round now",exact:true}).click();
  await page.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Leave room",exact:true}).click();
}
const browser=process.env.PERF_CDP?await chromium.connectOverCDP(process.env.PERF_CDP):await chromium.launch();
const results:Record<string,unknown>[]=[];
const cases=[
  {name:"desktop-auto",phone:false,aa:null,res:null},
  {name:"phone-auto",phone:true,aa:null,res:null},
  {name:"desktop-aa-on-resolution1",phone:false,aa:1,res:1},
  {name:"desktop-aa-off-resolution1",phone:false,aa:0,res:1},
  {name:"desktop-aa-off-resolution075",phone:false,aa:0,res:.75},
  {name:"desktop-aa-off-resolution067",phone:false,aa:0,res:2/3},
  {name:"phone-aa-on-resolution2",phone:true,aa:1,res:2},
  {name:"phone-aa-off-resolution2",phone:true,aa:0,res:2},
  {name:"phone-aa-off-resolution1",phone:true,aa:0,res:1},
];
try{
  for(const c of cases.filter(c=>!process.env.PERF_CASES||process.env.PERF_CASES.split(",").includes(c.name))) {
    const context=await browser.newContext(c.phone?{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}:{viewport:{width:1920,height:1080},deviceScaleFactor:1});
    const page=await context.newPage();track(page,c.name);
    await page.goto(base+"?renderProbe=1"+cacheOption+(c.aa===null?"":"&renderAA="+c.aa+"&renderResolution="+c.res));
    await page.locator("#practice").waitFor();
    if(c.name==="desktop-aa-on-resolution1"||c.name==="phone-aa-on-resolution2") {
      const home={name:c.phone?"phone-home":"desktop-home",...(await measure(page))};results.push(home);console.log(JSON.stringify(home));
    }
    await page.locator("#practice").click();
    await page.locator("canvas").waitFor();
    await page.waitForFunction(()=>!!(window as Window & {__jetRenderProbe?:Probe}).__jetRenderProbe);
    const result={name:c.name,...(await measure(page))};results.push(result);console.log(JSON.stringify(result));
    if(c.aa===0||c.aa===null)await page.screenshot({path:"test-results/performance-"+c.name+(process.env.PERF_LABEL?"-"+process.env.PERF_LABEL:"")+".png"});
    await finish(page);await context.close();
  }
  for(const aa of process.env.PERF_SKIP_DUAL?[]:process.env.PERF_DUAL_MODES==="auto"?[null]:[1,0]) {
    const a=await browser.newContext({viewport:{width:1920,height:1080}});
    const b=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    const host=await a.newPage(),spectator=await b.newPage();track(host,"dual-desktop");track(spectator,"dual-phone");
    await host.goto(base+"?renderProbe=1"+cacheOption+(aa===null?"":"&renderAA="+aa+"&renderResolution=1"));
    await host.locator("#practice").click();await host.locator("canvas").waitFor();
    const path=new URL(host.url()).pathname;
    await spectator.goto(base+path+"?renderProbe=1"+cacheOption+(aa===null?"":"&renderAA="+aa+"&renderResolution="+(aa?2:1)));
    await spectator.locator('dialog input[name="spectate"]').check();
    await spectator.getByRole("button",{name:"Join room",exact:true}).click();
    await spectator.locator("canvas").waitFor();
    await host.bringToFront();
    const pair=await Promise.all([measure(host,false),measure(spectator,false)]);
    const result={name:aa===null?"two-active-contexts-auto":aa?"two-active-contexts-original":"two-active-contexts-aaoff-resolution1",desktop:pair[0],phone:pair[1]};results.push(result);console.log(JSON.stringify(result));
    await finish(host);await a.close();await b.close();
  }
  assert.deepEqual(errors,[]);
  const report={at:new Date().toISOString(),durationRequestedMs:duration,environment:{browser:browser.version(),headless:true,platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1024**3)},results,errors,
    interpretation:"renderedFrames counts completed Pixi postrender submissions, alongside rAF cadence and document visibility. CPU spans measure scene construction/submission, not GPU completion. Check each config.graphics renderer: SwiftShader means software rendering, a named device indicates the browser hardware path. These headless samples do not certify physical display latency, phone hardware or live-service performance."};
  writeFileSync("test-results/browser-performance"+(process.env.PERF_LABEL?"-"+process.env.PERF_LABEL:"")+".json",JSON.stringify(report,null,2)+"\n");
  console.log("Performance comparison saved to test-results/browser-performance"+(process.env.PERF_LABEL?"-"+process.env.PERF_LABEL:"")+".json");
} catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
