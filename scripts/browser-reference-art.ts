// Actual native renderer fixtures. These verify presentation, not network gameplay.
import {chromium} from "playwright";
import {resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
import type {Renderer,RenderPlayer} from "../src/client/render.ts";
import type {MAPS} from "../src/shared/maps.ts";
declare global {interface Window {__referenceArt:{renderer:Renderer;maps:typeof MAPS}}}
const base=process.env.PREVIEW_URL??"http://127.0.0.1:8103",out="test-results/oct14-reference-art";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1920,height:1080}}),errors:string[]=[];
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/__reference-art__",r=>r.fulfill({contentType:"text/html",body:'<!doctype html><html><body style="margin:0"><div id="art" style="width:100vw;height:100vh"></div></body></html>'}));
try {
  await page.goto(base+"/__reference-art__");
  await page.evaluate(async shared=>{const [{Renderer},{MAPS}]=await Promise.all([import(String("/render.ts")),import(shared)]);const renderer=new Renderer();await renderer.init(document.querySelector<HTMLElement>("#art")!);window.__referenceArt={renderer,maps:MAPS};},"/@fs"+resolve("src/shared/maps.ts"));
  for(const id of ["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"]){
    await page.evaluate(id=>{const {renderer,maps}=window.__referenceArt,map=maps[id];renderer.setMap(map,true);const view=renderer.viewport();renderer.frame({x:map.width/2,y:map.height/2,visibleWidth:Math.max(map.width,map.height*view.width/view.playableHeight)*1.06,snap:true},1,[],[],[],[],[]);},id);
    await page.waitForTimeout(160);await page.screenshot({path:out+"/overview-"+id+".png"});
  }
  for(const size of [{width:1920,height:1080},{width:390,height:844}]) {
    await page.setViewportSize(size);
    for(const id of ["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"]){
      await page.evaluate(({id,width})=>{
        const {renderer,maps}=window.__referenceArt,map=maps[id];renderer.setMap(map,false);
        const bush=map.concealment?.[0],spawn=map.spawns[0],x=bush?bush.x+bush.w/2:spawn.x,y=bush?bush.y+bush.h:spawn.y;
        const pilot:RenderPlayer={id:1,x,y,aim:0,crouch:!!bush,alive:true,jetting:map.physics==="space",protected:false,team:0,color:0x779966,name:"Local",hp:100,maxHp:100,weapon:"minigun",local:true,dual:false,otherWeapon:null,emp:0,charge:.75,concealed:!!bush};
        const other={...pilot,id:2,x:x+105,crouch:false,local:false,team:1 as const,name:"Opposing pilot",weapon:"m14",concealed:false,reload:.45};
        renderer.frame({x:x+80,y:y-60,visibleWidth:width<600?450:900,snap:true},1,[pilot,other],[{id:1,k:"m14",armed:false,x:x+230,y:y-31,vx:800,vy:0},{id:2,k:"emp-gun",armed:false,x:x+200,y:y-85,vx:140,vy:0}],[],[],[]);
      },{id,width:size.width});
      await page.waitForTimeout(80);await page.screenshot({path:out+"/close-"+id+"-"+(size.width<600?"phone":"desktop")+".png"});
    }
  }
  if(errors.length)throw Error(errors.join("\n"));
  writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),browser:browser.version(),scope:"Static native renderer fixtures; no simulation or multiplayer claim.",maps:["outpost","high-tower","ice-box","pyramid","lunarcy","catacombs"],overviews:6,closeups:12,errors},null,2));
  console.log("Six native map overviews and12 desktop/phone closeups; no page errors.");
} finally {await browser.close();}
