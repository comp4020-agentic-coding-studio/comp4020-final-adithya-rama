// Art fixtures from the actual renderer/map data. Not authoritative gameplay evidence.
// Start Vite: mise exec -- pnpm exec vite --host 127.0.0.1 --port 8100
// PREVIEW_URL=http://127.0.0.1:8100 mise exec -- node scripts/browser-map-previews.ts
import {chromium} from "playwright";
import {resolve} from "node:path";
import type {Renderer,RenderPlayer} from "../src/client/render.ts";
import type {MAPS} from "../src/shared/maps.ts";
declare global {interface Window {__art:{renderer:Renderer;maps:typeof MAPS}}}
import {mkdirSync,writeFileSync} from "node:fs";
const base=process.env.PREVIEW_URL??"http://127.0.0.1:8100";
mkdirSync("test-results/map-revision",{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
await page.route("**/__arena-preview__",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html><body style="margin:0"><div id="art" style="width:100vw;height:100vh"></div></body></html>'}));
try {
  await page.goto(base+"/__arena-preview__");
  await page.evaluate(async sharedModule=>{
    const renderModule="/render.ts";
    const [{Renderer},{MAPS}]=await Promise.all([import(renderModule),import(sharedModule)]);
    const renderer=new Renderer();await renderer.init(document.querySelector<HTMLElement>("#art")!);
    window.__art={renderer,maps:MAPS};
  },"/@fs"+resolve("src/shared/maps.ts"));
  for(const id of ["outpost-yard","skyshaft","cryptworks","crosscurrent"]) {
    await page.evaluate(id=>{
      const {renderer,maps}=window.__art,map=maps[id];
      renderer.setMap(map,true);
      const zoom=Math.max(map.width/1050,map.height/590)*1.06;
      for(let i=0;i<50;i++)renderer.frame({x:map.width/2,y:map.height/2},zoom,[],[],[],[],[]);
    },id);
    await page.waitForTimeout(180);
    await page.screenshot({path:"test-results/map-revision/overview-"+id+".png"});
  }
  for(const scene of [{id:"skyshaft",x:480,y:1020,feet:1060,pilotX:450},{id:"outpost-yard",x:1300,y:620,feet:620,pilotX:1270},{id:"cryptworks",x:1270,y:900,feet:950,pilotX:1270}]) {
    await page.evaluate(scene=>{
      const {renderer,maps}=window.__art;renderer.setMap(maps[scene.id],false);
      const pilot:RenderPlayer={id:1,x:scene.pilotX,y:scene.feet,aim:-.12,crouch:false,alive:true,jetting:false,protected:false,team:0,color:0x6e9860,name:"Ranger",hp:100,maxHp:100,weapon:"ak47",local:true,dual:false,otherWeapon:null,emp:0,avatar:{helmet:"pilot",face:"medium",emblem:"bolt"},vx:65,vy:0};
      const second:RenderPlayer={...pilot,id:2,x:scene.pilotX+155,y:scene.feet-65,aim:Math.PI,jetting:true,team:1,weapon:"m4",local:false,name:"Scout",avatar:{helmet:"visor",face:"dark",emblem:"star"},vy:-50};
      for(let i=0;i<50;i++)renderer.frame({x:scene.x,y:scene.y},1,[pilot,second],[],[],[],[]);
      renderer.addTracer(pilot.x,pilot.y-28,second.x,second.y-24,"ak47",true);
      renderer.frame({x:scene.x,y:scene.y},1,[pilot,second],[],[],[],[]);
    },scene);
    await page.waitForTimeout(25);
    await page.screenshot({path:"test-results/map-revision/closeup-"+scene.id+".png"});
  }
  await page.evaluate(()=>{
    const {renderer,maps}=window.__art,map=maps.skyshaft;renderer.setMap(map,false);
    const pilot:RenderPlayer={id:1,x:450,y:1060,aim:0,crouch:false,alive:true,jetting:false,protected:false,team:0,color:0x6e9860,name:"Ranger",hp:100,maxHp:100,weapon:"ak47",local:true,dual:false,otherWeapon:null,emp:0};
    for(let i=0;i<50;i++)renderer.frame({x:480,y:1020},1,[pilot],[],[],[],[]);
    renderer.addFlashbang(635,1030,140);
    renderer.frame({x:480,y:1020},1,[{...pilot,hp:72}],[],[],[],[]);
  });
  await page.waitForTimeout(40);
  await page.screenshot({path:"test-results/map-revision/flash-hit-art-fixture.png"});
  writeFileSync("test-results/map-revision/report.json",JSON.stringify({at:new Date().toISOString(),browser:browser.version(),viewport:{width:1920,height:1080},scope:"Static actual-renderer art fixtures, not live simulation or gameplay proof.",errors},null,2));
  if(errors.length)throw Error(errors.join("\n"));
  console.log("Four map overviews, three closeups and one effects fixture saved; no browser errors.");
} finally {await browser.close();}
