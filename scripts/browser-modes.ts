// Two independent browser identities, desktop + touch, exercising each mode.
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { MAPS } from "../src/shared/maps.ts";

const base=process.env.APP_URL??"http://localhost:8081";
const tag=process.env.REPORT_TAG??"browser-modes";
mkdirSync("test-results",{recursive:true});
const failures:string[]=[], evidence:any[]=[];
const browser=await chromium.launch();
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(test:()=>boolean,label:string,ms=15000) {
  const end=Date.now()+ms;
  while(!test()) {if(Date.now()>end)throw Error("Timed out: "+label);await pause(25);}
}
function observe(page:Page) {
  const state={snap:null as any,start:null as any,result:null as any,saved:false};
  page.on("pageerror",e=>failures.push(e.message));
  page.on("console",m=>{if(m.type()==="error")failures.push(m.text());});
  page.on("websocket",ws=>ws.on("framereceived",frame=>{
    try {const m=JSON.parse(String(frame.payload));
      if(m.t==="match"){state.start=m;state.result=null;state.saved=false;}
      if(m.t==="snap")state.snap=m;
      if(m.t==="results"){state.result=m.result;state.saved=m.save==="saved";}
      if(m.t==="save"&&m.save==="saved")state.saved=true;
    }catch{}
  }));
  return state;
}
async function enter(page:Page,code:string,spectator=false) {
  await page.goto(base+"/r/"+code);
  if(spectator)await page.locator('dialog input[name="spectate"]').check();
  await page.getByRole("button",{name:"Join room",exact:true}).click();
  await page.locator("#ready").waitFor();

}
async function walk(page:Page,state:ReturnType<typeof observe>,x:number,ms=20000) {
  const end=Date.now()+ms;let held="";
  await page.bringToFront();
  while(Date.now()<end && !state.result) {
    const me=state.snap?.players.find((p:any)=>p.id===state.start.you);
    if(!me){await pause(40);continue;}
    if(Math.abs(me.x-x)<15)break;
    const key=me.x<x?"KeyD":"KeyA";
    if(held!==key){if(held)await page.keyboard.up(held);await page.keyboard.down(key);held=key;}
    await pause(30);
  }
  if(held)await page.keyboard.up(held);
}
try {
 for(const [mode,map] of [["ffa","skyshaft"],["tdm","outpost-yard"],["flag","cryptworks"],["survival","crosscurrent"],["training","test-range"]].filter(([mode])=>!process.env.MODES||process.env.MODES.split(",").includes(mode))) {
  const dc=await browser.newContext({viewport:{width:1920,height:1080}});
  const pc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const desktop=await dc.newPage(),phone=await pc.newPage();
  const d=observe(desktop),p=observe(phone);
  await desktop.goto(base);await desktop.locator("#practice").waitFor();
  const code=await desktop.evaluate(async ({mode,map})=>{
    const response=await fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      name:"Browser acceptance "+mode,isPublic:false,settings:{mode,map,capacity:2,bots:0,durationMin:2,
      scoreLimit:mode==="flag"?1:0,flight:false,health:2,damage:.5,loadout:["mini-eagle","uzi"]}
    })});const body=await response.json();if(!response.ok)throw Error(body.error);return body.code as string;
  },{mode,map});
  await enter(desktop,code);
  await enter(phone,code,mode==="training");
  if(mode!=="training")await phone.locator("#ready").click();
  await pause(150);
  await desktop.locator("#start").click();
  await until(()=>!!d.start&&!!p.start&&!!d.snap&&!!p.snap,"both clients receive match");
  if(d.start.matchId!==p.start.matchId)throw Error("browser match identities differ");
  await desktop.locator("canvas").waitFor();await phone.locator("canvas").waitFor();
  await pause(1200);
  if(mode==="flag") {
    const myTeam=d.start.roster.find((r:any)=>r.id===d.start.you).team;
    const home=MAPS[map].flagHomes.find(f=>f.team===myTeam)!;
    await walk(desktop,d,home.x);
    await until(()=>d.snap.flags.some((f:any)=>f.carrier===d.start.you),"own flag collected");
    await desktop.screenshot({path:"test-results/"+tag+"-flag-carry.png"});
    await phone.screenshot({path:"test-results/"+tag+"-phone-flag.png"});
    const goal=MAPS[map].goals.find(g=>g.team!==myTeam)!.rect;
    await walk(desktop,d,goal.x+goal.w/2);
    await until(()=>!!d.result&&!!p.result,"flag delivery ends match");
    if(d.result.teamScores[myTeam]!==1)throw Error("delivery did not score exactly once");
  } else {
    await desktop.bringToFront();await desktop.keyboard.press("ArrowRight");
    await desktop.keyboard.press("KeyJ");await desktop.keyboard.press("KeyQ");await desktop.keyboard.press("KeyG");
    await pause(450);
    await desktop.screenshot({path:"test-results/"+tag+"-"+mode+".png"});
    await phone.screenshot({path:"test-results/"+tag+"-phone-"+mode+".png"});
    await desktop.keyboard.press("Escape");
    await desktop.getByRole("button",{name:"End round now",exact:true}).click();
  }
  await until(()=>!!d.result&&!!p.result&&d.saved&&p.saved,"both results saved");
  if(JSON.stringify(d.result)!==JSON.stringify(p.result))throw Error("browsers disagree on result");
  await desktop.getByText("Results saved to your match history.",{exact:true}).waitFor();
  await phone.getByText("Results saved to your match history.",{exact:true}).waitFor();
  evidence.push({mode,map,matchId:d.result.matchId,reason:d.result.reason,teamScores:d.result.teamScores,participants:d.result.participants.length,identicalResults:true,saved:true});
  for(const page of [desktop,phone]){
    await page.getByRole("button",{name:"Leave room",exact:true}).click();
    await page.locator("#practice").waitFor();
  }
  const history=await desktop.evaluate(async()=>await(await fetch("/api/me/matches")).json());
  if(!history.matches.some((m:any)=>m.id===d.result.matchId))throw Error("host history missing result");
  await dc.close();await pc.close();
 }
} catch(e) {failures.push((e as Error).stack??String(e));}
finally {await browser.close();}
const report={base,browser:"Playwright Chromium",cpu:cpus()[0]?.model,platform:platform(),viewports:["1920x1080","390x844"],evidence,failures};
writeFileSync("test-results/"+tag+".json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
if(failures.length)process.exitCode=1;
