// Real-input phone camera screenshots; no renderer or simulation injection.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import type {WorldSnapshot,PlayerSnap} from "../src/shared/types.ts";
const base=process.env.APP_URL??"http://localhost:8105",out="test-results/"+(process.env.REPORT_TAG??"oct14-phone-framing");mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage(),errors:string[]=[],checks:unknown[]=[];
const state={you:null as number|null,snap:null as WorldSnapshot|null};
page.on("pageerror",e=>errors.push(e.message));page.on("websocket",ws=>ws.on("framereceived",({payload})=>{const m=JSON.parse(String(payload));if(m.t==="match")state.you=m.you;if(m.t==="snap")state.snap=m;}));
const me=():PlayerSnap=>state.snap!.players.find(p=>p.id===state.you)!;
async function until(test:()=>boolean,label:string){const end=Date.now()+10000;while(!test()){if(Date.now()>end)throw Error(label);await page.waitForTimeout(25);}}
try{
 await page.goto(base);await page.locator("#practice").waitFor();
 const res=await page.request.post(base+"/api/rooms",{data:{name:"Portrait midair framing",isPublic:false,settings:{mode:"training",map:"lunarcy",bots:0,loadout:["smaw","m93ba","uzi"],mapPickups:false}}});assert.equal(res.status(),201);const {code}=await res.json();
 await page.goto(base+"/r/"+code);await page.getByRole("button",{name:"Join room",exact:true}).click();await page.locator("#start").click();await page.locator("canvas").waitFor();await until(()=>!!state.snap&&state.you!==null,"snapshot");
 await page.keyboard.press("ArrowRight");await page.keyboard.down("Space");await until(()=>me().y<600,"ascend into open space");await page.keyboard.up("Space");await page.keyboard.down("KeyS");await until(()=>me().vy>-5,"counter-thrust brake");await page.keyboard.up("KeyS");await page.keyboard.press("ArrowRight");await page.waitForTimeout(800);
 for(const label of ["Near","Far"]){
  if(label==="Far")for(let i=0;i<2;i++){await page.getByRole("button",{name:"Scope",exact:true}).click();await page.waitForTimeout(120);}
  await page.locator(".loadout-heading").filter({hasText:label+" scope"}).waitFor();await page.waitForTimeout(800);
  if(label==="Far"){await page.keyboard.down("Space");await until(()=>me().y<600,"Far-scope midair ascent");await page.keyboard.up("Space");await page.waitForTimeout(100);}
  checks.push({scope:label,player:{x:me().x,y:me().y,vx:me().vx,vy:me().vy},hud:await page.locator(".hud-weapon").boundingBox(),controlPlayBottom:await page.locator(".touch").getAttribute("data-playable-bottom")});
  await page.screenshot({path:out+"/phone-midair-"+label.toLowerCase()+".png"});
 }
 assert.deepEqual(errors,[]);
}finally{
 try{await page.keyboard.up("Space");await page.keyboard.up("KeyS");await page.getByRole("button",{name:"Menu",exact:true}).click();await page.getByRole("button",{name:"End round now",exact:true}).click();await page.getByText("Results saved to your match history.",{exact:true}).waitFor();await page.getByRole("button",{name:"Leave room",exact:true}).click();}catch{}
 await browser.close();writeFileSync(out+"/report.json",JSON.stringify({at:new Date().toISOString(),checks,errors,scope:"Real Space/S counter-thrust movement and touch scope inputs; screenshots require visual inspection."},null,2));
}
